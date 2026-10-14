"""Schedule Deviation model — tracks deviations from planned schedule."""
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship as db_relationship
from sqlalchemy.sql import func
from app.common.models import BaseModel


class ScheduleDeviation(BaseModel):
    """A reported deviation from the planned schedule for a specific day."""
    __tablename__ = 'schedule_deviations'

    schedule_day_id = Column(UUID(as_uuid=True), ForeignKey('schedule_days.id', ondelete='CASCADE'), nullable=False, index=True)

    # Deviation details
    deviation_type = Column(String(50), nullable=False)
    # Valid: emergency_patient, route_change, time_shift, vehicle_issue, team_change, other
    description = Column(Text, nullable=False)
    time_impact = Column(String(255))  # e.g., "All visits after 10:30 AM delayed by 45 min"

    # Affected patients
    affected_patient_ids = Column(JSONB, default=[])  # List of patient ID strings

    # Emergency patient info (if deviation_type = emergency_patient)
    emergency_patient_name = Column(String(255))
    emergency_patient_location = Column(Text)
    emergency_reason = Column(Text)

    # Reported by
    reported_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)

    # Relationships
    schedule_day = db_relationship('ScheduleDay', backref='deviations')
    reporter = db_relationship('User', foreign_keys=[reported_by])

    def to_dict(self):
        data = super().to_dict()
        data['id'] = str(self.id) if self.id else None
        data['schedule_day_id'] = str(self.schedule_day_id) if self.schedule_day_id else None
        data['reported_by'] = str(self.reported_by) if self.reported_by else None
        data['reporter_name'] = self.reporter.full_name if self.reporter else None
        data['created_at'] = self.created_at.isoformat() if self.created_at else None
        return data
