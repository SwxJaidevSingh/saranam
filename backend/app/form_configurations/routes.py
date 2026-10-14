"""Form configuration routes."""
from flask import Blueprint, request, jsonify
from marshmallow import Schema, fields, ValidationError
from uuid import UUID
from app.auth.decorators import require_role, require_permission
from app.form_configurations.services import FormConfigurationService, ClinicalDocumentationService
from app.form_configurations.models import FormType, DocumentationType

# Create blueprint
form_configs_bp = Blueprint('form_configurations', __name__)


# Validation schemas
class FormConfigurationCreateSchema(Schema):
    """Schema for creating form configuration."""
    facility_id = fields.UUID(allow_none=True)
    service_id = fields.UUID(allow_none=True)
    form_type = fields.Str(required=True)
    form_id = fields.UUID(required=True)
    is_required = fields.Bool(missing=False)
    display_order = fields.Int(allow_none=True)
    is_active = fields.Bool(missing=True)


class FormConfigurationUpdateSchema(Schema):
    """Schema for updating form configuration."""
    form_id = fields.UUID(allow_none=True)
    is_required = fields.Bool(allow_none=True)
    display_order = fields.Int(allow_none=True)
    is_active = fields.Bool(allow_none=True)


class ClinicalDocumentationCreateSchema(Schema):
    """Schema for creating clinical documentation."""
    admission_id = fields.UUID(required=True)
    patient_id = fields.UUID(required=True)
    encounter_id = fields.UUID(required=True)
    documentation_type = fields.Str(required=True)
    form_submission_id = fields.UUID(allow_none=True)
    documented_by = fields.UUID(allow_none=True)
    notes = fields.Str(allow_none=True)


@form_configs_bp.route('', methods=['GET'])
@require_permission('view_form')
def get_configurations():
    """Get form configurations with optional filters."""
    facility_id = request.args.get('facility_id', type=str)
    service_id = request.args.get('service_id', type=str)
    form_type = request.args.get('form_type', type=str)
    is_active = request.args.get('is_active', 'true').lower() == 'true'

    # Convert string UUIDs to UUID objects
    if facility_id:
        try:
            facility_id = UUID(facility_id)
        except ValueError:
            return jsonify({'message': 'Invalid facility_id format'}), 400

    if service_id:
        try:
            service_id = UUID(service_id)
        except ValueError:
            return jsonify({'message': 'Invalid service_id format'}), 400

    configs = FormConfigurationService.get_configurations(
        facility_id=facility_id,
        service_id=service_id,
        form_type=form_type,
        is_active=is_active
    )

    return jsonify({
        'configurations': [config.to_dict() for config in configs],
        'total': len(configs)
    }), 200


@form_configs_bp.route('/<uuid:config_id>', methods=['GET'])
@require_permission('view_form')
def get_configuration(config_id):
    """Get form configuration by ID."""
    config, message = FormConfigurationService.get_configuration_by_id(config_id)

    if not config:
        return jsonify({'message': message, 'error': 'not_found'}), 404

    return jsonify({'configuration': config.to_dict()}), 200


@form_configs_bp.route('/for-service/<uuid:service_id>', methods=['GET'])
@require_permission('view_form')
def get_form_for_service(service_id):
    """
    Get the appropriate form for a service with fallback logic.

    Query params:
    - form_type: required (ADMISSION, DISCHARGE, PROGRESS_NOTE, NURSING_ASSESSMENT)
    - facility_id: optional (for facility-level fallback)
    """
    form_type = request.args.get('form_type', type=str)
    if not form_type:
        return jsonify({'message': 'form_type is required'}), 400

    facility_id = request.args.get('facility_id', type=str)
    if facility_id:
        try:
            facility_id = UUID(facility_id)
        except ValueError:
            return jsonify({'message': 'Invalid facility_id format'}), 400

    config = FormConfigurationService.get_form_for_service(
        service_id=service_id,
        form_type=form_type,
        facility_id=facility_id
    )

    if not config:
        return jsonify({
            'message': 'No form configuration found',
            'error': 'not_found'
        }), 404

    return jsonify({
        'configuration': config.to_dict(),
        'form': config.form.to_dict() if config.form else None
    }), 200


@form_configs_bp.route('', methods=['POST'])
@require_role('admin')
def create_configuration():
    """Create a new form configuration."""
    schema = FormConfigurationCreateSchema()
    try:
        data = schema.load(request.json)
    except ValidationError as e:
        return jsonify({'message': 'Validation error', 'errors': e.messages}), 400

    config, message = FormConfigurationService.create_configuration(
        form_type=data['form_type'],
        form_id=data['form_id'],
        facility_id=data.get('facility_id'),
        service_id=data.get('service_id'),
        is_required=data.get('is_required', False),
        display_order=data.get('display_order'),
        is_active=data.get('is_active', True)
    )

    if not config:
        return jsonify({'message': message, 'error': 'creation_failed'}), 400

    return jsonify({
        'message': message,
        'configuration': config.to_dict()
    }), 201


@form_configs_bp.route('/<uuid:config_id>', methods=['PUT', 'PATCH'])
@require_role('admin')
def update_configuration(config_id):
    """Update form configuration."""
    schema = FormConfigurationUpdateSchema()
    try:
        data = schema.load(request.json)
    except ValidationError as e:
        return jsonify({'message': 'Validation error', 'errors': e.messages}), 400

    config, message = FormConfigurationService.update_configuration(
        config_id=config_id,
        form_id=data.get('form_id'),
        is_required=data.get('is_required'),
        display_order=data.get('display_order'),
        is_active=data.get('is_active')
    )

    if not config:
        return jsonify({'message': message, 'error': 'update_failed'}), 400

    return jsonify({
        'message': message,
        'configuration': config.to_dict()
    }), 200


@form_configs_bp.route('/<uuid:config_id>', methods=['DELETE'])
@require_role('admin')
def delete_configuration(config_id):
    """Delete form configuration."""
    success, message = FormConfigurationService.delete_configuration(config_id)

    if not success:
        return jsonify({'message': message, 'error': 'deletion_failed'}), 400

    return jsonify({'message': message}), 200


# Clinical Documentation endpoints
@form_configs_bp.route('/clinical-documentation', methods=['POST'])
@require_permission('submit_form')
def create_clinical_documentation():
    """Create clinical documentation."""
    schema = ClinicalDocumentationCreateSchema()
    try:
        data = schema.load(request.json)
    except ValidationError as e:
        return jsonify({'message': 'Validation error', 'errors': e.messages}), 400

    doc, message = ClinicalDocumentationService.create_documentation(
        admission_id=data['admission_id'],
        patient_id=data['patient_id'],
        encounter_id=data['encounter_id'],
        documentation_type=data['documentation_type'],
        form_submission_id=data.get('form_submission_id'),
        documented_by=data.get('documented_by'),
        notes=data.get('notes')
    )

    if not doc:
        return jsonify({'message': message, 'error': 'creation_failed'}), 400

    return jsonify({
        'message': message,
        'documentation': doc.to_dict()
    }), 201


@form_configs_bp.route('/clinical-documentation/admission/<uuid:admission_id>', methods=['GET'])
@require_permission('view_form')
def get_clinical_documentation_for_admission(admission_id):
    """Get all clinical documentation for an admission."""
    documentation_type = request.args.get('documentation_type', type=str)

    docs = ClinicalDocumentationService.get_documentation_for_admission(
        admission_id=admission_id,
        documentation_type=documentation_type
    )

    return jsonify({
        'documentation': [doc.to_dict() for doc in docs],
        'total': len(docs)
    }), 200


@form_configs_bp.route('/clinical-documentation/<uuid:doc_id>', methods=['GET'])
@require_permission('view_form')
def get_clinical_documentation(doc_id):
    """Get clinical documentation by ID."""
    doc, message = ClinicalDocumentationService.get_documentation_by_id(doc_id)

    if not doc:
        return jsonify({'message': message, 'error': 'not_found'}), 404

    return jsonify({'documentation': doc.to_dict()}), 200
