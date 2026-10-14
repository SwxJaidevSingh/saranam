from sqlalchemy import Column, Boolean, ForeignKey, DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
from app.common.models import BaseModel

class CallLogAgentStatus(BaseModel):
    """
    Persistent On-Duty status for healthcare providers in the call log module.
    
    This model allows the smart outreach system to remember which agents are 
    available to receive inbound calls even after page refreshes.
    """
    __tablename__ = 'call_log_agent_statuses'

    provider_id = Column(UUID(as_uuid=True), ForeignKey('healthcare_providers.id', ondelete='CASCADE'), unique=True, nullable=False, index=True)
    is_on_duty = Column(Boolean, default=False, nullable=False)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship to provider for easier joins
    provider = relationship("HealthcareProvider", backref="call_log_status")

    def to_dict(self):
        data = super().to_dict()
        data['provider_id'] = str(self.provider_id)
        data['is_on_duty'] = self.is_on_duty
        data['last_updated'] = self.last_updated.isoformat() if self.last_updated else None
        return data

class CallSOP(BaseModel):
    """
    Call documentation results for patient interactions.
    """
    __tablename__ = 'call_sops'

    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True)
    staff_name = Column(String(100), nullable=True)
    staff_number = Column(String(20), nullable=True)
    caller_number = Column(String(20), nullable=True)
    person_relationship = Column(String(50), nullable=True)
    reason = Column(String(255), nullable=True)
    severity = Column(String(20), default='low')
    symptoms = Column(Text, nullable=True)
    advice = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    is_escalated = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship to patient
    patient = relationship("Patient", backref="call_sops")

    def to_dict(self):
        data = super().to_dict()
        data['patient_id'] = str(self.patient_id)
        return data

class CallSchedule(BaseModel):
    """
    Scheduled calls for future outreach sessions.
    """
    __tablename__ = 'call_schedules'

    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True)
    scheduled_date = Column(DateTime, nullable=False)
    status = Column(String(20), default='pending') # pending, completed, cancelled
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship to patient
    patient = relationship("Patient", backref="schedules")

    def to_dict(self):
        data = super().to_dict()
        data['patient_id'] = str(self.patient_id)
        data['scheduled_date'] = f"{self.scheduled_date.isoformat()}Z" if self.scheduled_date else None
        return data
