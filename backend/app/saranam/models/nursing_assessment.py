"""Nursing Assessment model for Saranam palliative care."""
from sqlalchemy import Column, String, Text, DateTime, Integer, Boolean, ForeignKey, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship as db_relationship
from sqlalchemy.sql import func
from app.common.models import BaseModel
from app.extensions import db


class NursingAssessment(BaseModel):
    """Nursing assessment recorded during a patient visit."""
    __tablename__ = 'nursing_assessments'

    # Patient & visit reference
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False)
    visit_id = Column(UUID(as_uuid=True), ForeignKey('patient_visits.id', ondelete='CASCADE'), nullable=False)

    # General observation
    consciousness = Column(String(20))
    orientation = Column(String(20))
    demeanor = Column(String(20))
    adl = Column(String(30))
    built = Column(String(20))
    general_examination = Column(Text)
    hygiene_general = Column(String(10))

    # Pain
    pain_score = Column(Integer)  # 0-10
    pain_details = Column(Text)

    # Symptoms
    nausea_vomiting = Column(Text)
    dyspnea = Column(Text)
    bowel = Column(Text)
    bladder = Column(Text)
    # appetite = Column(Text)
    # sleep = Column(Text)
    # diet = Column(Text)

    # Wound
    wound_present = Column(Boolean, default=False)
    wound_size = Column(Text)
    wound_site = Column(Text)
    wound_fungative = Column(Boolean)
    wound_bleeding = Column(Boolean)
    wound_discharge = Column(Text)
    wound_odor = Column(String(20))
    wound_maggot = Column(Boolean)

    # Devices
    device_feeding_tube = Column(JSONB)
    device_urinary_catheter = Column(JSONB)
    device_tracheostomy = Column(JSONB)
    device_stoma = Column(JSONB)

    # Lymphedema
    lymphedema_present = Column(Boolean)
    lymphedema_details = Column(Text)

    # Bed sore
    bed_sore_present = Column(Boolean)
    braden_scale_score = Column(Integer)

    # Hygiene details
    hygiene_notes = Column(Text)
    hygiene_environmental = Column(String(10))
    hygiene_oral = Column(String(10))
    hygiene_skin = Column(String(10))

    # Notes
    procedures_done = Column(Text)
    instructions_given = Column(Text)
    future_plans = Column(Text)

    # AI-generated visit summary (clinician-edited; populated via
    # POST /saranam/visits/<id>/nursing/summary).
    ai_summary = Column(Text)

    # Assessed by
    assessed_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    assessed_at = Column(DateTime, default=func.now())

    # Constraints & indexes
    __table_args__ = (
        UniqueConstraint('visit_id', name='uq_nursing_assessment_visit'),
        Index('ix_nursing_assessments_patient_id', 'patient_id'),
        Index('ix_nursing_assessments_visit_id', 'visit_id'),
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
        return f'<NursingAssessment visit={self.visit_id}>'
