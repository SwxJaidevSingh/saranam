"""Visit-level AI summary snapshot (per 2026-05-13 client meeting).

One row per follow-up visit (UNIQUE on visit_id). Unlike the patient-level
PatientAiSummary which is a single "current baseline" that gets overwritten,
this table accumulates over time — every follow-up visit gets its own row,
so the clinician can scroll back through a chronological log of how the
patient has progressed.

Surfaces:
  - "Latest Patient Health" card on the patient Overview tab — the most
    recent VisitAiSummary row.
  - "Past Records" section on the patient Overview tab — all rows for the
    patient, newest first.
  - Generate button on the visit detail page (only for follow-up visits;
    initial visits are covered by the baseline PatientAiSummary).

The `body_locations` JSONB column reuses the same shape as PatientAiSummary
so the follow-up body-map task (#4) can light up without a schema change.
"""
from sqlalchemy import Column, Text, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship as db_relationship
from sqlalchemy.sql import func

from app.common.models import BaseModel


class VisitAiSummary(BaseModel):
    __tablename__ = 'visit_ai_summaries'

    visit_id = Column(
        UUID(as_uuid=True),
        ForeignKey('patient_visits.id', ondelete='CASCADE'),
        nullable=False, unique=True, index=True,
    )
    patient_id = Column(
        UUID(as_uuid=True),
        ForeignKey('patients.id', ondelete='CASCADE'),
        nullable=False, index=True,
    )
    summary_text = Column(Text, nullable=False)
    # Visit-scoped body-map highlights, same shape as PatientAiSummary:
    #   [{id, zoneSlug, text, userEdited, createdAt, updatedAt}, ...]
    # Populated alongside summary_text. The follow-up body-map UI (task #4)
    # will consume this; for now it is written but not yet rendered.
    body_locations = Column(JSONB, nullable=False, server_default='[]')
    model_used = Column(String(100))
    generated_at = Column(DateTime, nullable=False, default=func.now())
    generated_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))

    visit = db_relationship('PatientVisit')
    patient = db_relationship('Patient')
    author = db_relationship('User', foreign_keys=[generated_by])

    def to_dict(self):
        return {
            'id': str(self.id) if self.id else None,
            'visit_id': str(self.visit_id) if self.visit_id else None,
            'patient_id': str(self.patient_id) if self.patient_id else None,
            'summary_text': self.summary_text,
            'body_locations': self.body_locations or [],
            'model_used': self.model_used,
            'generated_at': self.generated_at.isoformat() if self.generated_at else None,
            'generated_by': str(self.generated_by) if self.generated_by else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f'<VisitAiSummary visit={self.visit_id}>'
