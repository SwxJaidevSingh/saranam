"""Schedule Day model - individual day within a weekly schedule."""
from sqlalchemy import Column, String, Text, Date, DateTime, Boolean, ForeignKey, UniqueConstraint, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship as db_relationship
from app.common.models import BaseModel


class ScheduleDay(BaseModel):
    """One day within a weekly schedule."""
    __tablename__ = 'schedule_days'

    weekly_schedule_id = Column(UUID(as_uuid=True), ForeignKey('weekly_schedules.id', ondelete='CASCADE'), nullable=False, index=True)
    date = Column(Date, nullable=False)
    day_of_week = Column(String(20), nullable=False)

    # Day-level notes
    day_note = Column(Text)

    # Kit readiness tracking
    kit_ready = Column(Boolean, default=False)
    kit_ready_at = Column(DateTime)
    kit_ready_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))

    # Cluster efficiency (computed)
    cluster_efficiency = Column(Numeric(5, 2))

    # Relationships
    schedule_slots = db_relationship(
        'ScheduleSlot', backref='schedule_day',
        cascade='all, delete-orphan',
        order_by='ScheduleSlot.slot_order'
    )
    team_assignments = db_relationship(
        'ScheduleTeamAssignment', backref='schedule_day',
        cascade='all, delete-orphan'
    )

    __table_args__ = (
        UniqueConstraint('weekly_schedule_id', 'date', name='uq_schedule_day_date'),
    )

    def to_dict(self, include_slots=False):
        data = super().to_dict()
        data['id'] = str(self.id) if self.id else None
        data['weekly_schedule_id'] = str(self.weekly_schedule_id) if self.weekly_schedule_id else None
        data['kit_ready_by'] = str(self.kit_ready_by) if self.kit_ready_by else None
        data['date'] = self.date.isoformat() if self.date else None
        data['kit_ready_at'] = self.kit_ready_at.isoformat() if self.kit_ready_at else None
        data['created_at'] = self.created_at.isoformat() if self.created_at else None
        data['updated_at'] = self.updated_at.isoformat() if self.updated_at else None
        data['cluster_efficiency'] = float(self.cluster_efficiency) if self.cluster_efficiency is not None else None
        if include_slots:
            data['slots'] = [slot.to_dict() for slot in self.schedule_slots]
            data['team'] = [ta.to_dict() for ta in self.team_assignments]
        return data
