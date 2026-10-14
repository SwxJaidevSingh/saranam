"""PPS (Palliative Performance Scale) Score model for Saranam palliative care."""
from sqlalchemy import Column, String, Text, DateTime, Integer, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship as db_relationship
from sqlalchemy.sql import func
from app.common.models import BaseModel
from app.extensions import db


class PpsScore(BaseModel):
    """Palliative Performance Scale score recorded during a patient visit."""
    __tablename__ = 'pps_scores'

    # Patient & visit reference.
    # visit_id is NULLABLE — PPS can be recorded at the patient level (without
    # a visit context) from the universal PpsCard. When set, the entry is
    # associated with that visit; when null, it's a standalone patient-level
    # entry. Uniqueness is NOT enforced on visit_id (a visit may be
    # re-assessed, producing multiple PPS rows).
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False)
    visit_id = Column(UUID(as_uuid=True), ForeignKey('patient_visits.id', ondelete='CASCADE'), nullable=True)

    # PPS score (0-100, multiples of 10)
    pps_score = Column(Integer)

    # PPS dimensions
    ambulation = Column(String(100))
    activity_level = Column(String(255))
    self_care = Column(String(100))
    intake = Column(String(100))
    consciousness_level = Column(String(100))

    # Prognosis
    estimated_survival_days = Column(Integer)

    # Notes
    notes = Column(Text)

    # Recorded by
    recorded_at = Column(DateTime, default=func.now())
    recorded_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))

    # Constraints & indexes
    __table_args__ = (
        Index('ix_pps_scores_patient_id', 'patient_id'),
        Index('ix_pps_scores_visit_id', 'visit_id'),
        Index('ix_pps_scores_patient_recorded_at', 'patient_id', 'recorded_at'),
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
        return f'<PpsScore visit={self.visit_id} score={self.pps_score}>'
