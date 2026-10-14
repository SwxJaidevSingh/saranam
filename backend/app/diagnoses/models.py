"""Diagnosis model - Patient diagnoses and conditions."""
from sqlalchemy import Column, String, Text, DateTime, Date, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.common.models import BaseModel
from datetime import datetime


class Diagnosis(BaseModel):
    """
    Diagnosis model for storing patient diagnoses and clinical conditions.

    Supports ICD-10 and SNOMED-CT coding standards.
    Tracks diagnosis lifecycle (onset, diagnosis, resolution).
    """
    __tablename__ = 'diagnoses'

    # Patient and Encounter References
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True)
    encounter_id = Column(UUID(as_uuid=True), ForeignKey('encounters.id', ondelete='CASCADE'), index=True)

    # Diagnosis Details
    diagnosis_text = Column(Text, nullable=False)  # Human-readable diagnosis

    # Standard Coding
    icd10_code = Column(String(20), index=True)  # ICD-10 code
    snomed_code = Column(String(50))  # SNOMED-CT code

    # Clinical Details
    diagnosis_type = Column(String(50))  # primary, secondary, differential, provisional
    severity = Column(String(50))  # mild, moderate, severe, critical
    clinical_status = Column(String(50))  # active, resolved, recurrence, remission

    # Timing
    onset_date = Column(Date)  # When condition started
    diagnosed_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    resolved_at = Column(DateTime)

    # Attribution
    diagnosed_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))

    # Notes
    notes = Column(Text)

    # Relationships
    patient = relationship('Patient', back_populates='diagnoses')
    encounter = relationship('Encounter', back_populates='diagnoses')
    diagnoser = relationship('User', foreign_keys=[diagnosed_by])

    def to_dict(self):
        """Convert to dictionary."""
        data = super().to_dict()
        data['patient_id'] = str(self.patient_id)
        data['encounter_id'] = str(self.encounter_id) if self.encounter_id else None
        data['diagnosis_text'] = self.diagnosis_text
        data['icd10_code'] = self.icd10_code
        data['snomed_code'] = self.snomed_code
        data['diagnosis_type'] = self.diagnosis_type
        data['severity'] = self.severity
        data['clinical_status'] = self.clinical_status
        data['onset_date'] = self.onset_date.isoformat() if self.onset_date else None
        data['diagnosed_at'] = self.diagnosed_at.isoformat() if self.diagnosed_at else None
        data['resolved_at'] = self.resolved_at.isoformat() if self.resolved_at else None
        data['notes'] = self.notes

        return data

    def __repr__(self):
        return f'<Diagnosis {self.diagnosis_text[:50]} ({self.icd10_code or "no code"})>'
