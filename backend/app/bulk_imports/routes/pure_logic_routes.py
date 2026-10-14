"""
Pure Logic Bulk Import API Routes
Endpoints for deterministic bulk appointment processing without LLM
"""

import os
import uuid
import logging
from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
from datetime import datetime
from uuid import UUID
import io
import csv

from sqlalchemy import func
from app.auth.decorators import require_auth
from app.bulk_imports.services.pure_logic_bulk_service import PureLogicBulkService
from app.bulk_imports.models.bulk_import_session import BulkImportSession
from app.bulk_imports.models.bulk_import_item import BulkImportItem
from app.extensions import db

logger = logging.getLogger(__name__)

pure_logic_bp = Blueprint('pure_logic_bulk', __name__, url_prefix='/api/bulk-appointments')

UPLOAD_FOLDER = os.getenv('BULK_UPLOAD_FOLDER', '/tmp/bulk_uploads')
ALLOWED_EXTENSIONS = {'csv', 'xlsx', 'xls'}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB

# Ensure upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def _match_or_create_patient_for_item(item: BulkImportItem):
    """
    Match or prepare patient creation for an item
    This is used when resolving provider issues to ensure patient data is populated
    """
    from app.patients.models import Patient
    from rapidfuzz import process, fuzz

    extracted_data = item.extracted_data or {}

    # Try to match existing patient by name (simplified matching)
    patient_name = extracted_data.get('patient_name')
    if patient_name:
        patients = Patient.query.filter(Patient.is_active == True).all()
        if patients:
            patient_names = {p.id: p.full_name for p in patients}

            # Use fuzzy matching
            match = process.extractOne(
                patient_name,
                patient_names,
                scorer=fuzz.ratio,
                score_cutoff=80  # 80% similarity threshold
            )

            if match:
                matched_name, score, patient_id = match
                item.patient_id = patient_id
                item.patient_match_type = 'fuzzy' if score < 100 else 'exact'
                item.patient_match_score = score
                return

    # No match found - prepare for patient creation
    item.patient_created = True
    item.created_patient_data = {
        'full_name': extracted_data.get('patient_name'),
        'phone_number': extracted_data.get('patient_phone'),
        'email': extracted_data.get('patient_email'),
        'date_of_birth': extracted_data.get('patient_dob')
    }


@pure_logic_bp.route('/upload', methods=['POST'])
@require_auth
def upload_file(current_user):
    """
    Upload CSV/XLSX file for bulk appointment import

    Returns:
        {
            session_id: UUID,
            filename: str,
            total_rows: int,
            status: str
        }
    """
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']

        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        if not allowed_file(file.filename):
            return jsonify({'error': 'File type not allowed. Use CSV or XLSX'}), 400

        # Secure filename
        filename = secure_filename(file.filename)
        file_ext = filename.rsplit('.', 1)[1].lower()

        # Generate unique file path
        unique_filename = f"{uuid.uuid4()}_{filename}"
        file_path = os.path.join(UPLOAD_FOLDER, unique_filename)

        # Save file
        file.save(file_path)

        # Check file size
        file_size = os.path.getsize(file_path)
        if file_size > MAX_FILE_SIZE:
            os.remove(file_path)
            return jsonify({'error': f'File too large (max {MAX_FILE_SIZE // (1024*1024)}MB)'}), 400

        # Create import session
        service = PureLogicBulkService(user_id=current_user.id)
        session = service.process_file_upload(
            file_path=file_path,
            filename=filename,
            file_type=file_ext
        )

        return jsonify({
            'session_id': str(session.id),
            'filename': session.filename,
            'file_size': session.file_size,
            'status': session.status,
            'created_at': session.created_at.isoformat()
        }), 201

    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        return jsonify({'error': str(e)}), 500


@pure_logic_bp.route('/process/<session_id>', methods=['POST'])
@require_auth
def process_session(current_user, session_id):
    """
    Process uploaded file: parse, validate, detect conflicts

    Returns:
        {
            session_id: UUID,
            auto_approved: int,
            needs_review: int,
            rejected: int,
            status: str
        }
    """
    try:
        service = PureLogicBulkService(user_id=current_user.id)
        session = service.process_and_validate(uuid.UUID(session_id))

        return jsonify({
            'session_id': str(session.id),
            'total_rows': session.total_rows,
            'statistics': {
                'auto_approved_count': session.auto_approved_count or 0,
                'needs_review_count': session.needs_review_count or 0,
                'rejected_count': session.rejected_count or 0,
                'missing_provider_count': session.missing_provider_count or 0
            },
            'status': session.status,
            'completed_at': session.completed_at.isoformat() if session.completed_at else None
        }), 200

    except Exception as e:
        logger.error(f"Error processing session: {str(e)}")
        return jsonify({'error': str(e)}), 500


@pure_logic_bp.route('/sessions/<session_id>', methods=['GET'])
@require_auth
def get_session(current_user, session_id):
    """Get full session details"""
    try:
        session = BulkImportSession.query.get(uuid.UUID(session_id))

        if not session:
            return jsonify({'error': 'Session not found'}), 404

        # Check ownership
        if session.created_by != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403

        return jsonify({
            'session': session.to_dict(),
            'statistics': {
                'total_rows': session.total_rows,
                'auto_approved': session.auto_approved_count or 0,
                'needs_review': session.needs_review_count or 0,
                'rejected': session.rejected_count or 0,
                'created': session.created_count or 0,
                'failed': session.failed_count or 0
            }
        }), 200

    except Exception as e:
        logger.error(f"Error getting session: {str(e)}")
        return jsonify({'error': str(e)}), 500


@pure_logic_bp.route('/sessions/<session_id>/items', methods=['GET'])
@require_auth
def get_session_items(current_user, session_id):
    """
    Get import items for a session

    Query params:
        - status: filter by status (valid, invalid, conflict)
        - page: page number (default 1)
        - per_page: items per page (default 50)
    """
    try:
        session = BulkImportSession.query.get(uuid.UUID(session_id))

        if not session:
            return jsonify({'error': 'Session not found'}), 404

        if session.created_by != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403

        # Get query params
        status_filter = request.args.get('status')
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))

        # Build query
        query = BulkImportItem.query.filter(
            BulkImportItem.session_id == session.id
        )

        if status_filter:
            if status_filter == 'conflict':
                query = query.filter(BulkImportItem.has_conflict == True)
            else:
                query = query.filter(BulkImportItem.status == status_filter)

        # Paginate
        paginated = query.order_by(BulkImportItem.row_number).paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )

        return jsonify({
            'items': [item.to_dict() for item in paginated.items],
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': paginated.total,
                'pages': paginated.pages
            }
        }), 200

    except Exception as e:
        logger.error(f"Error getting items: {str(e)}")
        return jsonify({'error': str(e)}), 500


@pure_logic_bp.route('/sessions/<session_id>/items/<item_id>', methods=['GET'])
@require_auth
def get_item(current_user, session_id, item_id):
    """Get single import item with full details"""
    try:
        item = BulkImportItem.query.get(uuid.UUID(item_id))

        if not item:
            return jsonify({'error': 'Item not found'}), 404

        if item.session.created_by != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403

        return jsonify(item.to_dict()), 200

    except Exception as e:
        logger.error(f"Error getting item: {str(e)}")
        return jsonify({'error': str(e)}), 500


@pure_logic_bp.route('/sessions/<session_id>/items/<item_id>/resolve', methods=['POST'])
@require_auth
def resolve_conflict(current_user, session_id, item_id):
    """
    Resolve conflict for an import item

    Request body:
        {
            "action": "accept_suggestion" | "manual_time" | "skip" | "override",
            "data": {
                "suggestion_index": 0,  # For accept_suggestion
                "custom_date": "2026-03-20",  # For manual_time
                "custom_time": "14:30",  # For manual_time
                "override_reason": "Emergency"  # For override
            }
        }
    """
    try:
        item = BulkImportItem.query.get(uuid.UUID(item_id))

        if not item:
            return jsonify({'error': 'Item not found'}), 404

        if item.session.created_by != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403

        data = request.get_json()
        action = data.get('action')
        resolution_data = data.get('data', {})

        if action not in ['accept_suggestion', 'manual_time', 'skip', 'override']:
            return jsonify({'error': 'Invalid action'}), 400

        # Update resolution
        item.resolution_action = action
        item.resolution_data = resolution_data
        item.resolved_by = current_user.id
        item.resolved_at = datetime.utcnow()

        if action == 'skip':
            item.status = 'skipped'

        db.session.commit()

        return jsonify({
            'item': item.to_dict(),
            'message': f'Conflict resolved with action: {action}'
        }), 200

    except Exception as e:
        logger.error(f"Error resolving conflict: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@pure_logic_bp.route('/sessions/<session_id>/create', methods=['POST'])
@require_auth
def create_appointments(current_user, session_id):
    """
    Create all validated appointments from session

    Returns:
        {
            created: int,
            failed: int,
            skipped: int,
            patients_created: int
        }
    """
    try:
        from app.bulk_imports.services.appointment_creator import AppointmentCreator

        session = BulkImportSession.query.get(uuid.UUID(session_id))

        if not session:
            return jsonify({'error': 'Session not found'}), 404

        if session.created_by != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403

        # Create appointments
        result = AppointmentCreator.create_appointments_from_session(
            session_id=session.id,
            user_id=current_user.id
        )

        return jsonify({
            'message': 'Appointments created successfully',
            'session_id': str(session.id),
            'created_count': result['created'],
            'failed_count': result['failed'],
            'skipped_count': result['skipped'],
            'patients_created': result['patients_created']
        }), 200

    except Exception as e:
        logger.error(f"Error creating appointments: {str(e)}")
        return jsonify({'error': str(e)}), 500


@pure_logic_bp.route('/template', methods=['GET'])
def download_template():
    """Download CSV template file"""
    try:
        # Create template CSV in memory
        output = io.StringIO()
        writer = csv.writer(output)

        # Write header
        headers = [
            'patient_name',
            'patient_phone',
            'patient_email',
            'patient_dob',
            'provider_name',
            'appointment_date',
            'appointment_time',
            'duration_minutes',
            'appointment_type',
            'chief_complaint',
            'notes'
        ]
        writer.writerow(headers)

        # Write example rows
        examples = [
            ['Rajesh Kumar', '9876543210', 'rajesh@example.com', '1985-06-15', 'Dr. Sharma',
             '2026-03-20', '09:00', '30', 'consultation', 'Routine checkup', 'First visit'],
            ['Priya Singh', '9123456789', 'priya@example.com', '1990-03-22', 'Dr. Mehta',
             '2026-03-20', '10:00', '45', 'followup', 'Diabetes follow-up', 'Regular patient'],
            ['Amit Patel', '9988776655', '', '1978-11-10', 'Dr. Sharma',
             '2026-03-21', '14:00', '30', 'consultation', 'Back pain', '']
        ]

        for row in examples:
            writer.writerow(row)

        # Prepare file for download
        output.seek(0)
        return send_file(
            io.BytesIO(output.getvalue().encode('utf-8')),
            mimetype='text/csv',
            as_attachment=True,
            download_name='bulk_appointment_template.csv'
        )

    except Exception as e:
        logger.error(f"Error generating template: {str(e)}")
        return jsonify({'error': str(e)}), 500


@pure_logic_bp.route('/sessions/<uuid:session_id>/missing-providers', methods=['GET'])
@require_auth
def get_missing_providers(session_id, current_user):
    """
    Get missing providers for a session grouped by provider name
    """
    try:
        # Get session
        session = db.session.query(BulkImportSession).get(session_id)
        if not session:
            return jsonify({'error': 'Session not found'}), 404

        # Authorization check
        if session.created_by != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403

        # Get all missing provider items
        missing_items = db.session.query(BulkImportItem).filter(
            BulkImportItem.session_id == session_id,
            BulkImportItem.status == 'missing_provider'
        ).all()

        # Group by original provider name
        grouped_providers = {}
        for item in missing_items:
            provider_name = item.original_provider_name
            if provider_name not in grouped_providers:
                grouped_providers[provider_name] = {
                    'provider_name': provider_name,
                    'appointment_count': 0,
                    'item_ids': []
                }
            grouped_providers[provider_name]['appointment_count'] += 1
            grouped_providers[provider_name]['item_ids'].append(str(item.id))

        # Convert to list
        missing_providers_list = list(grouped_providers.values())

        return jsonify({
            'missing_providers': missing_providers_list,
            'total_missing_providers': len(missing_providers_list),
            'total_affected_appointments': len(missing_items)
        }), 200

    except Exception as e:
        logger.error(f"Error getting missing providers: {str(e)}")
        return jsonify({'error': str(e)}), 500


@pure_logic_bp.route('/sessions/<uuid:session_id>/resolve-missing-providers', methods=['POST'])
@require_auth
def resolve_missing_providers(session_id, current_user):
    """
    Resolve missing providers for a session

    Request body:
    {
      "resolutions": [
        {
          "provider_name": "Dr. Mehta",
          "action": "create",  // or "assign_unknown", "change", "skip"
          "provider_data": {  // required for "create" action
            "full_name": "Dr. Mehta",
            "specialization": "Cardiology",
            "phone": "9876543210",
            "email": "mehta@example.com"
          },
          "existing_provider_id": "uuid"  // required for "change" action
        }
      ]
    }
    """
    try:
        # Get session
        session = db.session.query(BulkImportSession).get(session_id)
        if not session:
            return jsonify({'error': 'Session not found'}), 404

        # Authorization check
        if session.created_by != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403

        data = request.get_json()
        resolutions = data.get('resolutions', [])

        if not resolutions:
            return jsonify({'error': 'No resolutions provided'}), 400

        results = []

        for resolution in resolutions:
            provider_name = resolution.get('provider_name')
            action = resolution.get('action')

            if not provider_name or not action:
                results.append({
                    'provider_name': provider_name,
                    'success': False,
                    'error': 'Missing provider_name or action'
                })
                continue

            # Get all items for this provider
            items = db.session.query(BulkImportItem).filter(
                BulkImportItem.session_id == session_id,
                BulkImportItem.status == 'missing_provider',
                BulkImportItem.original_provider_name == provider_name
            ).all()

            if not items:
                results.append({
                    'provider_name': provider_name,
                    'success': False,
                    'error': 'No items found for this provider'
                })
                continue

            try:
                if action == 'create':
                    # Create new provider
                    provider_data = resolution.get('provider_data', {})
                    if not provider_data.get('full_name'):
                        raise ValueError("Provider full_name is required for create action")

                    from app.providers.services import ProviderService
                    new_provider = ProviderService.quick_create_provider(
                        full_name=provider_data['full_name'],
                        specialization=provider_data.get('specialization'),
                        phone=provider_data.get('phone'),
                        email=provider_data.get('email'),
                        created_by_id=current_user.id,
                        bulk_import_session_id=session_id
                    )

                    # Update all items
                    for item in items:
                        item.provider_id = UUID(new_provider['id'])
                        item.provider_resolution_action = 'create'
                        item.provider_created_id = UUID(new_provider['id'])
                        item.status = 'valid'  # Now ready to be processed
                        item.is_valid = True  # Mark as valid for appointment creation

                        # Match or create patient if not already done
                        if not item.patient_id and not item.patient_created:
                            _match_or_create_patient_for_item(item)

                    results.append({
                        'provider_name': provider_name,
                        'success': True,
                        'action': 'create',
                        'provider_id': new_provider['id'],
                        'items_updated': len(items)
                    })

                elif action == 'assign_unknown':
                    # Get or create Unknown Provider
                    from app.providers.services import ProviderService
                    unknown_provider = ProviderService.get_or_create_unknown_provider(
                        created_by_id=current_user.id
                    )

                    # Update all items
                    for item in items:
                        item.provider_id = UUID(unknown_provider['id'])
                        item.provider_resolution_action = 'assign_unknown'
                        item.status = 'valid'
                        item.is_valid = True  # Mark as valid for appointment creation

                        # Match or create patient if not already done
                        if not item.patient_id and not item.patient_created:
                            _match_or_create_patient_for_item(item)

                    results.append({
                        'provider_name': provider_name,
                        'success': True,
                        'action': 'assign_unknown',
                        'provider_id': unknown_provider['id'],
                        'items_updated': len(items)
                    })

                elif action == 'change':
                    # Change to existing provider
                    existing_provider_id = resolution.get('existing_provider_id')
                    if not existing_provider_id:
                        raise ValueError("existing_provider_id is required for change action")

                    # Verify provider exists
                    from app.providers.models import HealthcareProvider
                    existing_provider = db.session.query(HealthcareProvider).get(UUID(existing_provider_id))
                    if not existing_provider:
                        raise ValueError("Provider not found")

                    # Update all items
                    for item in items:
                        item.provider_id = UUID(existing_provider_id)
                        item.provider_resolution_action = 'change'
                        item.status = 'valid'
                        item.is_valid = True  # Mark as valid for appointment creation

                        # Match or create patient if not already done
                        if not item.patient_id and not item.patient_created:
                            _match_or_create_patient_for_item(item)

                    results.append({
                        'provider_name': provider_name,
                        'success': True,
                        'action': 'change',
                        'provider_id': existing_provider_id,
                        'items_updated': len(items)
                    })

                elif action == 'skip':
                    # Skip these appointments
                    for item in items:
                        item.provider_resolution_action = 'skip'
                        item.status = 'invalid'
                        item.validation_errors = [{
                            'field': 'provider_name',
                            'message': f"Provider '{provider_name}' resolution skipped by user"
                        }]

                    results.append({
                        'provider_name': provider_name,
                        'success': True,
                        'action': 'skip',
                        'items_updated': len(items)
                    })

                else:
                    results.append({
                        'provider_name': provider_name,
                        'success': False,
                        'error': f"Invalid action: {action}"
                    })

            except Exception as e:
                results.append({
                    'provider_name': provider_name,
                    'success': False,
                    'error': str(e)
                })

        # Commit all changes
        db.session.commit()

        # Recalculate session statistics
        missing_provider_count = db.session.query(func.count(BulkImportItem.id)).filter(
            BulkImportItem.session_id == session_id,
            BulkImportItem.status == 'missing_provider'
        ).scalar() or 0

        auto_approved_count = db.session.query(func.count(BulkImportItem.id)).filter(
            BulkImportItem.session_id == session_id,
            BulkImportItem.status == 'valid',
            BulkImportItem.has_conflict == False
        ).scalar() or 0

        needs_review_count = db.session.query(func.count(BulkImportItem.id)).filter(
            BulkImportItem.session_id == session_id,
            BulkImportItem.status == 'valid',
            BulkImportItem.has_conflict == True
        ).scalar() or 0

        rejected_count = db.session.query(func.count(BulkImportItem.id)).filter(
            BulkImportItem.session_id == session_id,
            BulkImportItem.status == 'invalid'
        ).scalar() or 0

        session.missing_provider_count = missing_provider_count
        session.auto_approved_count = auto_approved_count
        session.needs_review_count = needs_review_count
        session.rejected_count = rejected_count
        session.valid_count = auto_approved_count + needs_review_count

        db.session.commit()

        return jsonify({
            'results': results,
            'session_stats': {
                'auto_approved_count': session.auto_approved_count,
                'needs_review_count': session.needs_review_count,
                'missing_provider_count': session.missing_provider_count,
                'rejected_count': session.rejected_count
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error resolving missing providers: {str(e)}")
        return jsonify({'error': str(e)}), 500


# Register blueprint
def register_pure_logic_routes(app):
    """Register pure logic routes with Flask app"""
    app.register_blueprint(pure_logic_bp)
