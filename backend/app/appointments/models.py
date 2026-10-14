"""Appointment Reminder models - SMS/email reminder tracking and management."""
from sqlalchemy import Column, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.common.models import BaseModel
from datetime import datetime


class AppointmentReminder(BaseModel):
    """
    Appointment Reminder model for tracking scheduled and sent reminders.

    Supports multiple reminder channels (SMS, email, push notifications).
    Tracks delivery status and retry attempts.
    """
    __tablename__ = 'appointment_reminders'

    # Encounter/Appointment Reference
    encounter_id = Column(UUID(as_uuid=True), ForeignKey('encounters.id', ondelete='CASCADE'), nullable=False, index=True)

    # Reminder Configuration
    reminder_type = Column(String(50), nullable=False, index=True)
    # Values: 24h_before, 2h_before, 1h_before, on_day, custom

    channel = Column(String(20), nullable=False)
    # Values: sms, email, push, whatsapp

    # Timing
    scheduled_at = Column(DateTime, nullable=False, index=True)  # When to send reminder
    sent_at = Column(DateTime, index=True)  # When reminder was actually sent

    # Status
    status = Column(String(50), default='pending', nullable=False, index=True)
    # Values: pending, sent, failed, cancelled, skipped

    # Delivery Details
    delivery_status = Column(String(50))  # delivered, bounced, undelivered (from provider like Twilio/SendGrid)
    delivery_status_updated_at = Column(DateTime)

    # Retry Tracking
    retry_count = Column(String(50), default='0')  # Number of retry attempts
    max_retries = Column(String(50), default='3')  # Maximum retry attempts
    last_retry_at = Column(DateTime)

    # Message Details
    recipient = Column(String(255), nullable=False)  # Phone number or email address
    message_body = Column(Text)  # Actual message sent
    subject = Column(String(255))  # Email subject (for email channel)

    # Provider Details (Twilio, SendGrid, etc.)
    provider_message_id = Column(String(255))  # ID from SMS/email provider
    provider_response = Column(JSONB)  # Full response from provider for debugging

    # Error Tracking
    error_message = Column(Text)  # Error details if failed
    error_code = Column(String(50))  # Error code from provider

    # Patient Interaction
    clicked = Column(Boolean, default=False)  # If patient clicked link in reminder
    clicked_at = Column(DateTime)
    confirmed = Column(Boolean, default=False)  # If patient confirmed via reminder
    confirmed_at = Column(DateTime)

    # Consent Check
    consent_verified = Column(Boolean, default=True, nullable=False)  # Patient has consented to reminders

    # Created By
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))

    # Relationships
    encounter = relationship('Encounter', backref='reminders')
    creator = relationship('User', foreign_keys=[created_by])

    def to_dict(self):
        """Convert to dictionary."""
        data = super().to_dict()
        data['encounter_id'] = str(self.encounter_id)
        data['reminder_type'] = self.reminder_type
        data['channel'] = self.channel
        data['scheduled_at'] = self.scheduled_at.isoformat() if self.scheduled_at else None
        data['sent_at'] = self.sent_at.isoformat() if self.sent_at else None
        data['status'] = self.status
        data['delivery_status'] = self.delivery_status
        data['delivery_status_updated_at'] = self.delivery_status_updated_at.isoformat() if self.delivery_status_updated_at else None
        data['retry_count'] = self.retry_count
        data['max_retries'] = self.max_retries
        data['last_retry_at'] = self.last_retry_at.isoformat() if self.last_retry_at else None
        data['recipient'] = self.recipient
        data['subject'] = self.subject
        data['provider_message_id'] = self.provider_message_id
        data['error_message'] = self.error_message
        data['error_code'] = self.error_code
        data['clicked'] = self.clicked
        data['clicked_at'] = self.clicked_at.isoformat() if self.clicked_at else None
        data['confirmed'] = self.confirmed
        data['confirmed_at'] = self.confirmed_at.isoformat() if self.confirmed_at else None
        data['consent_verified'] = self.consent_verified

        # Include appointment/patient details if loaded
        if self.encounter:
            data['appointment_time'] = self.encounter.start_time.isoformat() if self.encounter.start_time else None
            if self.encounter.patient:
                data['patient_name'] = self.encounter.patient.full_name

        return data

    def mark_sent(self, provider_message_id=None, provider_response=None):
        """Mark reminder as sent."""
        self.status = 'sent'
        self.sent_at = datetime.utcnow()
        if provider_message_id:
            self.provider_message_id = provider_message_id
        if provider_response:
            self.provider_response = provider_response

    def mark_failed(self, error_message, error_code=None):
        """Mark reminder as failed."""
        self.status = 'failed'
        self.error_message = error_message
        self.error_code = error_code
        self.last_retry_at = datetime.utcnow()
        self.retry_count = str(int(self.retry_count) + 1)

    def mark_delivered(self):
        """Mark reminder as delivered (confirmation from provider)."""
        self.delivery_status = 'delivered'
        self.delivery_status_updated_at = datetime.utcnow()

    def mark_cancelled(self):
        """Mark reminder as cancelled (appointment cancelled/rescheduled)."""
        self.status = 'cancelled'

    def __repr__(self):
        return f'<AppointmentReminder {self.reminder_type} via {self.channel} - {self.status}>'
