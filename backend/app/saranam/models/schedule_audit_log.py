"""Schedule Audit Log model."""
from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship as db_relationship
from app.common.models import BaseModel


class ScheduleAuditLog(BaseModel):
    """Audit log for all schedule changes."""
    __tablename__ = 'schedule_audit_log'

    weekly_schedule_id = Column(UUID(as_uuid=True), ForeignKey('weekly_schedules.id', ondelete='CASCADE'), nullable=False, index=True)

    action = Column(String(50), nullable=False)
    # Valid: schedule_created, schedule_submitted, schedule_approved, schedule_sent_back,
    # schedule_communicated, schedule_activated, schedule_review_ready, schedule_archived,
    # patient_added, patient_removed, patient_moved, patient_reordered,
    # team_changed, adhoc_visit_added, visit_cancelled, day_note_updated,
    # exception_note_updated, kit_marked_ready, slot_status_changed

    actor_user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False, index=True)

    details = Column(JSONB)

    actor = db_relationship('User', foreign_keys=[actor_user_id])

    def to_dict(self):
        data = super().to_dict()
        data['id'] = str(self.id) if self.id else None
        data['weekly_schedule_id'] = str(self.weekly_schedule_id) if self.weekly_schedule_id else None
        data['actor_user_id'] = str(self.actor_user_id) if self.actor_user_id else None
        data['created_at'] = self.created_at.isoformat() if self.created_at else None
        data['updated_at'] = self.updated_at.isoformat() if self.updated_at else None
        if self.actor:
            data['actor_name'] = self.actor.full_name
        return data
