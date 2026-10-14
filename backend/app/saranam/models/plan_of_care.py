"""Plan of Care model for Saranam palliative care."""
from sqlalchemy import Column, Text, ForeignKey, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship as db_relationship
from app.common.models import BaseModel
from app.extensions import db


class PlanOfCare(BaseModel):
    """Plan of care created during a patient visit."""
    __tablename__ = 'plans_of_care'

    # Patient & visit reference
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False)
    visit_id = Column(UUID(as_uuid=True), ForeignKey('patient_visits.id', ondelete='CASCADE'), nullable=False)

    # Diagnosis context for the prescription (entered in the Plan of Care form).
    # The UI sends/reads these exact keys (icd10_diagnosis, diagnosis_text).
    icd10_diagnosis = Column(Text)
    diagnosis_text = Column(Text)

    # Interventions
    intervention_non_pharmacological = Column(Text)
    intervention_pharmacological = Column(Text)
    follow_up_notes = Column(Text)

    # Medications
    medications = Column(JSONB)

    # Created by
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))

    # Constraints & indexes
    __table_args__ = (
        UniqueConstraint('visit_id', name='uq_plan_of_care_visit'),
        Index('ix_plans_of_care_patient_id', 'patient_id'),
        Index('ix_plans_of_care_visit_id', 'visit_id'),
    )

    # Relationships
    patient = db_relationship('Patient')
    visit = db_relationship('PatientVisit')
    creator = db_relationship('User', foreign_keys=[created_by])

    def to_dict(self):
        """Convert to dictionary."""
        data = super().to_dict()
        data['id'] = str(self.id) if self.id else None
        data['patient_id'] = str(self.patient_id) if self.patient_id else None
        data['visit_id'] = str(self.visit_id) if self.visit_id else None
        data['created_by'] = str(self.created_by) if self.created_by else None
        data['created_at'] = self.created_at.isoformat() if self.created_at else None
        data['updated_at'] = self.updated_at.isoformat() if self.updated_at else None
        return data

    def __repr__(self):
        return f'<PlanOfCare visit={self.visit_id}>'
