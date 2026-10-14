"""External API routes for Health Screening integration."""
from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.external import external_bp
from app.external.auth import api_key_required, generate_tokens_for_user
from app.external.services import ExternalSubmissionService
from app.forms.models import Form
from app.common.models import User
from app.submissions.models import FormSubmission
import logging

logger = logging.getLogger(__name__)

# Initialize service
submission_service = ExternalSubmissionService()


@external_bp.route('/auth/token', methods=['POST'])
@api_key_required
def get_access_token():
    """
    Exchange API key for JWT access token.

    Request Headers:
        X-API-Key: Service account API key

    Response:
        {
            "access_token": "eyJ...",
            "refresh_token": "eyJ...",
            "token_type": "Bearer",
            "expires_in": 3600,
            "user": {...}
        }
    """
    user = request.current_user
    tokens = generate_tokens_for_user(user)

    logger.info(f"API key exchanged for JWT token: {user.email}")

    return jsonify(tokens), 200


@external_bp.route('/forms', methods=['GET'])
@jwt_required()
def list_forms():
    """
    List all active forms available for external submission.

    Query Parameters:
        - limit: Number of forms to return (default: 50)
        - offset: Pagination offset (default: 0)
        - is_public: Filter by public forms only (default: false)

    Response:
        {
            "forms": [
                {
                    "id": "uuid",
                    "name": "Health Screening Form",
                    "description": "...",
                    "version": 1,
                    "is_active": true,
                    "field_count": 15
                }
            ],
            "total": 10,
            "limit": 50,
            "offset": 0
        }
    """
    try:
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        is_public = request.args.get('is_public', 'false').lower() == 'true'

        query = Form.query.filter_by(is_active=True)

        if is_public:
            query = query.filter_by(is_public=True)

        total = query.count()
        forms = query.limit(limit).offset(offset).all()

        forms_data = []
        for form in forms:
            schema = form.schema or {}
            field_count = 0

            # Count fields
            if 'pages' in schema:
                for page in schema.get('pages', []):
                    field_count += len(page.get('fields', []))
            else:
                field_count = len(schema.get('fields', []))

            forms_data.append({
                'id': str(form.id),
                'name': form.name,
                'description': form.description,
                'version': form.version,
                'is_active': form.is_active,
                'is_public': form.is_public,
                'field_count': field_count,
                'created_at': form.created_at.isoformat()
            })

        return jsonify({
            'forms': forms_data,
            'total': total,
            'limit': limit,
            'offset': offset
        }), 200

    except Exception as e:
        logger.error(f"Error listing forms: {str(e)}")
        return jsonify({
            'error': 'Failed to list forms',
            'message': str(e)
        }), 500


@external_bp.route('/forms/<form_id>', methods=['GET'])
@jwt_required()
def get_form(form_id):
    """
    Get form schema by ID.

    Response:
        {
            "id": "uuid",
            "name": "Health Screening Form",
            "description": "...",
            "schema": {...},
            "version": 1,
            "is_active": true
        }
    """
    try:
        form = Form.query.get(form_id)

        if not form:
            return jsonify({
                'error': 'Form not found',
                'form_id': form_id
            }), 404

        return jsonify({
            'id': str(form.id),
            'name': form.name,
            'description': form.description,
            'schema': form.schema,
            'version': form.version,
            'is_active': form.is_active,
            'is_public': form.is_public,
            'created_at': form.created_at.isoformat(),
            'updated_at': form.updated_at.isoformat()
        }), 200

    except Exception as e:
        logger.error(f"Error getting form {form_id}: {str(e)}")
        return jsonify({
            'error': 'Failed to get form',
            'message': str(e)
        }), 500


@external_bp.route('/submissions', methods=['POST'])
@jwt_required()
def create_submission():
    """
    Submit health screening data to CV Raman.

    Request Body:
        {
            "form_id": "uuid",
            "data": {
                "field_id": "value",
                ...
            },
            "external_context": {
                "source_system": "health_screening",
                "external_submission_id": "1203",
                "external_patient_id": "501",
                "external_form_id": "10",
                "metadata": {
                    "camp_id": 5,
                    "camp_name": "Rural Health Camp",
                    "latitude": 25.5941,
                    "longitude": 85.1376
                }
            }
        }

    Response:
        {
            "success": true,
            "message": "Submission processed successfully",
            "submission_id": "uuid",
            "cv_raman_id": "uuid",
            "external_submission_id": "1203",
            "patient_id": "uuid",
            "patient_created": false,
            "encounter_id": "uuid",
            "encounter_created": true,
            "observations_created": 6
        }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({
                'error': 'Missing request body',
                'message': 'Request body must be JSON'
            }), 400

        form_id = data.get('form_id')
        submission_data = data.get('data', {})
        external_context = data.get('external_context', {})

        if not form_id:
            return jsonify({
                'error': 'Missing form_id',
                'message': 'form_id is required'
            }), 400

        if not submission_data:
            return jsonify({
                'error': 'Missing data',
                'message': 'data field is required'
            }), 400

        # Get current user from JWT
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({
                'error': 'User not found',
                'message': 'JWT token user not found'
            }), 401

        # Process submission
        result, status_code = submission_service.process_external_submission(
            form_id=form_id,
            submission_data=submission_data,
            user=user,
            external_context=external_context
        )

        return jsonify(result), status_code

    except Exception as e:
        logger.error(f"Error creating external submission: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'Internal server error',
            'message': str(e)
        }), 500


@external_bp.route('/submissions/bulk', methods=['POST'])
@jwt_required()
def create_bulk_submissions():
    """
    Submit multiple submissions in batch.

    Request Body:
        {
            "submissions": [
                {
                    "form_id": "uuid",
                    "data": {...},
                    "external_context": {...}
                },
                ...
            ]
        }

    Response:
        {
            "total": 10,
            "success": 9,
            "failed": 1,
            "duplicates": 0,
            "errors": [...],
            "submissions": [...]
        }
    """
    try:
        data = request.get_json()

        if not data or 'submissions' not in data:
            return jsonify({
                'error': 'Missing submissions array',
                'message': 'Request body must contain "submissions" array'
            }), 400

        submissions = data.get('submissions', [])

        if not submissions:
            return jsonify({
                'error': 'Empty submissions array',
                'message': 'At least one submission is required'
            }), 400

        if len(submissions) > 100:
            return jsonify({
                'error': 'Too many submissions',
                'message': 'Maximum 100 submissions per batch'
            }), 400

        # Get current user from JWT
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({
                'error': 'User not found',
                'message': 'JWT token user not found'
            }), 401

        # Process batch
        results = submission_service.bulk_process_submissions(submissions, user)

        return jsonify(results), 200

    except Exception as e:
        logger.error(f"Error in bulk submissions: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'Internal server error',
            'message': str(e)
        }), 500


@external_bp.route('/submissions/<external_id>', methods=['GET'])
@jwt_required()
def get_submission_status(external_id):
    """
    Check if a submission with given external ID exists.

    Query Parameters:
        - source_system: The source system name (default: health_screening)

    Response:
        {
            "exists": true,
            "submission_id": "uuid",
            "external_submission_id": "1203",
            "source_system": "health_screening",
            "status": "submitted",
            "submitted_at": "2026-03-13T10:30:00Z"
        }
    """
    try:
        source_system = request.args.get('source_system', 'health_screening')

        submission = FormSubmission.find_by_external_id(source_system, external_id)

        if not submission:
            return jsonify({
                'exists': False,
                'external_submission_id': external_id,
                'source_system': source_system
            }), 404

        return jsonify({
            'exists': True,
            'submission_id': str(submission.id),
            'external_submission_id': submission.external_submission_id,
            'source_system': submission.source_system,
            'status': submission.submission_status,
            'patient_id': str(submission.patient_id) if submission.patient_id else None,
            'encounter_id': str(submission.encounter_id) if submission.encounter_id else None,
            'submitted_at': submission.submitted_at.isoformat() if submission.submitted_at else None,
            'created_at': submission.created_at.isoformat()
        }), 200

    except Exception as e:
        logger.error(f"Error checking submission status: {str(e)}")
        return jsonify({
            'error': 'Failed to check submission status',
            'message': str(e)
        }), 500


@external_bp.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint for external API.

    Response:
        {
            "status": "healthy",
            "service": "cv_raman_external_api",
            "timestamp": "2026-03-13T10:30:00Z"
        }
    """
    from datetime import datetime
    return jsonify({
        'status': 'healthy',
        'service': 'cv_raman_external_api',
        'version': '1.0.0',
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    }), 200
