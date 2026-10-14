"""Consent models - Patient consent management for ABDM/DPDPA compliance."""
from sqlalchemy import Column, String, Text, DateTime, Boolean, ForeignKey, ARRAY
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.common.models import BaseModel
from datetime import datetime


class ConsentArtifact(BaseModel):
    """
    Consent Artifact model for managing patient consent to access health data.

    Compliant with ABDM HIE-CM consent framework and DPDPA 2023.
    Implements granular, time-bound, purpose-specific consent.
    """
    __tablename__ = 'consent_artifacts'

    # Patient
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True)

    # Consent Type
    consent_type = Column(String(50), nullable=False, index=True)
    # Values: data_access, research, treatment, marketing, abdm_hie
    purpose = Column(String(100), nullable=False)
    # ABDM purposes: CAREMGT, RESEARCH, PUBLICHEALTH, etc.

    # Granted To
    granted_to_user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), index=True)
    granted_to_facility_hfr_id = Column(String(100))  # HFR ID
    granted_to_organization = Column(String(255))

    # Scope (granular data access)
    data_categories = Column(ARRAY(String), nullable=False)
    # Examples: ['observations', 'diagnoses', 'form_answers', 'medications']
    specific_encounter_ids = Column(ARRAY(UUID))  # Limit to specific encounters
    specific_observation_types = Column(ARRAY(String))  # Limit to specific observation types

    # Validity Period
    valid_from = Column(DateTime, nullable=False, index=True)
    valid_until = Column(DateTime, nullable=False, index=True)

    # Status
    status = Column(String(50), default='active', nullable=False, index=True)
    # Values: pending, active, expired, revoked, denied
    granted_at = Column(DateTime, default=datetime.utcnow)
    revoked_at = Column(DateTime)
    revoked_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    revocation_reason = Column(Text)

    # ABDM Integration
    abdm_consent_id = Column(String(255), unique=True, index=True)  # HIE-CM consent artifact ID
    abdm_consent_json = Column(JSONB)  # Full ABDM consent structure (exchange format)

    # Consent Proof
    consent_document_url = Column(Text)  # Link to signed consent document
    digital_signature = Column(Text)  # Digital signature if applicable

    # Relationships
    patient = relationship('Patient', back_populates='consent_artifacts', foreign_keys=[patient_id])
    granted_to_user = relationship('User', foreign_keys=[granted_to_user_id])
    revoked_by_user = relationship('User', foreign_keys=[revoked_by])
    access_logs = relationship('ConsentAccessLog', back_populates='consent', lazy='dynamic', cascade='all, delete-orphan')

    def is_valid(self):
        """Check if consent is currently valid."""
        if self.status != 'active':
            return False

        now = datetime.utcnow()
        return self.valid_from <= now <= self.valid_until

    def covers_data_category(self, category):
        """Check if consent covers a specific data category."""
        return category in (self.data_categories or [])

    def revoke(self, revoked_by_user_id, reason=None):
        """Revoke the consent."""
        self.status = 'revoked'
        self.revoked_at = datetime.utcnow()
        self.revoked_by = revoked_by_user_id
        self.revocation_reason = reason

    def to_dict(self):
        """Convert to dictionary."""
        data = super().to_dict()
        data['patient_id'] = str(self.patient_id)
        data['consent_type'] = self.consent_type
        data['purpose'] = self.purpose
        data['granted_to_user_id'] = str(self.granted_to_user_id) if self.granted_to_user_id else None
        data['granted_to_facility_hfr_id'] = self.granted_to_facility_hfr_id
        data['granted_to_organization'] = self.granted_to_organization
        data['data_categories'] = self.data_categories
        data['specific_encounter_ids'] = [str(e) for e in (self.specific_encounter_ids or [])]
        data['specific_observation_types'] = self.specific_observation_types
        data['valid_from'] = self.valid_from.isoformat() if self.valid_from else None
        data['valid_until'] = self.valid_until.isoformat() if self.valid_until else None
        data['status'] = self.status
        data['granted_at'] = self.granted_at.isoformat() if self.granted_at else None
        data['revoked_at'] = self.revoked_at.isoformat() if self.revoked_at else None
        data['revocation_reason'] = self.revocation_reason
        data['abdm_consent_id'] = self.abdm_consent_id
        data['is_valid'] = self.is_valid()

        return data

    def __repr__(self):
        return f'<ConsentArtifact {self.id} - {self.status} - {self.purpose}>'


class ConsentAccessLog(BaseModel):
    """
    Consent Access Log model for tracking consent-based data access.

    Maintains audit trail of all data access using consent artifacts.
    Required for DPDPA 2023 compliance.
    """
    __tablename__ = 'consent_access_log'

    # Consent Reference
    consent_id = Column(UUID(as_uuid=True), ForeignKey('consent_artifacts.id', ondelete='CASCADE'), nullable=False, index=True)

    # Access Details
    accessed_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False, index=True)
    access_type = Column(String(50), nullable=False)  # read, export, print, share, api_access

    # What Was Accessed
    entity_type = Column(String(50), nullable=False, index=True)  # observation, diagnosis, form_answer, patient
    entity_ids = Column(ARRAY(UUID))  # IDs of accessed records
    data_accessed_description = Column(Text)  # Human-readable description

    # Context
    purpose_of_access = Column(String(100))  # Why data was accessed
    accessed_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Technical Details
    ip_address = Column(String(45))  # IPv4 or IPv6
    user_agent = Column(Text)

    # ABDM Audit
    abdm_transaction_id = Column(String(255))  # For ABDM data exchange tracking

    # Relationships
    consent = relationship('ConsentArtifact', back_populates='access_logs')
    accessor = relationship('User', foreign_keys=[accessed_by])

    def to_dict(self):
        """Convert to dictionary."""
        data = super().to_dict()
        data['consent_id'] = str(self.consent_id)
        data['accessed_by'] = str(self.accessed_by)
        data['access_type'] = self.access_type
        data['entity_type'] = self.entity_type
        data['entity_ids'] = [str(e) for e in (self.entity_ids or [])]
        data['data_accessed_description'] = self.data_accessed_description
        data['purpose_of_access'] = self.purpose_of_access
        data['accessed_at'] = self.accessed_at.isoformat() if self.accessed_at else None
        data['ip_address'] = self.ip_address
        data['abdm_transaction_id'] = self.abdm_transaction_id

        return data

    def __repr__(self):
        return f'<ConsentAccessLog {self.access_type} by User {self.accessed_by} at {self.accessed_at}>'
