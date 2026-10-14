"""Schedule Notification model."""
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship as db_relationship
from app.common.models import BaseModel


class ScheduleNotification(BaseModel):
    """Notification tracking for schedule events."""
    __tablename__ = 'schedule_notifications'

    weekly_schedule_id = Column(UUID(as_uuid=True), ForeignKey('weekly_schedules.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False, index=True)

    notification_type = Column(String(50), nullable=False)
    # Valid: schedule_approved, adhoc_change, visit_reminder, kit_alert,
    #        acknowledgment_reminder, sent_back, review_ready

    channel = Column(String(20), nullable=False, default='in_app')
    # Valid: in_app, whatsapp, sms, email

    sent_at = Column(DateTime)
    delivered_at = Column(DateTime)
    read_at = Column(DateTime)

    acknowledged = Column(Boolean, default=False)
    acknowledged_at = Column(DateTime)

    content = Column(Text)

    user = db_relationship('User', foreign_keys=[user_id])

    def to_dict(self):
        data = super().to_dict()
        data['id'] = str(self.id) if self.id else None
        data['weekly_schedule_id'] = str(self.weekly_schedule_id) if self.weekly_schedule_id else None
        data['user_id'] = str(self.user_id) if self.user_id else None
        data['sent_at'] = self.sent_at.isoformat() if self.sent_at else None
        data['delivered_at'] = self.delivered_at.isoformat() if self.delivered_at else None
        data['read_at'] = self.read_at.isoformat() if self.read_at else None
        data['acknowledged_at'] = self.acknowledged_at.isoformat() if self.acknowledged_at else None
        data['created_at'] = self.created_at.isoformat() if self.created_at else None
        data['updated_at'] = self.updated_at.isoformat() if self.updated_at else None
        if self.user:
            data['user_name'] = self.user.full_name
        return data
