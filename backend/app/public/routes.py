"""Public routes for form access without authentication."""
from flask import Blueprint, request, jsonify
from marshmallow import Schema, fields, ValidationError
from app.forms.services import FormService
from app.submissions.models import FormSubmission
from app.extensions import db

# Backward compatibility alias
Submission = FormSubmission

# Create blueprint
public_bp = Blueprint('public', __name__)


class PublicSubmissionSchema(Schema):
    """Public submission validation schema."""
    data = fields.Dict(required=True)
    submitted_by_name = fields.Str(required=False)
    submitted_by_email = fields.Email(required=False)


@public_bp.route('/forms/<string:share_token>', methods=['GET'])
def get_public_form(share_token):
    """Get a publicly shared form by its token."""
    form, message = FormService.get_form_by_token(share_token)

    if not form:
        return jsonify({'message': message, 'error': 'not_found'}), 404

    # Return minimal form data (exclude sensitive info)
    return jsonify({
        'form': {
            'id': str(form.id),
            'name': form.name,
            'description': form.description,
            'schema': form.schema,
            'is_public': form.is_public
        }
    }), 200


@public_bp.route('/forms/<string:share_token>/submit', methods=['POST'])
def submit_public_form(share_token):
    """Submit a response to a publicly shared form."""
    # Validate request
    schema = PublicSubmissionSchema()
    try:
        submission_data = schema.load(request.json)
    except ValidationError as e:
        return jsonify({'message': 'Validation error', 'errors': e.messages}), 400

    # Get form by token
    form, message = FormService.get_form_by_token(share_token)
    if not form:
        return jsonify({'message': message, 'error': 'not_found'}), 404

    # Create submission
    submission = Submission(
        form_id=form.id,
        data=submission_data['data'],
        submitted_by=None,  # Anonymous submission
        status='submitted'
    )

    # Store optional submitter info in metadata
    if 'submitted_by_name' in submission_data or 'submitted_by_email' in submission_data:
        submission.data['_submitter_info'] = {
            'name': submission_data.get('submitted_by_name'),
            'email': submission_data.get('submitted_by_email')
        }

    # Validate submission
    is_valid, validation_result = submission.validate_against_form()
    if not is_valid:
        return jsonify({'message': 'Validation failed', 'errors': validation_result}), 400

    try:
        db.session.add(submission)
        db.session.commit()
        return jsonify({
            'message': 'Submission successful',
            'submission_id': str(submission.id)
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': 'Submission failed', 'error': str(e)}), 500


@public_bp.route('/forms/<string:share_token>/check', methods=['GET'])
def check_form_availability(share_token):
    """Check if a form is publicly available."""
    form, message = FormService.get_form_by_token(share_token)

    if not form:
        return jsonify({'available': False, 'message': message}), 404

    return jsonify({
        'available': True,
        'form_name': form.name
    }), 200
