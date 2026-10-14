"""Procedures Record — tracks nursing, physiotherapy, and counselling procedures per visit."""
from sqlalchemy import Column, Text, ForeignKey, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship as db_relationship
from app.common.models import BaseModel


class ProceduresRecord(BaseModel):
    """Procedures performed during a patient visit."""
    __tablename__ = 'procedures_records'

    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False)
    visit_id = Column(UUID(as_uuid=True), ForeignKey('patient_visits.id', ondelete='CASCADE'), nullable=False)

    # Each stores an array of procedure keys that were performed, e.g. ["vitals_monitoring", "wound_care"]
    nursing = Column(JSONB)
    physiotherapy = Column(JSONB)
    counsellor = Column(JSONB)
    medical = Column(JSONB)
    
    exercise_review = Column(Text)
    notes = Column(Text)

    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))

    __table_args__ = (
        UniqueConstraint('visit_id', name='uq_procedures_record_visit'),
        Index('ix_procedures_records_patient_id', 'patient_id'),
        Index('ix_procedures_records_visit_id', 'visit_id'),
    )

    patient = db_relationship('Patient')
    visit = db_relationship('PatientVisit')
    creator = db_relationship('User', foreign_keys=[created_by])

    def to_dict(self):
        data = super().to_dict()
        data['id'] = str(self.id) if self.id else None
        data['patient_id'] = str(self.patient_id) if self.patient_id else None
        data['visit_id'] = str(self.visit_id) if self.visit_id else None
        data['created_by'] = str(self.created_by) if self.created_by else None
        data['created_at'] = self.created_at.isoformat() if self.created_at else None
        data['updated_at'] = self.updated_at.isoformat() if self.updated_at else None
        return data

    def __repr__(self):
        return f'<ProceduresRecord visit={self.visit_id}>'
