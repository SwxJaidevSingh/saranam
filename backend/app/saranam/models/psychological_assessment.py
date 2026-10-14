"""Psychological Assessment model for Saranam palliative care."""
from sqlalchemy import Column, Text, DateTime, Integer, ForeignKey, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship as db_relationship
from sqlalchemy.sql import func
from app.common.models import BaseModel
from app.extensions import db


class PsychologicalAssessment(BaseModel):
    """Psychological assessment recorded during a patient visit."""
    __tablename__ = 'psychological_assessments'

    # Patient & visit reference
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False)
    visit_id = Column(UUID(as_uuid=True), ForeignKey('patient_visits.id', ondelete='CASCADE'), nullable=False)

    # Patient psychological state
    patient_mood = Column(Text)
    patient_sleep = Column(Text)
    patient_disease_concerns = Column(Text)
    family_disease_concerns = Column(Text)

    # Problem domains
    problems_physical = Column(JSONB)
    problems_emotional = Column(JSONB)
    problems_social = Column(JSONB)
    problems_practical = Column(JSONB)
    problems_spiritual = Column(JSONB)

    # Distress
    distress_score = Column(Integer)  # 0-10

    # Family / caregiver
    family_support_notes = Column(Text)
    caregiver_mood = Column(Text)
    caregiver_burden = Column(Text)
    caregiver_concerns_about_patient = Column(Text)
    caregiver_personal_concerns = Column(Text)

    # Zarit Burden Interview (short form)
    zarit_q1_stress = Column(Integer)  # 0-4
    zarit_q2_time = Column(Integer)  # 0-4
    zarit_q3_strain = Column(Integer)  # 0-4
    zarit_q4_uncertain = Column(Integer)  # 0-4
    zarit_total_score = Column(Integer)

    # Notes
    remarks = Column(Text)

    # AI-generated visit summary (clinician-edited).
    ai_summary = Column(Text)

    # Assessed by
    assessed_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    assessed_at = Column(DateTime, default=func.now())

    # Constraints & indexes
    __table_args__ = (
        UniqueConstraint('visit_id', name='uq_psychological_assessment_visit'),
        Index('ix_psychological_assessments_patient_id', 'patient_id'),
        Index('ix_psychological_assessments_visit_id', 'visit_id'),
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
        return f'<PsychologicalAssessment visit={self.visit_id}>'
