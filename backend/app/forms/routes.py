"""Forms routes."""
from flask import Blueprint, request, jsonify
from marshmallow import Schema, fields, ValidationError
from app.auth.decorators import require_role, require_permission
from app.forms.services import FormService

# Create blueprint
forms_bp = Blueprint('forms', __name__)


# Validation schemas
class FormSchema(Schema):
    """Form validation schema."""
    name = fields.Str(required=True, validate=lambda x: len(x) >= 1)
    description = fields.Str(missing='')
    schema = fields.Dict(required=True)
    is_template = fields.Bool(missing=False)
    template_category = fields.Str(allow_none=True, missing=None)


class UpdateFormSchema(Schema):
    """Form update validation schema."""
    name = fields.Str()
    description = fields.Str()
    schema = fields.Dict()
    is_template = fields.Bool()
    template_category = fields.Str(allow_none=True)


@forms_bp.route('', methods=['GET'])
@require_permission('view_form')
def get_forms():
    """Get list of forms."""
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 50, type=int), 100)
    active_only = request.args.get('active_only', 'true').lower() == 'true'

    # Template filtering
    is_template = None
    if 'is_template' in request.args:
        is_template = request.args.get('is_template', 'false').lower() == 'true'

    template_category = request.args.get('template_category', None)

    result = FormService.get_forms(page, per_page, active_only, is_template, template_category)
    return jsonify(result), 200


@forms_bp.route('/<uuid:form_id>', methods=['GET'])
@require_permission('view_form')
def get_form(form_id):
    """Get form by ID."""
    form, message = FormService.get_form_by_id(form_id)

    if not form:
        return jsonify({'message': message, 'error': 'not_found'}), 404

    return jsonify({'form': form.to_dict()}), 200


@forms_bp.route('', methods=['POST'])
@require_role('admin')
def create_form():
    """Create a new form."""
    schema = FormSchema()
    try:
        data = schema.load(request.json)
    except ValidationError as e:
        return jsonify({'message': 'Validation error', 'errors': e.messages}), 400

    form, message = FormService.create_form(
        name=data['name'],
        description=data['description'],
        schema=data['schema'],
        is_template=data.get('is_template', False),
        template_category=data.get('template_category', None)
    )

    if not form:
        return jsonify({'message': message, 'error': 'creation_failed'}), 400

    return jsonify({'message': message, 'form': form.to_dict()}), 201


@forms_bp.route('/<uuid:form_id>', methods=['PUT', 'PATCH'])
@require_role('admin')
def update_form(form_id):
    """Update existing form."""
    schema = UpdateFormSchema()
    try:
        data = schema.load(request.json)
    except ValidationError as e:
        return jsonify({'message': 'Validation error', 'errors': e.messages}), 400

    form, message = FormService.update_form(
        form_id,
        name=data.get('name'),
        description=data.get('description'),
        schema=data.get('schema'),
        is_template=data.get('is_template'),
        template_category=data.get('template_category')
    )

    if not form:
        return jsonify({'message': message, 'error': 'update_failed'}), 400

    return jsonify({'message': message, 'form': form.to_dict()}), 200


@forms_bp.route('/<uuid:form_id>', methods=['DELETE'])
@require_role('admin')
def delete_form(form_id):
    """Delete (soft) a form."""
    success, message = FormService.delete_form(form_id)

    if not success:
        return jsonify({'message': message, 'error': 'deletion_failed'}), 400

    return jsonify({'message': message}), 200


@forms_bp.route('/<uuid:form_id>/clone', methods=['POST'])
@require_role('admin')
def clone_form(form_id):
    """Clone an existing form."""
    new_name = request.json.get('name')
    if not new_name:
        return jsonify({'message': 'New name is required', 'error': 'validation_error'}), 400

    form, message = FormService.clone_form(form_id, new_name)

    if not form:
        return jsonify({'message': message, 'error': 'clone_failed'}), 400

    return jsonify({'message': message, 'form': form.to_dict()}), 201


@forms_bp.route('/<uuid:form_id>/share', methods=['POST'])
@require_permission('create_form')
def enable_form_sharing(form_id):
    """Enable public access for a form and generate share token."""
    success, result = FormService.enable_form_sharing(form_id)

    if not success:
        return jsonify({'message': result, 'error': 'sharing_failed'}), 400

    return jsonify({'message': 'Form sharing enabled', 'share_token': result['share_token'], 'share_url': result['share_url']}), 200


@forms_bp.route('/<uuid:form_id>/share', methods=['DELETE'])
@require_permission('create_form')
def disable_form_sharing(form_id):
    """Disable public access for a form."""
    success, message = FormService.disable_form_sharing(form_id)

    if not success:
        return jsonify({'message': message, 'error': 'sharing_failed'}), 400

    return jsonify({'message': message}), 200