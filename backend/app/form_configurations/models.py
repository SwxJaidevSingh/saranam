"""Form configuration models for dynamic clinical forms."""
from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, Text, DateTime, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.common.models import BaseModel
import enum


class FormType(str, enum.Enum):
    """Enum for form types."""
    ADMISSION = 'ADMISSION'
    DISCHARGE = 'DISCHARGE'
    PROGRESS_NOTE = 'PROGRESS_NOTE'
    NURSING_ASSESSMENT = 'NURSING_ASSESSMENT'


class DocumentationType(str, enum.Enum):
    """Enum for clinical documentation types."""
    PROGRESS_NOTE = 'PROGRESS_NOTE'
    NURSING_ASSESSMENT = 'NURSING_ASSESSMENT'
    CONSULTATION_NOTE = 'CONSULTATION_NOTE'
    PROCEDURE_NOTE = 'PROCEDURE_NOTE'


class FormConfiguration(BaseModel):
    """
    Form configuration model for linking forms to facilities/departments.

    Supports flexible configuration:
    - Facility-level: facility_id set, service_id is NULL
    - Service-level: both facility_id and service_id set
    - Global: both facility_id and service_id are NULL
    """
    __tablename__ = 'form_configurations'

    facility_id = Column(UUID(as_uuid=True), nullable=True, index=True)  # No FK constraint until Facility model exists
    service_id = Column(UUID(as_uuid=True), ForeignKey('services.id', ondelete='CASCADE'), nullable=True, index=True)
    form_type = Column(String(50), nullable=False, index=True)
    form_id = Column(UUID(as_uuid=True), ForeignKey('forms.id', ondelete='CASCADE'), nullable=False, index=True)
    is_required = Column(Boolean, default=False, nullable=False)
    display_order = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)

    # Relationships
    form = relationship('Form', backref='form_configurations', lazy='joined')
    service = relationship('Service', backref='form_configurations', lazy='joined')

    def __repr__(self):
        """String representation."""
        scope = "global"
        if self.service_id:
            scope = f"service:{self.service_id}"
        elif self.facility_id:
            scope = f"facility:{self.facility_id}"
        return f'<FormConfiguration {self.form_type} for {scope}>'


class ClinicalDocumentation(BaseModel):
    """
    Clinical documentation model for progress notes and nursing assessments.
    Links form submissions to admissions for clinical documentation.
    """
    __tablename__ = 'clinical_documentation'

    admission_id = Column(UUID(as_uuid=True), ForeignKey('ipd_admissions.id', ondelete='CASCADE'), nullable=False, index=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True)
    encounter_id = Column(UUID(as_uuid=True), ForeignKey('encounters.id', ondelete='CASCADE'), nullable=False, index=True)
    documentation_type = Column(String(50), nullable=False, index=True)
    form_submission_id = Column(UUID(as_uuid=True), ForeignKey('form_submissions.id'), nullable=True)
    documented_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)
    documented_at = Column(DateTime, nullable=False, index=True)
    notes = Column(Text, nullable=True)

    # Relationships
    admission = relationship('IPDAdmission', backref='clinical_documentation', lazy='joined')
    patient = relationship('Patient', backref='clinical_documentation', lazy='joined')
    encounter = relationship('Encounter', backref='clinical_documentation', lazy='joined')
    form_submission = relationship('FormSubmission', backref='clinical_documentation', lazy='joined')
    documenter = relationship('User', backref='clinical_documentation', lazy='joined')

    def __repr__(self):
        """String representation."""
        return f'<ClinicalDocumentation {self.documentation_type} for admission {self.admission_id}>'
