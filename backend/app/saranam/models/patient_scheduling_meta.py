"""Patient Scheduling Metadata model — scheduling-specific fields only."""
from sqlalchemy import Column, Integer, Boolean, Text, Date, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship as db_relationship, backref
from app.common.models import BaseModel


class PatientSchedulingMeta(BaseModel):
    """Scheduling-specific metadata per patient.
    Clinical data (bsc_status, is_onco, complexity) lives on the Patient model.
    This table only tracks scheduling concerns."""
    __tablename__ = 'patient_scheduling_meta'

    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, unique=True, index=True)

    # Visit frequency
    recommended_frequency_days = Column(Integer, default=30)

    # Special instructions
    special_notes = Column(Text)

    # Lead flags
    lead_flagged = Column(Boolean, default=False)
    lead_flag_reason = Column(Text)
    lead_flagged_at = Column(DateTime)
    lead_flagged_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))

    # Status
    scheduling_active = Column(Boolean, default=True)

    # Computed / cached
    last_visit_date = Column(Date)
    days_since_last_visit = Column(Integer)
    priority_score = Column(Integer, default=0)

    # Relationships
    patient = db_relationship('Patient', backref=backref('scheduling_meta', uselist=False))

    def to_dict(self):
        data = super().to_dict()
        data['id'] = str(self.id) if self.id else None
        data['patient_id'] = str(self.patient_id) if self.patient_id else None
        data['lead_flagged_by'] = str(self.lead_flagged_by) if self.lead_flagged_by else None
        data['lead_flagged_at'] = self.lead_flagged_at.isoformat() if self.lead_flagged_at else None
        data['last_visit_date'] = self.last_visit_date.isoformat() if self.last_visit_date else None
        data['created_at'] = self.created_at.isoformat() if self.created_at else None
        data['updated_at'] = self.updated_at.isoformat() if self.updated_at else None
        if self.patient:
            data['patient_name'] = self.patient.full_name
            data['patient_bsc_status'] = self.patient.bsc_status
            data['patient_is_onco'] = self.patient.is_onco
            data['geographic_cluster'] = self.patient.geographic_cluster
        return data
