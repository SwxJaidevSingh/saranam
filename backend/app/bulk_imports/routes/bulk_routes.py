"""
Bulk Appointment Import Routes
API endpoints for bulk appointment creation
"""

import os
import logging
from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from uuid import UUID
import tempfile
from datetime import datetime

from app.extensions import db
from app.bulk_imports.models import BulkImportSession, BulkImportItem
from app.bulk_imports.services.bulk_appointment_service import BulkAppointmentService
from app.bulk_imports.services.conflict_resolver import ConflictResolverService
from app.config import Config


logger = logging.getLogger(__name__)

# Create Blueprint
bulk_bp = Blueprint('bulk_imports', __name__, url_prefix='/api/appointments/bulk')


def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS


@bulk_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_file():
    """
    Upload file and extract appointment data

    Form Data:
        file: File to upload (xlsx, csv, pdf)
        llm_provider: LLM provider (openai, anthropic, local) - optional

    Returns:
        201: {session_id, extracted_data, metadata}
        400: Error
    """
    try:
        current_user_id = get_jwt_identity()

        # Check if file present
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']

        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        if not allowed_file(file.filename):
            return jsonify({
                'error': 'Invalid file type',
                'allowed_types': list(Config.ALLOWED_EXTENSIONS)
            }), 400

        # Get LLM provider preference
        llm_provider = request.form.get('llm_provider', Config.DEFAULT_LLM_PROVIDER)
        llm_api_key = request.form.get('llm_api_key')
        llm_model = request.form.get('llm_model')

        # Save file temporarily
        filename = secure_filename(file.filename)
        file_ext = filename.rsplit('.', 1)[1].lower()

        # Create temp file
        temp_file = tempfile.NamedTemporaryFile(
            delete=False,
            suffix=f'.{file_ext}',
            dir=Config.UPLOAD_FOLDER
        )
        file.save(temp_file.name)
        temp_file.close()

        # Initialize service
        service = BulkAppointmentService(
            user_id=UUID(current_user_id),
            llm_provider=llm_provider,
            llm_api_key=llm_api_key,
            llm_model=llm_model
        )

        # Process upload
        import_metadata = {}
        if llm_api_key:
            import_metadata['llm_api_key'] = llm_api_key
        if llm_model:
            import_metadata['llm_model'] = llm_model

        session = service.process_file_upload(
            file_path=temp_file.name,
            filename=filename,
            file_type=file_ext,
            import_metadata=import_metadata
        )

        # Extract appointments
        session = service.extract_appointments(session.id)

        return jsonify({
            'session_id': str(session.id),
            'status': session.status,
            'metadata': {
                'filename': session.filename,
                'file_type': session.file_type,
                'total_rows': session.total_rows,
                'extracted_count': session.extracted_count,
                'llm_provider': session.llm_provider,
                'llm_tokens_used': session.llm_tokens_used,
                'llm_cost_estimate': session.llm_cost_estimate
            },
            'extracted_data': [item.to_dict() for item in session.import_items]
        }), 201

    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bulk_bp.route('/validate', methods=['POST'])
@jwt_required()
def validate_appointments():
    """
    Validate extracted appointments

    JSON Body:
        session_id: Import session ID
        appointments: Optional - updated appointment data

    Returns:
        200: {valid_count, conflicts, errors, warnings}
        400: Error
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        session_id = data.get('session_id')
        if not session_id:
            return jsonify({'error': 'session_id required'}), 400

        # Get session
        session = BulkImportSession.query.get(UUID(session_id))
        if not session:
            return jsonify({'error': 'Session not found'}), 404

        if str(session.created_by) != current_user_id:
            return jsonify({'error': 'Unauthorized'}), 403

        # Update appointments if provided
        if 'appointments' in data:
            # Update import items with edited data
            for appt_data in data['appointments']:
                item_id = appt_data.get('id')
                if item_id:
                    item = BulkImportItem.query.get(UUID(item_id))
                    if item and item.session_id == session.id:
                        item.extracted_data = appt_data.get('extracted_data', item.extracted_data)

            db.session.commit()

        # Initialize service
        metadata = session.import_metadata or {}
        service = BulkAppointmentService(
            user_id=UUID(current_user_id),
            llm_provider=session.llm_provider,
            llm_api_key=metadata.get('llm_api_key'),
            llm_model=metadata.get('llm_model')
        )

        # Validate
        session = service.validate_appointments(session.id)

        return jsonify({
            'session_id': str(session.id),
            'status': session.status,
            'statistics': {
                'total': session.total_rows,
                'valid': session.valid_count,
                'invalid': session.total_rows - session.valid_count,
                'conflicts': session.conflict_count
            },
            'validation_summary': session.validation_summary,
            'items': [item.to_dict() for item in session.import_items]
        }), 200

    except Exception as e:
        logger.error(f"Validation error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bulk_bp.route('/resolve-conflicts', methods=['POST'])
@jwt_required()
def resolve_conflicts():
    """
    Get AI suggestions for resolving conflicts

    JSON Body:
        session_id: Import session ID
        auto_resolve: Whether to auto-apply suggestions (default: false)

    Returns:
        200: {suggestions, auto_resolved_count}
        400: Error
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        session_id = data.get('session_id')
        if not session_id:
            return jsonify({'error': 'session_id required'}), 400

        auto_resolve = data.get('auto_resolve', False)

        # Get session
        session = BulkImportSession.query.get(UUID(session_id))
        if not session:
            return jsonify({'error': 'Session not found'}), 404

        if str(session.created_by) != current_user_id:
            return jsonify({'error': 'Unauthorized'}), 403

        # Get items with conflicts
        conflict_items = [item for item in session.import_items if item.has_conflict]

        if not conflict_items:
            return jsonify({
                'message': 'No conflicts to resolve',
                'suggestions': []
            }), 200

        # Initialize conflict resolver
        metadata = session.import_metadata or {}
        resolver = ConflictResolverService(
            llm_provider=session.llm_provider,
            llm_api_key=metadata.get('llm_api_key'),
            llm_model=metadata.get('llm_model')
        )

        # Resolve conflicts
        results = resolver.resolve_conflicts(conflict_items, auto_resolve=auto_resolve)

        # Update session
        session.conflict_resolutions = results
        db.session.commit()

        return jsonify({
            'session_id': str(session.id),
            'total_conflicts': results['total_conflicts'],
            'auto_resolved': results['auto_resolved'],
            'manual_required': results['manual_required'],
            'suggestions': results['suggestions']
        }), 200

    except Exception as e:
        logger.error(f"Conflict resolution error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bulk_bp.route('/resolve-manually', methods=['POST'])
@jwt_required()
def resolve_manually():
    """
    Manually resolve a conflict

    JSON Body:
        item_id: Import item ID
        action: Resolution action (accepted_suggestion, manual_override, skipped)
        resolution_data: New time/date data

    Returns:
        200: {item}
        400: Error
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        item_id = data.get('item_id')
        action = data.get('action')
        resolution_data = data.get('resolution_data')

        if not item_id or not action:
            return jsonify({'error': 'item_id and action required'}), 400

        # Get item
        item = BulkImportItem.query.get(UUID(item_id))
        if not item:
            return jsonify({'error': 'Item not found'}), 404

        # Check authorization
        session = item.session
        if str(session.created_by) != current_user_id:
            return jsonify({'error': 'Unauthorized'}), 403

        # Resolve
        resolver = ConflictResolverService()
        item = resolver.manually_resolve_conflict(item.id, action, resolution_data)

        return jsonify({
            'item': item.to_dict(),
            'message': 'Conflict resolved'
        }), 200

    except Exception as e:
        logger.error(f"Manual resolution error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bulk_bp.route('/create', methods=['POST'])
@jwt_required()
def create_appointments():
    """
    Create all validated appointments

    JSON Body:
        session_id: Import session ID

    Returns:
        201: {created_count, failed_count, session_id}
        400: Error
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        session_id = data.get('session_id')
        if not session_id:
            return jsonify({'error': 'session_id required'}), 400

        # Get session
        session = BulkImportSession.query.get(UUID(session_id))
        if not session:
            return jsonify({'error': 'Session not found'}), 404

        if str(session.created_by) != current_user_id:
            return jsonify({'error': 'Unauthorized'}), 403

        # Initialize service
        metadata = session.import_metadata or {}
        service = BulkAppointmentService(
            user_id=UUID(current_user_id),
            llm_provider=session.llm_provider,
            llm_api_key=metadata.get('llm_api_key'),
            llm_model=metadata.get('llm_model')
        )

        # Create appointments
        session = service.create_appointments(session.id)

        return jsonify({
            'session_id': str(session.id),
            'status': session.status,
            'statistics': {
                'total': session.total_rows,
                'created': session.created_count,
                'failed': session.failed_count,
                'patients_created': session.patients_created
            },
            'results': [item.to_dict() for item in session.import_items]
        }), 201

    except Exception as e:
        logger.error(f"Creation error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bulk_bp.route('/sessions', methods=['GET'])
@jwt_required()
def list_sessions():
    """
    List import sessions for current user

    Query Params:
        page: Page number (default: 1)
        per_page: Items per page (default: 20)
        status: Filter by status

    Returns:
        200: {sessions, total, page, total_pages}
    """
    try:
        current_user_id = get_jwt_identity()

        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 100)
        status = request.args.get('status')

        # Query
        query = BulkImportSession.query.filter_by(created_by=UUID(current_user_id))

        if status:
            query = query.filter_by(status=status)

        # Order by created_at desc
        query = query.order_by(BulkImportSession.created_at.desc())

        # Paginate
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            'sessions': [session.to_dict() for session in pagination.items],
            'total': pagination.total,
            'page': page,
            'per_page': per_page,
            'total_pages': pagination.pages
        }), 200

    except Exception as e:
        logger.error(f"List sessions error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bulk_bp.route('/sessions/<uuid:session_id>', methods=['GET'])
@jwt_required()
def get_session(session_id):
    """
    Get session details

    Returns:
        200: {session, items}
        404: Not found
    """
    try:
        current_user_id = get_jwt_identity()

        session = BulkImportSession.query.get(session_id)
        if not session:
            return jsonify({'error': 'Session not found'}), 404

        if str(session.created_by) != current_user_id:
            return jsonify({'error': 'Unauthorized'}), 403

        return jsonify({
            'session': session.to_dict(),
            'items': [item.to_dict() for item in session.import_items]
        }), 200

    except Exception as e:
        logger.error(f"Get session error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bulk_bp.route('/rollback/<uuid:session_id>', methods=['POST'])
@jwt_required()
def rollback_import(session_id):
    """
    Rollback a bulk import (delete created appointments)

    JSON Body:
        reason: Reason for rollback

    Returns:
        200: {message, deleted_count}
        400: Error
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        session = BulkImportSession.query.get(session_id)
        if not session:
            return jsonify({'error': 'Session not found'}), 404

        if str(session.created_by) != current_user_id:
            return jsonify({'error': 'Unauthorized'}), 403

        if not session.can_rollback:
            return jsonify({'error': 'Session cannot be rolled back'}), 400

        if session.status == 'rolled_back':
            return jsonify({'error': 'Session already rolled back'}), 400

        # Delete created appointments
        deleted_count = 0
        for item in session.import_items:
            if item.created_appointment_id:
                appointment = Encounter.query.get(item.created_appointment_id)
                if appointment:
                    db.session.delete(appointment)
                    deleted_count += 1

        # Mark session as rolled back
        session.status = 'rolled_back'
        session.rolled_back_at = datetime.utcnow()
        session.rolled_back_by = UUID(current_user_id)
        session.rollback_reason = data.get('reason', 'No reason provided')
        session.can_rollback = False

        db.session.commit()

        logger.info(f"Rolled back session {session_id}: {deleted_count} appointments deleted")

        return jsonify({
            'message': 'Import rolled back successfully',
            'deleted_count': deleted_count
        }), 200

    except Exception as e:
        logger.error(f"Rollback error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bulk_bp.route('/export/<uuid:session_id>', methods=['GET'])
@jwt_required()
def export_results(session_id):
    """
    Export import results as CSV

    Returns:
        200: CSV file
        404: Not found
    """
    try:
        current_user_id = get_jwt_identity()

        session = BulkImportSession.query.get(session_id)
        if not session:
            return jsonify({'error': 'Session not found'}), 404

        if str(session.created_by) != current_user_id:
            return jsonify({'error': 'Unauthorized'}), 403

        # Generate CSV
        import csv
        import io

        output = io.StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow([
            'Row', 'Status', 'Patient Name', 'Date', 'Time', 'Provider',
            'Type', 'Created', 'Error', 'Appointment ID'
        ])

        # Data
        for item in session.import_items:
            data = item.extracted_data or {}
            writer.writerow([
                item.row_number,
                item.status,
                data.get('patient_name', ''),
                data.get('appointment_date', ''),
                data.get('appointment_time', ''),
                data.get('provider_name', ''),
                data.get('appointment_type', ''),
                'Yes' if item.created_appointment_id else 'No',
                item.error_message or '',
                str(item.created_appointment_id) if item.created_appointment_id else ''
            ])

        # Create file
        output.seek(0)
        filename = f"import_results_{session.id}_{datetime.now().strftime('%Y%m%d')}.csv"

        return send_file(
            io.BytesIO(output.getvalue().encode('utf-8')),
            mimetype='text/csv',
            as_attachment=True,
            download_name=filename
        )

    except Exception as e:
        logger.error(f"Export error: {str(e)}")
        return jsonify({'error': str(e)}), 500


# Health check
@bulk_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'service': 'bulk_imports'}), 200
