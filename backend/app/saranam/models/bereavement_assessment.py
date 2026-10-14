"""Bereavement Assessment model for Saranam palliative care."""
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship as db_relationship
from sqlalchemy.sql import func
from app.common.models import BaseModel


class BereavementAssessment(BaseModel):
    """Bereavement support home visit record."""
    __tablename__ = 'bereavement_assessments'

    # Patient & visit reference
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False)
    visit_id = Column(UUID(as_uuid=True), ForeignKey('patient_visits.id', ondelete='CASCADE'), nullable=False)

    # 1. General Observations
    obs_home_environment = Column(Text)
    obs_family_interaction = Column(Text)
    obs_emotional_atmosphere = Column(Text)
    obs_rituals_completed = Column(Text)
    obs_immediate_concerns = Column(Text)

    # 2. Primary Caregiver / Decision Maker Observations
    caregiver_obs_1_name = Column(String(100))
    caregiver_obs_1_relationship = Column(String(50))
    caregiver_obs_1_coping = Column(Text)

    caregiver_obs_2_name = Column(String(100))
    caregiver_obs_2_relationship = Column(String(50))
    caregiver_obs_2_coping = Column(Text)

    # 3. Psychological Assessment: Emotional Responses (Flexible JSONB list)
    emotional_responses = Column(JSONB, default=[])
    emotional_responses_other = Column(Text)

    # 4. Psychological Assessment: General Functioning
    functioning_sleep = Column(Text)
    functioning_appetite = Column(Text)
    functioning_daily_routine = Column(Text)
    functioning_role_changes = Column(Text)

    # 5. Support, Cultural & Strengths Observations
    family_social_support = Column(Text)
    spiritual_cultural_obs = Column(Text)
    coping_strengths = Column(Text)

    # 6. Red Flag Screening (Flexible JSONB list)
    red_flags = Column(JSONB, default=[])
    red_flags_other = Column(Text)

    # 7. Clinical Impression (Flexible string)
    bereavement_risk = Column(String(50))

    # 8. Interventions During Visit
    interventions_notes = Column(Text)

    # 9. Follow-up Plan & Remarks (Flexible JSONB list)
    follow_up_intervals = Column(JSONB, default=[])
    follow_up_remarks = Column(Text)

    # 10. Audit fields
    assessed_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    assessed_at = Column(DateTime, default=func.now())

    # Constraints & indexes
    __table_args__ = (
        UniqueConstraint('visit_id', name='uq_bereavement_assessment_visit'),
        Index('ix_bereavement_assessments_patient_id', 'patient_id'),
        Index('ix_bereavement_assessments_visit_id', 'visit_id'),
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
        return f'<BereavementAssessment visit={self.visit_id}>'
