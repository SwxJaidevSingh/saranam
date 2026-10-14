"""Physiotherapy Assessment model for Saranam palliative care."""
from sqlalchemy import Column, String, Text, DateTime, Integer, ForeignKey, UniqueConstraint, Index, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship as db_relationship
from sqlalchemy.sql import func
from app.common.models import BaseModel
from app.extensions import db


class PhysiotherapyAssessment(BaseModel):
    """Physiotherapy assessment recorded during a patient visit."""
    __tablename__ = 'physiotherapy_assessments'

    # Patient & visit reference
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False)
    visit_id = Column(UUID(as_uuid=True), ForeignKey('patient_visits.id', ondelete='CASCADE'), nullable=False)

    # Pain
    pain_vas_score = Column(Integer)  # 0-10
    pain_area = Column(Text)
    pain_nature = Column(Text)

    # Observation
    obs_built = Column(String(20))
    obs_posture = Column(Text)
    obs_swelling = Column(Text)
    obs_deformity = Column(Text)
    obs_wasting = Column(Text)

    # Palpation
    palp_tenderness = Column(Text)

    # Lymphedema
    palp_lymphedema_present = Column(Boolean)
    palp_lymphedema_site = Column(Text)
    palp_lymphedema_measurements = Column(Text)
    palp_lymphedema_pain = Column(Boolean)
    palp_scar = Column(Text)

    # Examination
    exam_rom = Column(Text)
    exam_mmt = Column(Text)
    exam_tone = Column(Text)
    exam_balance = Column(Text)
    general_examination = Column(Text)
    exam_local_status = Column(Text)
    sys_examination = Column(Text)
    exam_functional_status = Column(Text)

    # Notes
    physio_notes = Column(Text)

    # AI-generated visit summary (clinician-edited).
    ai_summary = Column(Text)

    # Assessed by
    assessed_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    assessed_at = Column(DateTime, default=func.now())

    # Constraints & indexes
    __table_args__ = (
        UniqueConstraint('visit_id', name='uq_physiotherapy_assessment_visit'),
        Index('ix_physiotherapy_assessments_patient_id', 'patient_id'),
        Index('ix_physiotherapy_assessments_visit_id', 'visit_id'),
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
        return f'<PhysiotherapyAssessment visit={self.visit_id}>'
