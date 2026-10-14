from sqlalchemy import Column, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.common.models import BaseModel


class TeleconsultDocumentation(BaseModel):
    __tablename__ = "teleconsult_documentation"

    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tele_sessions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    who_answered = Column(String(30))
    other_relationship = Column(String(100))
    caller_name = Column(String(100))
    caller_phone = Column(String(20))
    phone_used_type = Column(String(30))

    call_direction = Column(String(20))
    call_type = Column(String(50))

    severity = Column(String(20))
    reason = Column(Text)

    symptoms = Column(Text)
    advice = Column(Text)
    notes = Column(Text)

    session = relationship(
        "TeleSession",
        back_populates="documentation",
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "session_id": str(self.session_id) if self.session_id else None,
            "who_answered": self.who_answered,
            "other_relationship": self.other_relationship,
            "caller_name": self.caller_name,
            "caller_phone": self.caller_phone,
            "phone_used_type": self.phone_used_type,
            "call_direction": self.call_direction,
            "call_type": self.call_type,
            "severity": self.severity,
            "reason": self.reason,
            "symptoms": self.symptoms,
            "advice": self.advice,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }