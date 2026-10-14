"""
Bulk Import Item Model
Individual appointment records in a bulk import session
"""

from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy import Column, String, Integer, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
import uuid

from app.common.models import BaseModel


class BulkImportItem(BaseModel):
    """
    Individual appointment record in a bulk import
    """
    __tablename__ = 'bulk_import_items'

    # Primary identification
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Session reference
    session_id = Column(UUID(as_uuid=True), ForeignKey('bulk_import_sessions.id', ondelete='CASCADE'), nullable=False)

    # Row tracking
    row_number = Column(Integer, nullable=False)  # Original row in file
    original_data = Column(JSONB, nullable=False)  # Raw data from file

    # Status tracking
    status = Column(String(50), default='pending')
    # Statuses: pending, validating, valid, invalid, creating, created, failed

    # Extracted appointment data
    extracted_data = Column(JSONB, nullable=True)
    # Structure: {
    #   "patient_name": "John Doe",
    #   "patient_phone": "9876543210",
    #   "patient_dob": "1990-01-15",
    #   "provider_name": "Dr. Smith",
    #   "appointment_date": "2026-03-15",
    #   "appointment_time": "09:00",
    #   "appointment_type": "consultation",
    #   "duration": 30,
    #   "chief_complaint": "Follow-up",
    #   "notes": "..."
    # }

    # Validation results
    is_valid = Column(Boolean, default=False)
    validation_errors = Column(JSONB, nullable=True)
    # Structure: [{"field": "patient_name", "message": "Required field missing"}]

    validation_warnings = Column(JSONB, nullable=True)
    # Structure: [{"field": "time", "message": "Outside business hours"}]

    # Entity matching
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id'), nullable=True)
    patient_match_type = Column(String(50), nullable=True)
    # Types: exact, fuzzy, created, manual, none
    patient_match_score = Column(Integer, nullable=True)  # 0-100 for fuzzy matches

    provider_id = Column(UUID(as_uuid=True), ForeignKey('healthcare_providers.id'), nullable=True)
    provider_match_type = Column(String(50), nullable=True)
    provider_match_score = Column(Integer, nullable=True)

    # Provider resolution (for missing providers)
    original_provider_name = Column(String(255), nullable=True)  # Provider name from CSV if not found
    provider_resolution_action = Column(String(50), nullable=True)  # create, assign_unknown, change, skip
    provider_created_id = Column(UUID(as_uuid=True), ForeignKey('healthcare_providers.id'), nullable=True)  # Provider created during resolution

    service_id = Column(UUID(as_uuid=True), ForeignKey('services.id'), nullable=True)
    service_match_type = Column(String(50), nullable=True)
    service_match_score = Column(Integer, nullable=True)

    # Patient creation tracking
    patient_created = Column(Boolean, default=False)
    created_patient_data = Column(JSONB, nullable=True)

    # Conflict detection
    has_conflict = Column(Boolean, default=False)
    conflict_type = Column(String(50), nullable=True)
    # Types: time_conflict, provider_unavailable, double_booking

    conflict_details = Column(JSONB, nullable=True)
    # Structure: {
    #   "conflicting_appointment_id": "xxx",
    #   "existing_time": "09:00-09:30",
    #   "requested_time": "09:00-09:30"
    # }

    # Conflict resolution
    resolution_action = Column(String(50), nullable=True)
    # Actions: accepted_suggestion, manual_override, skipped, auto_resolved
    resolution_data = Column(JSONB, nullable=True)
    # Structure: {"new_time": "10:00", "new_provider_id": "xxx"}

    # AI suggestions (from LLM)
    ai_suggestions = Column(JSONB, nullable=True)
    # Structure: {
    #   "alternative_slots": [
    #     {"time": "10:00", "provider_id": "xxx", "confidence": 0.9},
    #     {"time": "11:00", "provider_id": "xxx", "confidence": 0.7}
    #   ],
    #   "recommendation": "Accept 10:00 slot - closest to requested time"
    # }

    # Final appointment data (after all processing)
    final_appointment_data = Column(JSONB, nullable=True)

    # Created appointment reference
    created_appointment_id = Column(UUID(as_uuid=True), ForeignKey('encounters.id'), nullable=True)

    # Error tracking
    error_message = Column(Text, nullable=True)
    error_details = Column(JSONB, nullable=True)

    # Processing metadata
    processed_at = Column(DateTime, nullable=True)
    retry_count = Column(Integer, default=0)

    # Timestamps (inherited from BaseModel)
    # created_at, updated_at

    # Relationships
    session = relationship('BulkImportSession', back_populates='import_items')
    patient = relationship('Patient')
    provider = relationship('HealthcareProvider', foreign_keys=[provider_id])
    provider_created = relationship('HealthcareProvider', foreign_keys=[provider_created_id])
    service = relationship('Service')
    created_appointment = relationship('Encounter')

    def __repr__(self):
        return f'<BulkImportItem Row {self.row_number}: {self.status}>'

    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            'id': str(self.id),
            'session_id': str(self.session_id),
            'row_number': self.row_number,
            'status': self.status,
            'original_data': self.original_data,
            'extracted_data': self.extracted_data,
            'is_valid': self.is_valid,
            'validation_errors': self.validation_errors or [],
            'validation_warnings': self.validation_warnings or [],
            'patient_match': {
                'patient_id': str(self.patient_id) if self.patient_id else None,
                'match_type': self.patient_match_type,
                'match_score': self.patient_match_score,
                'created': self.patient_created
            } if self.patient_id or self.patient_created else None,
            'provider_match': {
                'provider_id': str(self.provider_id) if self.provider_id else None,
                'match_type': self.provider_match_type,
                'match_score': self.provider_match_score,
                'original_provider_name': self.original_provider_name,
                'resolution_action': self.provider_resolution_action,
                'provider_created_id': str(self.provider_created_id) if self.provider_created_id else None
            } if self.provider_id or self.original_provider_name else None,
            'service_match': {
                'service_id': str(self.service_id) if self.service_id else None,
                'match_type': self.service_match_type,
                'match_score': self.service_match_score
            } if self.service_id else None,
            'conflict': {
                'has_conflict': self.has_conflict,
                'conflict_type': self.conflict_type,
                'details': self.conflict_details,
                'resolution_action': self.resolution_action,
                'resolution_data': self.resolution_data,
                'ai_suggestions': self.ai_suggestions
            } if self.has_conflict else None,
            'created_appointment_id': str(self.created_appointment_id) if self.created_appointment_id else None,
            'error': {
                'message': self.error_message,
                'details': self.error_details
            } if self.error_message else None,
            'final_appointment_data': self.final_appointment_data,
            'processed_at': self.processed_at.isoformat() if self.processed_at else None,
            'retry_count': self.retry_count
        }

    def mark_valid(self):
        """Mark item as valid"""
        self.is_valid = True
        self.status = 'valid'

    def mark_invalid(self, errors):
        """Mark item as invalid with errors"""
        self.is_valid = False
        self.status = 'invalid'
        self.validation_errors = errors

    def mark_created(self, appointment_id):
        """Mark appointment as created"""
        self.status = 'created'
        self.created_appointment_id = appointment_id
        from datetime import datetime
        self.processed_at = datetime.utcnow()

    def mark_failed(self, error_message, error_details=None):
        """Mark item as failed"""
        self.status = 'failed'
        self.error_message = error_message
        self.error_details = error_details
        from datetime import datetime
        self.processed_at = datetime.utcnow()

    def add_warning(self, field, message):
        """Add validation warning"""
        if not self.validation_warnings:
            self.validation_warnings = []
        self.validation_warnings.append({
            'field': field,
            'message': message
        })

    def set_conflict(self, conflict_type, details):
        """Set conflict information"""
        self.has_conflict = True
        self.conflict_type = conflict_type
        self.conflict_details = details

    def resolve_conflict(self, action, resolution_data=None):
        """Resolve conflict"""
        self.resolution_action = action
        self.resolution_data = resolution_data
        if action == 'accepted_suggestion' or action == 'manual_override':
            self.has_conflict = False
