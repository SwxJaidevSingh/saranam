"""Social History Assessment model for Saranam palliative care."""
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship as db_relationship
from sqlalchemy.sql import func
from app.common.models import BaseModel
from app.extensions import db


class SocialHistoryAssessment(BaseModel):
    """Social history recorded during a patient visit (typically baseline)."""
    __tablename__ = 'social_history_assessments'

    # Patient & visit reference
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False)
    visit_id = Column(UUID(as_uuid=True), ForeignKey('patient_visits.id', ondelete='CASCADE'), nullable=False)

    # Social History
    source_of_income = Column(Text)
    socioeconomic_status = Column(Text)
    living_condition = Column(Text)
    social_burden = Column(Text)
    health_insurance = Column(Text)

    # Insight & Prognosis
    insight_patient_diagnosis = Column(Text)
    insight_patient_prognosis = Column(Text)
    insight_family_diagnosis = Column(Text)
    insight_family_prognosis = Column(Text)

    # Social Issues
    social_issues = Column(Text)

    # Assessed by
    assessed_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    assessed_at = Column(DateTime, default=func.now())

    # Constraints & indexes
    __table_args__ = (
        UniqueConstraint('visit_id', name='uq_social_history_assessment_visit'),
        Index('ix_social_history_assessments_patient_id', 'patient_id'),
        Index('ix_social_history_assessments_visit_id', 'visit_id'),
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
        return f'<SocialHistoryAssessment visit={self.visit_id}>'