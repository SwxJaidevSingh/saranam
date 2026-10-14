"""Doctor Assessment model for Saranam palliative care."""
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship as db_relationship
from sqlalchemy.sql import func
from app.common.models import BaseModel
from app.extensions import db


class DoctorAssessment(BaseModel):
    """Doctor assessment recorded during a patient visit."""
    __tablename__ = 'doctor_assessments'

    # Patient & visit reference
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False)
    visit_id = Column(UUID(as_uuid=True), ForeignKey('patient_visits.id', ondelete='CASCADE'), nullable=False)

    # Clinical
    diagnosis = Column(Text)
    hpe_report = Column(Text)
    chief_complaints = Column(Text)
    history_of_presenting_illness = Column(Text)

    # History
    comorbidities = Column(Text)
    medication_history = Column(Text)
    previous_investigations = Column(Text)
    family_history = Column(Text)
    
    # Investigations
    investigation_panels = Column(JSONB, default={})
    investigation_others = Column(JSONB, default=[])
    investigation_notes = Column(Text)

    # Functional
    diet = Column(String(50))
    appetite = Column(String(20))
    bowel = Column(Text)
    bladder = Column(Text)
    habits = Column(Text)

    # Examination
    exam_respiratory = Column(Text)
    exam_cardiovascular = Column(Text)
    exam_per_abdomen = Column(Text)
    exam_cns = Column(Text)

    # Notes
    doctor_notes = Column(Text)

    # AI-generated visit summary (clinician-edited).
    ai_summary = Column(Text)

    # Body map
    body_map_front_url = Column(Text)
    body_map_back_url = Column(Text)
    body_map_annotations = Column(JSONB)

    # Assessed by
    assessed_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    assessed_at = Column(DateTime, default=func.now())

    # Constraints & indexes
    __table_args__ = (
        UniqueConstraint('visit_id', name='uq_doctor_assessment_visit'),
        Index('ix_doctor_assessments_patient_id', 'patient_id'),
        Index('ix_doctor_assessments_visit_id', 'visit_id'),
    )

    # Relationships
    patient = db_relationship('Patient')
    visit = db_relationship('PatientVisit')
    assessor = db_relationship('User', foreign_keys=[assessed_by])

    def to_dict(self):
        """Convert to dictionary."""
        data = super().to_dict()
        data['id'] = str(self.id) if self.id else None
        data['patient_id'] = str(self.patient_id) if self.patient_id else None
        data['visit_id'] = str(self.visit_id) if self.visit_id else None
        data['assessed_by'] = str(self.assessed_by) if self.assessed_by else None
        data['assessed_at'] = self.assessed_at.isoformat() if self.assessed_at else None
        data['created_at'] = self.created_at.isoformat() if self.created_at else None
        data['updated_at'] = self.updated_at.isoformat() if self.updated_at else None
        return data

    def __repr__(self):
        return f'<DoctorAssessment visit={self.visit_id}>'
