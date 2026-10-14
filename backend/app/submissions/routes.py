"""Submissions routes."""
from flask import Blueprint, request, jsonify, make_response
from datetime import datetime
from marshmallow import Schema, fields, ValidationError
from app.auth.decorators import require_permission, get_current_user
from app.submissions.services import SubmissionService
from app.processing.submission_processor import SubmissionProcessor
from app.forms.models import Form
from app.extensions import db

# Create blueprint
submissions_bp = Blueprint('submissions', __name__)


# Validation schemas
class SubmissionSchema(Schema):
    """Submission validation schema."""
    form_id = fields.UUID(required=True)
    data = fields.Dict(required=True)
    patient_id = fields.UUID(required=False)  # Optional - for existing patients
    encounter_id = fields.UUID(required=False)  # Optional - for existing encounters
    encounter_type = fields.Str(required=False)  # Optional - OPD, IPD, Emergency
    chief_complaint = fields.Str(required=False)  # Optional - chief complaint


class UpdateSubmissionSchema(Schema):
    """Submission update validation schema."""
    data = fields.Dict(required=True)


@submissions_bp.route('', methods=['GET'])
@require_permission('view_submission')
def get_submissions():
    """Get list of submissions."""
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 50, type=int), 100)
    form_id = request.args.get('form_id')
    user_id = request.args.get('user_id')

    # Parse date filters
    date_from = None
    date_to = None
    if request.args.get('date_from'):
        try:
            date_from = datetime.fromisoformat(request.args.get('date_from'))
        except ValueError:
            return jsonify({'message': 'Invalid date_from format', 'error': 'validation_error'}), 400

    if request.args.get('date_to'):
        try:
            date_to = datetime.fromisoformat(request.args.get('date_to'))
        except ValueError:
            return jsonify({'message': 'Invalid date_to format', 'error': 'validation_error'}), 400

    result = SubmissionService.get_submissions(
        page=page,
        per_page=per_page,
        form_id=form_id,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to
    )

    return jsonify(result), 200


@submissions_bp.route('/<uuid:submission_id>', methods=['GET'])
@require_permission('view_submission')
def get_submission(submission_id):
    """Get submission by ID."""
    submission, message = SubmissionService.get_submission_by_id(submission_id)

    if not submission:
        return jsonify({'message': message, 'error': 'not_found'}), 404

    return jsonify({'submission': submission.to_dict()}), 200


@submissions_bp.route('', methods=['POST'])
@require_permission('submit_form')
def create_submission():
    """
    Create a new submission with hybrid processing pipeline.

    This endpoint now uses intelligent processing that:
    1. Accepts raw JSONB form data (same as before - no frontend changes!)
    2. Processes and extracts clinical semantics
    3. Stores relationally across multiple tables
    4. Creates patient and encounter records as needed
    5. Logs comprehensive audit trail
    """
    schema = SubmissionSchema()
    try:
        request_data = schema.load(request.json)
    except ValidationError as e:
        return jsonify({'message': 'Validation error', 'errors': e.messages}), 400

    # Get form
    form = Form.query.get(request_data['form_id'])
    if not form:
        return jsonify({'message': 'Form not found', 'error': 'not_found'}), 404

    if not form.is_active:
        return jsonify({'message': 'Form is not active', 'error': 'form_inactive'}), 400

    # Get current user
    user = get_current_user()

    # Build context from optional parameters
    context = {
        'patient_id': request_data.get('patient_id'),
        'encounter_id': request_data.get('encounter_id'),
        'encounter_type': request_data.get('encounter_type', 'OPD'),
        'chief_complaint': request_data.get('chief_complaint')
    }

    # Build request info for audit logging
    request_info = {
        'ip_address': request.remote_addr,
        'user_agent': request.user_agent.string if request.user_agent else None
    }

    try:
        # Process through hybrid pipeline
        processor = SubmissionProcessor()
        result = processor.process_submission(
            form=form,
            raw_data=request_data['data'],
            user=user,
            context=context,
            request_info=request_info
        )

        # Build comprehensive response
        response = {
            'message': 'Submission created successfully',
            'submission': result.submission.to_dict(),
            'processing_summary': {
                'patient_id': str(result.patient.id) if result.patient else None,
                'patient_name': result.patient.full_name if result.patient else None,
                'encounter_id': str(result.encounter.id) if result.encounter else None,
                'encounter_type': result.encounter.encounter_type if result.encounter else None,
                'form_answers_saved': len(result.form_answers),
                'observations_created': len(result.observations),
                'diagnoses_created': len(result.diagnoses),
                'vitals_recorded': [
                    {
                        'type': obs.observation_type,
                        'value': obs.get_value(),
                        'unit': obs.unit
                    }
                    for obs in result.observations
                ] if result.observations else []
            }
        }

        return jsonify(response), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'message': 'Failed to process submission',
            'error': 'processing_error',
            'details': str(e)
        }), 400


@submissions_bp.route('/<uuid:submission_id>', methods=['PUT', 'PATCH'])
@require_permission('submit_form')
def update_submission(submission_id):
    """Update existing submission."""
    schema = UpdateSubmissionSchema()
    try:
        data = schema.load(request.json)
    except ValidationError as e:
        return jsonify({'message': 'Validation error', 'errors': e.messages}), 400

    submission, message = SubmissionService.update_submission(
        submission_id=submission_id,
        data=data['data']
    )

    if not submission:
        if isinstance(message, dict):
            return jsonify(message), 400
        return jsonify({'message': message, 'error': 'update_failed'}), 400

    return jsonify({'message': message, 'submission': submission.to_dict()}), 200


@submissions_bp.route('/<uuid:submission_id>', methods=['DELETE'])
@require_permission('submit_form')
def delete_submission(submission_id):
    """Delete a submission."""
    success, message = SubmissionService.delete_submission(submission_id)

    if not success:
        return jsonify({'message': message, 'error': 'deletion_failed'}), 400

    return jsonify({'message': message}), 200


@submissions_bp.route('/export', methods=['GET'])
@require_permission('view_submission')
def export_submissions():
    """Export submissions data in JSON, CSV, or Excel format."""
    form_id = request.args.get('form_id')
    format_type = request.args.get('format', 'json')

    if format_type not in ['json', 'csv', 'xlsx']:
        return jsonify({'message': 'Invalid format. Use json, csv, or xlsx', 'error': 'validation_error'}), 400

    data = SubmissionService.export_submissions(form_id, format_type)

    if format_type == 'csv':
        response = make_response(data)
        response.headers['Content-Disposition'] = 'attachment; filename=submissions.csv'
        response.headers['Content-Type'] = 'text/csv'
        return response

    if format_type == 'xlsx':
        response = make_response(data)
        response.headers['Content-Disposition'] = 'attachment; filename=submissions.xlsx'
        response.headers['Content-Type'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        return response

    return jsonify({'submissions': data}), 200