"""Forms services."""
from app.extensions import db
from app.forms.models import Form
from app.auth.decorators import get_current_user


class FormService:
    """Form management service."""

    @staticmethod
    def create_form(name, description, schema, is_template=False, template_category=None):
        """Create a new form."""
        # Validate schema
        form = Form(
            name=name,
            description=description,
            schema=schema,
            is_template=is_template,
            template_category=template_category
        )

        is_valid, message = form.validate_schema()
        if not is_valid:
            return None, message

        # Get current user
        current_user = get_current_user()
        if current_user:
            form.created_by = current_user.id

        try:
            db.session.add(form)
            db.session.commit()
            return form, "Form created successfully"
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def get_forms(page=1, per_page=50, active_only=True, is_template=None, template_category=None):
        """Get paginated list of forms."""
        query = Form.query
        if active_only:
            query = query.filter_by(is_active=True)

        # Filter by template status
        if is_template is not None:
            query = query.filter_by(is_template=is_template)

        # Filter by template category
        if template_category:
            query = query.filter_by(template_category=template_category)

        paginated = query.order_by(Form.created_at.desc()).paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )

        return {
            'forms': [form.to_dict() for form in paginated.items],
            'total': paginated.total,
            'pages': paginated.pages,
            'current_page': page
        }

    @staticmethod
    def get_form_by_id(form_id):
        """Get form by ID."""
        form = Form.query.get(form_id)
        if not form:
            return None, "Form not found"
        return form, "Form found"

    @staticmethod
    def update_form(form_id, name=None, description=None, schema=None, is_template=None, template_category=None):
        """Update existing form."""
        form = Form.query.get(form_id)
        if not form:
            return None, "Form not found"

        if name:
            form.name = name
        if description is not None:
            form.description = description
        if schema:
            form.schema = schema
            is_valid, message = form.validate_schema()
            if not is_valid:
                return None, message
            form.version += 1
        if is_template is not None:
            form.is_template = is_template
        if template_category is not None:
            form.template_category = template_category

        try:
            db.session.commit()
            return form, "Form updated successfully"
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def delete_form(form_id):
        """Soft delete a form."""
        form = Form.query.get(form_id)
        if not form:
            return False, "Form not found"

        form.is_active = False
        try:
            db.session.commit()
            return True, "Form deleted successfully"
        except Exception as e:
            db.session.rollback()
            return False, str(e)

    @staticmethod
    def clone_form(form_id, new_name):
        """Clone an existing form."""
        original = Form.query.get(form_id)
        if not original:
            return None, "Original form not found"

        cloned = Form(
            name=new_name,
            description=f"Cloned from {original.name}",
            schema=original.schema
        )

        current_user = get_current_user()
        if current_user:
            cloned.created_by = current_user.id

        try:
            db.session.add(cloned)
            db.session.commit()
            return cloned, "Form cloned successfully"
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def enable_form_sharing(form_id):
        """Enable public access and generate share token."""
        from flask import request
        form = Form.query.get(form_id)
        if not form:
            return False, "Form not found"

        # Check permissions
        current_user = get_current_user()
        if not current_user or (current_user.id != form.created_by and current_user.role != 'admin'):
            return False, "Access denied"

        try:
            share_token = form.enable_public_access()
            db.session.commit()

            # Generate share URL
            base_url = request.host_url.rstrip('/')
            share_url = f"{base_url}/public/forms/{share_token}"

            return True, {
                'share_token': share_token,
                'share_url': share_url
            }
        except Exception as e:
            db.session.rollback()
            return False, str(e)

    @staticmethod
    def disable_form_sharing(form_id):
        """Disable public access."""
        form = Form.query.get(form_id)
        if not form:
            return False, "Form not found"

        # Check permissions
        current_user = get_current_user()
        if not current_user or (current_user.id != form.created_by and current_user.role != 'admin'):
            return False, "Access denied"

        try:
            form.disable_public_access()
            db.session.commit()
            return True, "Form sharing disabled"
        except Exception as e:
            db.session.rollback()
            return False, str(e)

    @staticmethod
    def get_form_by_token(share_token):
        """Get a public form by its share token."""
        form = Form.query.filter_by(share_token=share_token, is_public=True, is_active=True).first()
        if not form:
            return None, "Form not found or not publicly accessible"
        return form, "Form found"