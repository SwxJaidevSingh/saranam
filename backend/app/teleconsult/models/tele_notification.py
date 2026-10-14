from sqlalchemy import (
    Column,
    ForeignKey,
    DateTime,
    String,
    Text,
    Integer,
    UniqueConstraint,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.common.models import BaseModel


# Recipient types
RECIPIENT_PATIENT = "patient"
RECIPIENT_PROVIDER = "provider"

# Channels
CHANNEL_EMAIL = "email"
CHANNEL_WHATSAPP = "whatsapp"
CHANNEL_SMS = "sms"

# Template keys
TPL_SCHEDULED = "scheduled"
TPL_REMINDER_24H = "reminder_24h"
TPL_REMINDER_15MIN = "reminder_15min"
TPL_CANCELLED = "cancelled"
TPL_RESCHEDULED = "rescheduled"
TPL_JOIN_LINK_RESEND = "join_link_resend"

# Status
STATUS_PENDING = "pending"
STATUS_SENT = "sent"
STATUS_FAILED = "failed"
STATUS_CANCELLED = "cancelled"
STATUS_SKIPPED = "skipped"


class TeleNotification(BaseModel):
    """Outbound notification log + reminder queue.

    Entries with status='pending' and scheduled_for<=NOW are picked up by
    the reminder scheduler tick and dispatched.
    """

    __tablename__ = "tele_notifications"

    __table_args__ = (
        UniqueConstraint(
            "session_id",
            "recipient_type",
            "channel",
            "template_key",
            name="uq_tele_notif_dedup",
        ),
        Index(
            "idx_tele_notif_due_pending",
            "scheduled_for",
            postgresql_where=(Column("status") == "pending"),
        ),
    )

    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tele_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    recipient_type = Column(String(16), nullable=False)
    recipient_user_id = Column(UUID(as_uuid=True))
    recipient_email = Column(String(255))
    recipient_phone = Column(String(32))

    channel = Column(String(16), nullable=False)
    template_key = Column(String(64), nullable=False)

    scheduled_for = Column(DateTime, nullable=False, index=True)
    sent_at = Column(DateTime)

    status = Column(String(32), nullable=False, default=STATUS_PENDING)

    vendor_message_id = Column(String(128))
    error_message = Column(Text)
    retry_count = Column(Integer, nullable=False, default=0)
    raw_response = Column(JSONB)

    session = relationship("TeleSession", back_populates="notifications")

    def to_dict(self):
        return {
            "id": str(self.id),
            "session_id": str(self.session_id),
            "recipient_type": self.recipient_type,
            "recipient_user_id": str(self.recipient_user_id) if self.recipient_user_id else None,
            "recipient_email": self.recipient_email,
            "recipient_phone": self.recipient_phone,
            "channel": self.channel,
            "template_key": self.template_key,
            "scheduled_for": self.scheduled_for.isoformat() if self.scheduled_for else None,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
            "status": self.status,
            "vendor_message_id": self.vendor_message_id,
            "error_message": self.error_message,
            "retry_count": self.retry_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
