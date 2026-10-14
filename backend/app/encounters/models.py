"""Encounter model - Patient visits and consultations."""
from sqlalchemy import Column, String, Text, DateTime, Boolean, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, foreign
from app.common.models import BaseModel
from datetime import datetime
import enum


class ServiceStatus(enum.Enum):
    """Status of a service booking"""
    REQUESTED = "REQUESTED"
    APPROVED = "APPROVED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class Encounter(BaseModel):
    """
    Encounter model for storing patient visits and consultations.

    Represents a single interaction between patient and healthcare system.
    Links to ABDM HFR (Healthcare Facility Registry) and HPR (Healthcare Professional Registry).
    """
    __tablename__ = 'encounters'

    # Patient Reference
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True)

    # Encounter Details
    encounter_type = Column(String(50), nullable=False, index=True)  # OPD, IPD, Emergency, Teleconsultation, FollowUp
    encounter_number = Column(String(100), unique=True)  # Hospital-specific ID

    # Timing
    start_time = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    end_time = Column(DateTime)

    # ABDM Integration
    facility_hfr_id = Column(String(100), index=True)  # Healthcare Facility Registry ID
    practitioner_hpr_id = Column(String(100))  # Healthcare Professional Registry ID

    # Status
    status = Column(String(50), default='in-progress', nullable=False, index=True)
    # Values: scheduled, in-progress, completed, cancelled, no-show

    # Chief Complaint
    chief_complaint = Column(Text)

    # --- Appointment-Specific Fields (Extension for Appointment Management) ---

    # Appointment Type (refined from encounter_type)
    appointment_type = Column(String(50), index=True)
    # Values: consultation, follow_up, teleconsultation, procedure, lab_test, imaging, therapy, vaccination

    # Provider Reference (extends practitioner_hpr_id with FK to internal provider)
    provider_id = Column(UUID(as_uuid=True), ForeignKey('healthcare_providers.id'), index=True)

    # --- Service-Specific Fields (Extension for Service Management) ---

    # Service Reference
    service_id = Column(UUID(as_uuid=True), ForeignKey('services.id'), index=True)
    service_status = Column(SQLEnum(ServiceStatus), default=ServiceStatus.REQUESTED, index=True)

    # IPD-Specific Fields
    admission_date = Column(DateTime)  # For IPD services
    discharge_date = Column(DateTime)  # For IPD services
    bed_number = Column(String(50))  # Bed/Ward number for IPD

    # Follow-up Management
    follow_up_required = Column(Boolean, default=False)
    follow_up_scheduled_at = Column(DateTime)
    follow_up_service_id = Column(UUID(as_uuid=True), ForeignKey('services.id'))  # Which service for follow-up

    # Service-specific metadata
    service_metadata = Column(JSONB)  # Store service-specific data
    # Example: {"therapy_sessions": 10, "home_visit_address": "...", "equipment_provided": ["wheelchair"]}

    # Recurring Appointment Support
    recurrence_rule = Column(JSONB)
    # JSON structure: {"frequency": "weekly", "interval": 1, "count": 10, "end_date": "2025-06-01"}
    # Supports: daily, weekly, monthly patterns

    parent_appointment_id = Column(UUID(as_uuid=True), ForeignKey('encounters.id'), index=True)
    # References the original appointment if this is part of a recurring series

    # Booking Information
    booking_source = Column(String(50))
    # Values: staff, patient_portal, caregiver, walk_in, referral, system

    booked_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    # User who created the appointment (may be different from patient)

    # Cancellation/No-Show Tracking
    cancellation_reason = Column(Text)  # Reason for cancellation if status = 'cancelled'
    cancelled_at = Column(DateTime)  # When appointment was cancelled
    cancelled_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))  # Who cancelled

    no_show_reason = Column(Text)  # Reason for no-show if status = 'no-show'

    # Reminder Tracking
    reminder_sent = Column(Boolean, default=False, nullable=False)  # Whether reminders have been sent
    reminder_preferences = Column(JSONB)
    # JSON structure: {"channels": ["sms", "email"], "times": ["24h", "2h"]}

    # Check-in/Check-out
    checked_in_at = Column(DateTime)  # When patient checked in
    checked_out_at = Column(DateTime)  # When patient checked out

    # Appointment Notes
    pre_appointment_notes = Column(Text)  # Notes before appointment (e.g., preparation instructions)
    post_appointment_notes = Column(Text)  # Notes after appointment (e.g., summary, next steps)

    # Teleconsultation Support
    meeting_link = Column(String(500))  # Video call link for teleconsultations
    meeting_password = Column(String(100))  # Password for video call

    # Created By
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))

    # Relationships
    patient = relationship('Patient', back_populates='encounters')
    creator = relationship('User', foreign_keys=[created_by])
    provider = relationship('HealthcareProvider', backref='appointments', foreign_keys=[provider_id])
    service = relationship('Service', back_populates='encounters', foreign_keys=[service_id])
    follow_up_service = relationship('Service', foreign_keys=[follow_up_service_id])
    booked_by_user = relationship('User', foreign_keys=[booked_by])
    cancelled_by_user = relationship('User', foreign_keys=[cancelled_by])
    parent_appointment = relationship('Encounter', remote_side='Encounter.id', foreign_keys=[parent_appointment_id], backref='recurring_appointments')
    observations = relationship('Observation', back_populates='encounter', lazy='dynamic', cascade='all, delete-orphan')
    diagnoses = relationship('Diagnosis', back_populates='encounter', lazy='dynamic', cascade='all, delete-orphan')
    form_submissions = relationship('FormSubmission', back_populates='encounter', lazy='dynamic')
    ipd_admission = relationship('IPDAdmission',
                                 primaryjoin='Encounter.id == foreign(IPDAdmission.encounter_id)',
                                 back_populates='encounter',
                                 uselist=False,
                                 cascade='all, delete-orphan')

    def to_dict(self):
        """Convert to dictionary."""
        data = super().to_dict()
        data['patient_id'] = str(self.patient_id)
        data['encounter_type'] = self.encounter_type
        data['encounter_number'] = self.encounter_number
        data['start_time'] = self.start_time.isoformat() if self.start_time else None
        data['end_time'] = self.end_time.isoformat() if self.end_time else None
        data['facility_hfr_id'] = self.facility_hfr_id
        data['practitioner_hpr_id'] = self.practitioner_hpr_id
        data['status'] = self.status
        data['chief_complaint'] = self.chief_complaint

        # Appointment-specific fields
        data['appointment_type'] = self.appointment_type
        data['provider_id'] = str(self.provider_id) if self.provider_id else None
        data['recurrence_rule'] = self.recurrence_rule
        data['parent_appointment_id'] = str(self.parent_appointment_id) if self.parent_appointment_id else None
        data['booking_source'] = self.booking_source
        data['booked_by'] = str(self.booked_by) if self.booked_by else None
        data['cancellation_reason'] = self.cancellation_reason
        data['cancelled_at'] = self.cancelled_at.isoformat() if self.cancelled_at else None
        data['cancelled_by'] = str(self.cancelled_by) if self.cancelled_by else None
        data['no_show_reason'] = self.no_show_reason
        data['reminder_sent'] = self.reminder_sent
        data['reminder_preferences'] = self.reminder_preferences
        data['checked_in_at'] = self.checked_in_at.isoformat() if self.checked_in_at else None
        data['checked_out_at'] = self.checked_out_at.isoformat() if self.checked_out_at else None
        data['pre_appointment_notes'] = self.pre_appointment_notes
        data['post_appointment_notes'] = self.post_appointment_notes
        data['meeting_link'] = self.meeting_link
        data['meeting_password'] = self.meeting_password

        # Include patient name if loaded
        if self.patient:
            data['patient_name'] = self.patient.full_name

        # Include provider name if loaded
        if self.provider:
            data['provider_name'] = self.provider.full_name
            data['provider_specialization'] = self.provider.specialization

        # Service-specific fields
        data['service_id'] = str(self.service_id) if self.service_id else None
        data['service_status'] = self.service_status.value if self.service_status else None
        data['admission_date'] = self.admission_date.isoformat() if self.admission_date else None
        data['discharge_date'] = self.discharge_date.isoformat() if self.discharge_date else None
        data['bed_number'] = self.bed_number
        data['follow_up_required'] = self.follow_up_required
        data['follow_up_scheduled_at'] = self.follow_up_scheduled_at.isoformat() if self.follow_up_scheduled_at else None
        data['follow_up_service_id'] = str(self.follow_up_service_id) if self.follow_up_service_id else None
        data['service_metadata'] = self.service_metadata

        # Include service name if loaded
        if self.service:
            data['service_name'] = self.service.name
            data['service_type'] = self.service.service_type.value if self.service.service_type else None

        return data

    def __repr__(self):
        return f'<Encounter {self.encounter_number or self.id} - {self.encounter_type} - {self.status}>'
