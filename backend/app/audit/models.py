"""Audit model - Comprehensive audit trail for compliance."""
from sqlalchemy import Column, String, Text, DateTime, Boolean, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.orm import relationship
from app.common.models import BaseModel
from datetime import datetime


class AuditLog(BaseModel):
    """
    Audit Log model for comprehensive audit trail.

    Tracks all patient data access and system actions.
    Required for healthcare compliance (7-year retention).
    """
    __tablename__ = 'audit_logs'

    # Actor (who performed the action)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), index=True)
    user_email = Column(String(255))  # Snapshot in case user deleted
    user_role = Column(String(50))

    # Patient Context (if patient data involved)
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='SET NULL'), index=True)

    # Action Details
    action = Column(String(100), nullable=False, index=True)
    # Values: create, read, update, delete, export, print, share, login, logout,
    #         grant_consent, revoke_consent, access_patient_data
    entity_type = Column(String(50), nullable=False, index=True)
    # Values: patient, observation, diagnosis, form_answer, user, consent, submission
    entity_id = Column(UUID(as_uuid=True))  # ID of affected entity

    # Consent Tracking
    consent_id = Column(UUID(as_uuid=True), ForeignKey('consent_artifacts.id', ondelete='SET NULL'))
    consent_required = Column(Boolean, default=False)  # Was consent required?
    consent_verified = Column(Boolean)  # Was valid consent verified?

    # Change Tracking (for updates/deletes)
    old_values = Column(JSONB)  # Snapshot of old values
    new_values = Column(JSONB)  # Snapshot of new values

    # Request Details
    http_method = Column(String(10))  # GET, POST, PUT, DELETE
    endpoint = Column(String(255))  # API endpoint called
    ip_address = Column(INET)  # IP address of request
    user_agent = Column(Text)  # User agent string

    # Result
    success = Column(Boolean, default=True, index=True)
    error_message = Column(Text)  # If action failed

    # Timing
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    duration_ms = Column(Integer)  # How long the operation took

    # ABDM/Compliance
    is_abdm_transaction = Column(Boolean, default=False)
    abdm_transaction_id = Column(String(255))

    # Relationships
    user = relationship('User', foreign_keys=[user_id])
    patient = relationship('Patient', foreign_keys=[patient_id])
    consent = relationship('ConsentArtifact', foreign_keys=[consent_id])

    @classmethod
    def log_action(cls, user_id, action, entity_type, entity_id=None, **kwargs):
        """
        Convenience method to log an action.

        Args:
            user_id: UUID of user performing action
            action: Action type (create, read, update, delete, etc.)
            entity_type: Type of entity affected
            entity_id: ID of entity affected
            **kwargs: Additional fields (patient_id, old_values, new_values, etc.)
        """
        from app.extensions import db

        log = cls(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            **kwargs
        )
        db.session.add(log)
        return log

    @classmethod
    def log_submission(cls, user_id, patient_id, submission_id, form_id, action='create_submission', **kwargs):
        """Log form submission action."""
        # Extract new_values from kwargs if present and merge with form_id
        new_values = kwargs.pop('new_values', {})
        new_values['form_id'] = str(form_id)

        return cls.log_action(
            user_id=user_id,
            action=action,
            entity_type='submission',
            entity_id=submission_id,
            patient_id=patient_id,
            new_values=new_values,
            **kwargs
        )

    @classmethod
    def log_patient_access(cls, user_id, patient_id, action='access_patient_data', consent_id=None, **kwargs):
        """Log patient data access."""
        return cls.log_action(
            user_id=user_id,
            action=action,
            entity_type='patient',
            entity_id=patient_id,
            patient_id=patient_id,
            consent_id=consent_id,
            consent_required=True,
            consent_verified=consent_id is not None,
            **kwargs
        )

    @classmethod
    def log_access_denied(cls, user_id, patient_id, action, reason):
        """Log denied access attempt."""
        return cls.log_action(
            user_id=user_id,
            action=action,
            entity_type='patient',
            patient_id=patient_id,
            success=False,
            error_message=f"Access denied: {reason}"
        )

    def to_dict(self):
        """Convert to dictionary."""
        data = super().to_dict()
        data['user_id'] = str(self.user_id) if self.user_id else None
        data['user_email'] = self.user_email
        data['user_role'] = self.user_role
        data['patient_id'] = str(self.patient_id) if self.patient_id else None
        data['action'] = self.action
        data['entity_type'] = self.entity_type
        data['entity_id'] = str(self.entity_id) if self.entity_id else None
        data['consent_id'] = str(self.consent_id) if self.consent_id else None
        data['consent_required'] = self.consent_required
        data['consent_verified'] = self.consent_verified
        data['old_values'] = self.old_values
        data['new_values'] = self.new_values
        data['http_method'] = self.http_method
        data['endpoint'] = self.endpoint
        data['ip_address'] = str(self.ip_address) if self.ip_address else None
        data['success'] = self.success
        data['error_message'] = self.error_message
        data['created_at'] = self.created_at.isoformat() if self.created_at else None
        data['duration_ms'] = self.duration_ms
        data['is_abdm_transaction'] = self.is_abdm_transaction
        data['abdm_transaction_id'] = self.abdm_transaction_id

        return data

    def __repr__(self):
        return f'<AuditLog {self.action} on {self.entity_type} by User {self.user_id}>'
