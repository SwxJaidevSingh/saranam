"""On-Call Roster model."""
from sqlalchemy import Column, Text, Date, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship as db_relationship
from app.common.models import BaseModel


class OnCallRoster(BaseModel):
    """Weekly on-call clinician assignment."""
    __tablename__ = 'on_call_roster'

    week_start_date = Column(Date, nullable=False)
    week_end_date = Column(Date, nullable=False)

    clinician_user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    phone_numbers = Column(JSONB, default=[])
    notes = Column(Text)
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)

    clinician = db_relationship('User', foreign_keys=[clinician_user_id])
    creator = db_relationship('User', foreign_keys=[created_by])

    __table_args__ = (
        UniqueConstraint('week_start_date', 'clinician_user_id', name='uq_on_call_week_clinician'),
    )

    def to_dict(self):
        data = super().to_dict()
        data['id'] = str(self.id) if self.id else None
        data['clinician_user_id'] = str(self.clinician_user_id) if self.clinician_user_id else None
        data['created_by'] = str(self.created_by) if self.created_by else None
        data['week_start_date'] = self.week_start_date.isoformat() if self.week_start_date else None
        data['week_end_date'] = self.week_end_date.isoformat() if self.week_end_date else None
        data['created_at'] = self.created_at.isoformat() if self.created_at else None
        data['updated_at'] = self.updated_at.isoformat() if self.updated_at else None
        if self.clinician:
            data['clinician_name'] = self.clinician.full_name
        return data
