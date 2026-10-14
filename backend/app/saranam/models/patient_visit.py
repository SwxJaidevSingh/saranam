"""Patient Visit model for Saranam follow-up tracking."""
from sqlalchemy import Column, String, Text, Date, DateTime, Integer, Boolean, ForeignKey, UniqueConstraint, Numeric
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship as db_relationship
from sqlalchemy.sql import func
from app.common.models import BaseModel
from app.extensions import db


def parse_vitals_temperature(value):
    """vitals_temperature is free-text (e.g. '37.2' or 'Afebrile').

    Return a float when the value is numeric (backward compatible with older
    numeric readings), otherwise the raw string; None stays None.
    """
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return str(value)


class PatientVisit(BaseModel):
    """
    Patient Visit model for tracking home care visits.

    Each visit gets an auto-assigned visit_number scoped to the patient (1, 2, 3...).
    All assessments link to a visit via visit_id FK.
    Vitals are stored here as the single source of truth.
    """
    __tablename__ = 'patient_visits'

    # Patient reference
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True)

    # Visit numbering (auto-increment per patient)
    visit_number = Column(Integer, nullable=False)
    visit_type = Column(String(30), nullable=False, default='follow_up')  # initial, follow_up, emergency, phone
    visit_date = Column(Date, nullable=False)

    # Consultation Types (multi-select boolean flags)
    doctor_consultation = Column(Boolean, default=False, server_default='false', nullable=False)
    nursing_consultation = Column(Boolean, default=False, server_default='false', nullable=False)
    counsellor_consultation = Column(Boolean, default=False, server_default='false', nullable=False)
    physiotherapy_consultation = Column(Boolean, default=False, server_default='false', nullable=False)
    social_worker_consultation = Column(Boolean, default=False, server_default='false', nullable=False)


    # Visit context
    visit_location = Column(String(50))  # home, opd, ipd, phone
    team_members = Column(JSONB)  # [{"user_id": "...", "role": "nurse"}, ...]
    vehicle_id = Column(String(50))

    # Vitals (single source of truth — assessments reference via visit_id)
    vitals_pr = Column(Integer)  # Pulse Rate
    vitals_bp_systolic = Column(Integer)
    vitals_bp_diastolic = Column(Integer)
    vitals_rr = Column(Integer)  # Respiratory Rate
    vitals_spo2 = Column(Numeric(5, 2))  # SpO2 %
    vitals_temperature = Column(String)  # Celsius
    vitals_grbs = Column(Numeric(6, 1))  # Blood sugar

    # Follow-up notes
    visit_summary = Column(Text)
    advice_pharmacological = Column(Text)
    advice_non_pharmacological = Column(Text)
    follow_up_advice = Column(Text)
    follow_up_remarks = Column(Text)

    # Status
    status = Column(String(20), default='completed')  # scheduled, in_progress, completed, cancelled
    next_visit_recommended = Column(Date)
    next_visit_priority = Column(String(10))  # high, medium, low

    # Created by
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))

    # Constraints
    __table_args__ = (
        UniqueConstraint('patient_id', 'visit_number', name='uq_patient_visit_number'),
    )

    # Relationships
    patient = db_relationship('Patient', backref='visits')
    creator = db_relationship('User', foreign_keys=[created_by])

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    @property
    def consultation_types_list(self):
        """List of active consultation role names."""
        types = []
        if self.doctor_consultation:
            types.append("Doctor")
        if self.nursing_consultation:
            types.append("Nurse")
        if self.counsellor_consultation:
            types.append("Counsellor")
        if self.physiotherapy_consultation:
            types.append("Physiotherapist")
        if self.social_worker_consultation:
            types.append("Social Worker")
        return types

    def to_dict(self):
        """Convert to dictionary."""
        data = super().to_dict()
        # Convert UUID/date/decimal fields for JSON serialization
        data['id'] = str(self.id) if self.id else None
        data['patient_id'] = str(self.patient_id) if self.patient_id else None
        data['created_by'] = str(self.created_by) if self.created_by else None
        data['visit_date'] = self.visit_date.isoformat() if self.visit_date else None
        
        # Multi-select consultation booleans & list
        data['doctor_consultation'] = bool(self.doctor_consultation)
        data['nursing_consultation'] = bool(self.nursing_consultation)
        data['counsellor_consultation'] = bool(self.counsellor_consultation)
        data['physiotherapy_consultation'] = bool(self.physiotherapy_consultation)
        data['social_worker_consultation'] = bool(self.social_worker_consultation)
        data['consultation_types'] = self.consultation_types_list

        data['next_visit_recommended'] = self.next_visit_recommended.isoformat() if self.next_visit_recommended else None
        data['created_at'] = self.created_at.isoformat() if self.created_at else None
        data['updated_at'] = self.updated_at.isoformat() if self.updated_at else None
        data['vitals_spo2'] = float(self.vitals_spo2) if self.vitals_spo2 is not None else None
        data['vitals_temperature'] = parse_vitals_temperature(self.vitals_temperature)
        data['vitals_grbs'] = float(self.vitals_grbs) if self.vitals_grbs is not None else None
        return data

    @classmethod
    def next_visit_number(cls, patient_id):
        """Get the next visit number for a patient (thread-safe).
        Visit 0 = initial (baseline). Follow-ups start at 1.
        """
        result = db.session.query(func.max(cls.visit_number)).filter(
            cls.patient_id == patient_id,
            cls.visit_type != 'initial',
        ).scalar()
        return (result or 0) + 1

    def __repr__(self):
        return f'<PatientVisit #{self.visit_number} for patient {self.patient_id}>'
