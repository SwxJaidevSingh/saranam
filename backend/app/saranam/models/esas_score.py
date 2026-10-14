"""ESAS (Edmonton Symptom Assessment System) Score model for Saranam palliative care."""
from sqlalchemy import Column, String, DateTime, Integer, ForeignKey, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship as db_relationship
from sqlalchemy.sql import func
from app.common.models import BaseModel
from app.extensions import db


class EsasScore(BaseModel):
    """ESAS symptom score recorded during a patient visit."""
    __tablename__ = 'esas_scores'

    # Patient & visit reference
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False)
    visit_id = Column(UUID(as_uuid=True), ForeignKey('patient_visits.id', ondelete='CASCADE'), nullable=False)

    # Standard ESAS symptoms (each 0-10)
    pain = Column(Integer)
    tiredness = Column(Integer)
    nausea = Column(Integer)
    depression = Column(Integer)
    anxiety = Column(Integer)
    drowsiness = Column(Integer)
    appetite = Column(Integer)
    wellbeing = Column(Integer)
    shortness_of_breath = Column(Integer)

    # Optional additional symptom
    other_symptom_name = Column(String(100))
    other_symptom_score = Column(Integer)  # 0-10

    # Aggregate
    total_score = Column(Integer)

    # Recorded by
    recorded_at = Column(DateTime, default=func.now())
    recorded_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))

    # Constraints & indexes
    __table_args__ = (
        UniqueConstraint('visit_id', name='uq_esas_score_visit'),
        Index('ix_esas_scores_patient_id', 'patient_id'),
        Index('ix_esas_scores_visit_id', 'visit_id'),
    )

    # Relationships
    patient = db_relationship('Patient')
    visit = db_relationship('PatientVisit')
    recorder = db_relationship('User', foreign_keys=[recorded_by])

    def to_dict(self):
        """Convert to dictionary."""
        data = super().to_dict()
        data['id'] = str(self.id) if self.id else None
        data['patient_id'] = str(self.patient_id) if self.patient_id else None
        data['visit_id'] = str(self.visit_id) if self.visit_id else None
        data['recorded_by'] = str(self.recorded_by) if self.recorded_by else None
        data['recorded_at'] = self.recorded_at.isoformat() if self.recorded_at else None
        data['created_at'] = self.created_at.isoformat() if self.created_at else None
        data['updated_at'] = self.updated_at.isoformat() if self.updated_at else None
        return data

    def __repr__(self):
        return f'<EsasScore visit={self.visit_id} total={self.total_score}>'
