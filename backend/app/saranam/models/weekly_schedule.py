"""Weekly Schedule model - the core state machine entity."""
from sqlalchemy import Column, String, Text, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship as db_relationship
from app.common.models import BaseModel


class WeeklySchedule(BaseModel):
    """Weekly schedule for a vehicle. State machine entity."""
    __tablename__ = 'weekly_schedules'

    # Time range
    week_start_date = Column(Date, nullable=False)
    week_end_date = Column(Date, nullable=False)

    # Vehicle assignment
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey('vehicles.id'), nullable=False)

    # State machine
    status = Column(String(20), nullable=False, default='draft')
    # Valid: draft, submitted, approved, communicated, in_progress, modified, review_ready, archived

    # Draft phase
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)

    # Submission phase
    submitted_at = Column(DateTime)
    submitted_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    submitted_note = Column(Text)

    # Approval phase
    approved_at = Column(DateTime)
    approved_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    approval_note = Column(Text)
    sent_back_reason = Column(Text)

    # Communication phase
    communicated_at = Column(DateTime)

    # Review phase
    review_started_at = Column(DateTime)
    review_completed_at = Column(DateTime)
    review_completed_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    review_notes = Column(Text)

    # Computed review metrics
    review_metrics = Column(JSONB)

    # Relationships
    schedule_days = db_relationship(
        'ScheduleDay', backref='weekly_schedule',
        cascade='all, delete-orphan',
        order_by='ScheduleDay.date'
    )
    audit_logs = db_relationship(
        'ScheduleAuditLog', backref='weekly_schedule',
        cascade='all, delete-orphan',
        order_by='ScheduleAuditLog.created_at'
    )
    creator = db_relationship('User', foreign_keys=[created_by])

    # Note: uniqueness enforced at application level (only one non-archived per week+vehicle)
    # No DB unique constraint since archived + new draft can coexist

    def to_dict(self, include_days=False):
        data = super().to_dict()
        data['id'] = str(self.id) if self.id else None
        data['vehicle_id'] = str(self.vehicle_id) if self.vehicle_id else None
        data['created_by'] = str(self.created_by) if self.created_by else None
        data['submitted_by'] = str(self.submitted_by) if self.submitted_by else None
        data['approved_by'] = str(self.approved_by) if self.approved_by else None
        data['review_completed_by'] = str(self.review_completed_by) if self.review_completed_by else None
        data['week_start_date'] = self.week_start_date.isoformat() if self.week_start_date else None
        data['week_end_date'] = self.week_end_date.isoformat() if self.week_end_date else None
        data['submitted_at'] = self.submitted_at.isoformat() if self.submitted_at else None
        data['approved_at'] = self.approved_at.isoformat() if self.approved_at else None
        data['communicated_at'] = self.communicated_at.isoformat() if self.communicated_at else None
        data['review_started_at'] = self.review_started_at.isoformat() if self.review_started_at else None
        data['review_completed_at'] = self.review_completed_at.isoformat() if self.review_completed_at else None
        data['created_at'] = self.created_at.isoformat() if self.created_at else None
        data['updated_at'] = self.updated_at.isoformat() if self.updated_at else None
        if include_days:
            data['days'] = [day.to_dict(include_slots=True) for day in self.schedule_days]
        return data
