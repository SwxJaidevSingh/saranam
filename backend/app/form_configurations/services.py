"""Form configuration services."""
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy import and_, or_
from app.extensions import db
from app.form_configurations.models import FormConfiguration, ClinicalDocumentation, FormType
from app.forms.models import Form


class FormConfigurationService:
    """Service for managing form configurations."""

    @staticmethod
    def create_configuration(
        form_type: str,
        form_id: UUID,
        facility_id: Optional[UUID] = None,
        service_id: Optional[UUID] = None,
        is_required: bool = False,
        display_order: Optional[int] = None,
        is_active: bool = True
    ):
        """Create a new form configuration."""
        # Validate form exists
        form = Form.query.get(form_id)
        if not form:
            return None, "Form not found"

        # Validate form type
        try:
            FormType(form_type)
        except ValueError:
            return None, f"Invalid form type: {form_type}"

        # Create configuration
        config = FormConfiguration(
            facility_id=facility_id,
            service_id=service_id,
            form_type=form_type,
            form_id=form_id,
            is_required=is_required,
            display_order=display_order,
            is_active=is_active
        )

        try:
            db.session.add(config)
            db.session.commit()
            return config, "Form configuration created successfully"
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def get_configurations(
        facility_id: Optional[UUID] = None,
        service_id: Optional[UUID] = None,
        form_type: Optional[str] = None,
        is_active: bool = True
    ) -> List[FormConfiguration]:
        """Get form configurations with filters."""
        query = FormConfiguration.query

        if is_active:
            query = query.filter_by(is_active=True)

        if facility_id:
            query = query.filter_by(facility_id=facility_id)

        if service_id:
            query = query.filter_by(service_id=service_id)

        if form_type:
            query = query.filter_by(form_type=form_type)

        return query.order_by(FormConfiguration.display_order, FormConfiguration.created_at).all()

    @staticmethod
    def get_configuration_by_id(config_id: UUID):
        """Get form configuration by ID."""
        config = FormConfiguration.query.get(config_id)
        if not config:
            return None, "Form configuration not found"
        return config, "Configuration found"

    @staticmethod
    def get_form_for_service(
        service_id: UUID,
        form_type: str,
        facility_id: Optional[UUID] = None
    ) -> Optional[FormConfiguration]:
        """
        Get the appropriate form for a service with fallback logic.

        Resolution order:
        1. Service-specific configuration
        2. Facility-level configuration
        3. Global configuration
        """
        # Try service-specific first
        config = FormConfiguration.query.filter_by(
            service_id=service_id,
            form_type=form_type,
            is_active=True
        ).first()

        if config:
            return config

        # Try facility-level if facility_id provided
        if facility_id:
            config = FormConfiguration.query.filter_by(
                facility_id=facility_id,
                service_id=None,
                form_type=form_type,
                is_active=True
            ).first()

            if config:
                return config

        # Try global configuration
        config = FormConfiguration.query.filter_by(
            facility_id=None,
            service_id=None,
            form_type=form_type,
            is_active=True
        ).first()

        return config

    @staticmethod
    def update_configuration(
        config_id: UUID,
        form_id: Optional[UUID] = None,
        is_required: Optional[bool] = None,
        display_order: Optional[int] = None,
        is_active: Optional[bool] = None
    ):
        """Update existing form configuration."""
        config = FormConfiguration.query.get(config_id)
        if not config:
            return None, "Form configuration not found"

        if form_id:
            # Validate form exists
            form = Form.query.get(form_id)
            if not form:
                return None, "Form not found"
            config.form_id = form_id

        if is_required is not None:
            config.is_required = is_required

        if display_order is not None:
            config.display_order = display_order

        if is_active is not None:
            config.is_active = is_active

        try:
            db.session.commit()
            return config, "Form configuration updated successfully"
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def delete_configuration(config_id: UUID):
        """Delete a form configuration."""
        config = FormConfiguration.query.get(config_id)
        if not config:
            return False, "Form configuration not found"

        try:
            db.session.delete(config)
            db.session.commit()
            return True, "Form configuration deleted successfully"
        except Exception as e:
            db.session.rollback()
            return False, str(e)


class ClinicalDocumentationService:
    """Service for managing clinical documentation."""

    @staticmethod
    def create_documentation(
        admission_id: UUID,
        patient_id: UUID,
        encounter_id: UUID,
        documentation_type: str,
        documented_by: Optional[UUID] = None,
        form_submission_id: Optional[UUID] = None,
        notes: Optional[str] = None
    ):
        """Create clinical documentation."""
        doc = ClinicalDocumentation(
            admission_id=admission_id,
            patient_id=patient_id,
            encounter_id=encounter_id,
            documentation_type=documentation_type,
            form_submission_id=form_submission_id,
            documented_by=documented_by,
            documented_at=datetime.utcnow(),
            notes=notes
        )

        try:
            db.session.add(doc)
            db.session.commit()
            return doc, "Clinical documentation created successfully"
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def get_documentation_for_admission(
        admission_id: UUID,
        documentation_type: Optional[str] = None
    ) -> List[ClinicalDocumentation]:
        """Get all clinical documentation for an admission."""
        query = ClinicalDocumentation.query.filter_by(admission_id=admission_id)

        if documentation_type:
            query = query.filter_by(documentation_type=documentation_type)

        return query.order_by(ClinicalDocumentation.documented_at.desc()).all()

    @staticmethod
    def get_documentation_by_id(doc_id: UUID):
        """Get clinical documentation by ID."""
        doc = ClinicalDocumentation.query.get(doc_id)
        if not doc:
            return None, "Clinical documentation not found"
        return doc, "Documentation found"
