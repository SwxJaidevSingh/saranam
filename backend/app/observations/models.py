"""Observation model - Clinical measurements and vitals."""
from sqlalchemy import Column, String, Text, DateTime, Boolean, Numeric, Date, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.common.models import BaseModel
from datetime import datetime


class Observation(BaseModel):
    """
    Observation model for storing clinical measurements, vitals, and test results.

    Follows FHIR Observation resource structure.
    Supports LOINC and SNOMED-CT coding.
    """
    __tablename__ = 'observations'

    # Patient and Encounter References
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True)
    encounter_id = Column(UUID(as_uuid=True), ForeignKey('encounters.id', ondelete='CASCADE'), index=True)

    # Observation Type
    observation_type = Column(String(100), nullable=False, index=True)
    # Examples: bp_systolic, bp_diastolic, temperature, weight, height, pain_scale, spo2
    observation_category = Column(String(50), index=True)  # vital-signs, laboratory, imaging, survey

    # Polymorphic Value Storage (only one should be filled)
    value_numeric = Column(Numeric(10, 2))  # For numeric values
    value_text = Column(Text)  # For text values
    value_boolean = Column(Boolean)  # For yes/no values
    value_date = Column(Date)  # For date values
    value_json = Column(JSONB)  # For complex structured values only

    # Units and Reference Range
    unit = Column(String(50))  # mmHg, celsius, kg, cm, bpm, %, etc.
    reference_range_low = Column(Numeric(10, 2))
    reference_range_high = Column(Numeric(10, 2))
    is_abnormal = Column(Boolean)

    # Standard Coding
    loinc_code = Column(String(50), index=True)  # LOINC code for lab observations
    snomed_code = Column(String(50))  # SNOMED-CT code

    # Timing and Attribution
    recorded_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    recorded_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))

    # Notes
    notes = Column(Text)

    # Relationships
    patient = relationship('Patient', back_populates='observations')
    encounter = relationship('Encounter', back_populates='observations')
    recorder = relationship('User', foreign_keys=[recorded_by])

    def get_value(self):
        """Get the value regardless of type."""
        if self.value_numeric is not None:
            return float(self.value_numeric)
        elif self.value_text is not None:
            return self.value_text
        elif self.value_boolean is not None:
            return self.value_boolean
        elif self.value_date is not None:
            return self.value_date.isoformat()
        elif self.value_json is not None:
            return self.value_json
        return None

    def set_value(self, value, value_type=None):
        """Set value based on type."""
        # Reset all values
        self.value_numeric = None
        self.value_text = None
        self.value_boolean = None
        self.value_date = None
        self.value_json = None

        if value is None:
            return

        # Auto-detect type if not specified
        if value_type is None:
            if isinstance(value, (int, float)):
                value_type = 'numeric'
            elif isinstance(value, bool):
                value_type = 'boolean'
            elif isinstance(value, str):
                value_type = 'text'
            elif isinstance(value, (dict, list)):
                value_type = 'json'

        # Set appropriate column
        if value_type == 'numeric':
            self.value_numeric = float(value)
        elif value_type == 'boolean':
            self.value_boolean = bool(value)
        elif value_type == 'text':
            self.value_text = str(value)
        elif value_type == 'json':
            self.value_json = value
        elif value_type == 'date':
            self.value_date = value

    def to_dict(self):
        """Convert to dictionary."""
        data = super().to_dict()
        data['patient_id'] = str(self.patient_id)
        data['encounter_id'] = str(self.encounter_id) if self.encounter_id else None
        data['observation_type'] = self.observation_type
        data['observation_category'] = self.observation_category
        data['value'] = self.get_value()
        data['unit'] = self.unit
        data['reference_range_low'] = float(self.reference_range_low) if self.reference_range_low else None
        data['reference_range_high'] = float(self.reference_range_high) if self.reference_range_high else None
        data['is_abnormal'] = self.is_abnormal
        data['loinc_code'] = self.loinc_code
        data['snomed_code'] = self.snomed_code
        data['recorded_at'] = self.recorded_at.isoformat() if self.recorded_at else None
        data['notes'] = self.notes

        return data

    def __repr__(self):
        return f'<Observation {self.observation_type}={self.get_value()} {self.unit or ""}>'
