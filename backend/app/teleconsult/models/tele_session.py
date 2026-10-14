from sqlalchemy import Column, ForeignKey, DateTime, String, Text, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.common.models import BaseModel


# Status values
STATUS_SCHEDULED = "scheduled"
STATUS_RINGING = "ringing"
STATUS_IN_PROGRESS = "in_progress"
STATUS_COMPLETED = "completed"
STATUS_FAILED = "failed"
STATUS_MISSED = "missed"
STATUS_CANCELLED = "cancelled"

CHANNEL_VOICE = "voice"
CHANNEL_VIDEO = "video"

VENDOR_ENABLEX = "enablex"
VENDOR_EXOTEL = "exotel"
VENDOR_MOCK = "mock"


class TeleSession(BaseModel):
    """Voice/video consultation session backed by EnableX (or Exotel fallback)."""

    __tablename__ = "tele_sessions"

    patient_id = Column(
        UUID(as_uuid=True),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider_id = Column(
        UUID(as_uuid=True),
        ForeignKey("healthcare_providers.id", ondelete="SET NULL"),
        index=True,
    )
    linked_visit_id = Column(
        UUID(as_uuid=True),
        ForeignKey("patient_visits.id", ondelete="SET NULL"),
    )
    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )

    channel = Column(String(16), nullable=False)  # voice | video
    provider_vendor = Column(String(16), nullable=False, default=VENDOR_ENABLEX)
    direction = Column(String(16), nullable=False, default="outbound")  # outbound | inbound

    vendor_session_id = Column(String(128), unique=True, index=True)
    vendor_room_name = Column(String(255))

    moderator_token = Column(Text)
    participant_token = Column(Text)
    moderator_join_url = Column(Text)
    participant_join_url = Column(Text)

    status = Column(String(32), nullable=False, default=STATUS_SCHEDULED)

    scheduled_at = Column(DateTime)
    started_at = Column(DateTime)
    ended_at = Column(DateTime)
    duration_seconds = Column(Integer)

    record_call = Column(Boolean, nullable=False, default=False)
    recording_url = Column(Text)
    recording_id = Column(String(128))

    cancel_reason = Column(Text)
    notes = Column(Text)
    raw_payload = Column(JSONB)

    deleted_at = Column(DateTime)

    patient = relationship("Patient", backref="tele_sessions")
    provider = relationship("HealthcareProvider", backref="tele_sessions")
    visit = relationship("PatientVisit", backref="tele_sessions")
    notifications = relationship(
        "TeleNotification",
        back_populates="session",
        cascade="all, delete-orphan",
    )

    def to_dict(self, include_tokens=False):
        provider_name = None
        if self.provider:
            provider_name = (
                getattr(self.provider, "full_name", None)
                or getattr(self.provider, "name", None)
                or " ".join(filter(None, [
                    getattr(self.provider, "first_name", None),
                    getattr(self.provider, "last_name", None),
                ]))
                or None
            )

        data = {
            "id": str(self.id),
            "patient_id": str(self.patient_id) if self.patient_id else None,
            "provider_id": str(self.provider_id) if self.provider_id else None,
            "provider_name": provider_name,
            "linked_visit_id": str(self.linked_visit_id) if self.linked_visit_id else None,
            "created_by": str(self.created_by) if self.created_by else None,
            "channel": self.channel,
            "direction": self.direction,
            "provider_vendor": self.provider_vendor,
            "vendor_session_id": self.vendor_session_id,
            "vendor_room_name": self.vendor_room_name,
            "moderator_join_url": self.moderator_join_url,
            "participant_join_url": self.participant_join_url,
            "status": self.status,
            "scheduled_at": self.scheduled_at.isoformat() if self.scheduled_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
            "duration_seconds": self.duration_seconds,
            "record_call": self.record_call,
            "recording_url": self.recording_url,
            "cancel_reason": self.cancel_reason,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_tokens:
            data["moderator_token"] = self.moderator_token
            data["participant_token"] = self.participant_token
        return data
    
    documentation = relationship(
        "TeleconsultDocumentation",
        back_populates="session",
        uselist=False,
        cascade="all, delete-orphan",
    )