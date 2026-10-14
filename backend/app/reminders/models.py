"""Reminder system models."""
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.common.models import BaseModel


class SystemSetting(BaseModel):
    """Key-value store for app configuration (SMTP, MSG91, toggles)."""
    __tablename__ = 'system_settings'

    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text)  # plain text or JSON string
    description = Column(String(500))

    def __repr__(self):
        return f'<SystemSetting {self.key}>'


class ReminderLog(BaseModel):
    """Audit log for every reminder attempt."""
    __tablename__ = 'reminder_logs'

    encounter_id = Column(UUID(as_uuid=True), ForeignKey('encounters.id', ondelete='CASCADE'), nullable=False, index=True)
    reminder_type = Column(String(10), nullable=False, index=True)   # "24h" or "2h"
    channel = Column(String(10), nullable=False)                     # "email" or "sms"
    status = Column(String(20), nullable=False, index=True)          # "sent", "failed", "skipped"
    recipient = Column(String(255))                                  # masked phone/email for audit
    error_message = Column(Text)
    sent_at = Column(DateTime)

    # Relationships
    encounter = relationship('Encounter', foreign_keys=[encounter_id])

    def __repr__(self):
        return f'<ReminderLog {self.reminder_type}/{self.channel} → {self.status}>'

    def to_dict(self):
        data = super().to_dict()
        data['encounter_id'] = str(self.encounter_id)
        return data
