"""Patient-level AI summary snapshot.

One row per patient (UNIQUE on patient_id). Regenerating overwrites the
previous snapshot — the row is the "current" clinician-approved summary, not
a history log. Surfaced on the patient profile page and downloadable as PDF.
"""
from sqlalchemy import Column, Text, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship as db_relationship
from sqlalchemy.sql import func

from app.common.models import BaseModel


class PatientAiSummary(BaseModel):
    __tablename__ = 'patient_ai_summaries'

    patient_id = Column(
        UUID(as_uuid=True),
        ForeignKey('patients.id', ondelete='CASCADE'),
        nullable=False, unique=True, index=True,
    )
    summary_text = Column(Text, nullable=False)
    # Per-block narrative dict — {nursing, psychosocial, physiotherapy}.
    # Populated by the structured AI summary; the UI renders these as separate
    # editable blocks. summary_text stays as a flattened back-compat fallback.
    summary_blocks = Column(JSONB, nullable=True)
    # AI-suggested body-location highlights — list of
    #   {id, zoneSlug, text, userEdited, createdAt, updatedAt}
    # Patient-scoped, regenerated alongside summary_text. See plan §4.2.
    body_locations = Column(JSONB, nullable=False, server_default='[]')
    model_used = Column(String(100))
    generated_at = Column(DateTime, nullable=False, default=func.now())
    generated_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))

    patient = db_relationship('Patient')
    author = db_relationship('User', foreign_keys=[generated_by])

    def to_dict(self):
        return {
            'id': str(self.id) if self.id else None,
            'patient_id': str(self.patient_id) if self.patient_id else None,
            'summary_text': self.summary_text,
            'summary_blocks': self.summary_blocks or None,
            'body_locations': self.body_locations or [],
            'model_used': self.model_used,
            'generated_at': self.generated_at.isoformat() if self.generated_at else None,
            'generated_by': str(self.generated_by) if self.generated_by else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f'<PatientAiSummary patient={self.patient_id}>'
