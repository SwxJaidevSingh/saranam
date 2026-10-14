"""Analytics models for patient symptoms, risk assessments, and locations."""
from sqlalchemy import Column, String, Text, Numeric, Boolean, ForeignKey, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship as db_relationship
from sqlalchemy.sql import func
from app.common.models import BaseModel

class PatientSymptom(BaseModel):
    """Symptom tracking for patients."""
    __tablename__ = 'patient_symptoms'

    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True)
    symptom_type = Column(String(100), nullable=False, index=True)
    severity = Column(String(20)) # 'Mild', 'Moderate', 'Severe', 'None'
    recorded_at = Column(DateTime, default=func.now(), index=True)
    recorded_by = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'))
    notes = Column(Text)

    # Relationships
    patient = db_relationship('Patient', backref='symptoms')
    recorder = db_relationship('User', foreign_keys=[recorded_by])

    def to_dict(self):
        data = super().to_dict()
        data.update({
            'patient_id': str(self.patient_id) if self.patient_id else None,
            'symptom_type': self.symptom_type,
            'severity': self.severity,
            'recorded_at': self.recorded_at.isoformat() if self.recorded_at else None,
            'recorded_by': str(self.recorded_by) if self.recorded_by else None,
            'notes': self.notes
        })
        return data

class PatientRiskAssessment(BaseModel):
    """Risk assessment records for patients."""
    __tablename__ = 'patient_risk_assessments'

    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True)
    risk_score = Column(Numeric(5, 2), nullable=False)
    risk_level = Column(String(20), index=True) # 'Low', 'Moderate', 'High', 'Critical'
    assessment_date = Column(DateTime, default=func.now(), index=True)
    contributing_factors = Column(JSONB, default={})
    assessed_by = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'))

    # Relationships
    patient = db_relationship('Patient', backref='risk_assessments')
    assessor = db_relationship('User', foreign_keys=[assessed_by])

    def to_dict(self):
        data = super().to_dict()
        data.update({
            'patient_id': str(self.patient_id) if self.patient_id else None,
            'risk_score': float(self.risk_score) if self.risk_score else None,
            'risk_level': self.risk_level,
            'assessment_date': self.assessment_date.isoformat() if self.assessment_date else None,
            'contributing_factors': self.contributing_factors,
            'assessed_by': str(self.assessed_by) if self.assessed_by else None
        })
        return data

class PatientLocation(BaseModel):
    """Patient locations for geospatial analytics."""
    __tablename__ = 'patient_locations'

    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True)
    latitude = Column(Numeric(10, 8), index=True)
    longitude = Column(Numeric(11, 8), index=True)
    address_full = Column(Text)
    panchayat = Column(String(255))
    district = Column(String(255), index=True)
    state = Column(String(255))
    is_geocoded = Column(Boolean, default=False)
    geocoding_source = Column(String(50))

    # Relationships
    patient = db_relationship('Patient', backref='locations')

    def to_dict(self):
        data = super().to_dict()
        data.update({
            'patient_id': str(self.patient_id) if self.patient_id else None,
            'latitude': float(self.latitude) if self.latitude else None,
            'longitude': float(self.longitude) if self.longitude else None,
            'address_full': self.address_full,
            'panchayat': self.panchayat,
            'district': self.district,
            'state': self.state,
            'is_geocoded': self.is_geocoded,
            'geocoding_source': self.geocoding_source
        })
        return data

class NearbyHospital(BaseModel):
    """Nearby hospitals for healthcare access analytics."""
    __tablename__ = 'nearby_hospitals'

    name = Column(String(255), nullable=False)
    hospital_type = Column(String(100), index=True)
    latitude = Column(Numeric(10, 8), index=True)
    longitude = Column(Numeric(11, 8), index=True)
    address = Column(Text)
    phone = Column(String(20))
    website = Column(String(255))
    google_place_id = Column(String(255), unique=True)

    def to_dict(self):
        data = super().to_dict()
        data.update({
            'name': self.name,
            'hospital_type': self.hospital_type,
            'latitude': float(self.latitude) if self.latitude else None,
            'longitude': float(self.longitude) if self.longitude else None,
            'address': self.address,
            'phone': self.phone,
            'website': self.website,
            'google_place_id': self.google_place_id
        })
        return data
