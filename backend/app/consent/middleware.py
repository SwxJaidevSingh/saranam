"""
Consent middleware - ABDM/DPDPA compliant consent checking.

Ensures all patient data access is consent-based.
"""

from functools import wraps
from flask import g, abort
from app.consent.models import ConsentArtifact
from app.audit.models import AuditLog
from datetime import datetime


def check_consent(patient_id, user_id, data_categories, raise_on_missing=True):
    """
    Check if valid consent exists for data access.

    Args:
        patient_id: UUID - Patient whose data is being accessed
        user_id: UUID - User requesting access
        data_categories: list - Categories of data being accessed
        raise_on_missing: bool - Whether to raise exception if no consent

    Returns:
        ConsentArtifact or None

    Raises:
        403 if consent missing and raise_on_missing=True
    """
    # Find valid consent
    now = datetime.utcnow()
    consent = ConsentArtifact.query.filter(
        ConsentArtifact.patient_id == patient_id,
        ConsentArtifact.granted_to_user_id == user_id,
        ConsentArtifact.status == 'active',
        ConsentArtifact.valid_from <= now,
        ConsentArtifact.valid_until >= now
    ).first()

    if not consent:
        if raise_on_missing:
            # Log denied access
            AuditLog.log_access_denied(
                user_id=user_id,
                patient_id=patient_id,
                action='access_patient_data',
                reason='no_valid_consent'
            )
            abort(403, description="No valid consent to access patient data")
        return None

    # Check if consent covers requested data categories
    for category in data_categories:
        if not consent.covers_data_category(category):
            if raise_on_missing:
                # Log denied access
                AuditLog.log_access_denied(
                    user_id=user_id,
                    patient_id=patient_id,
                    action='access_patient_data',
                    reason=f'consent_does_not_cover_{category}'
                )
                abort(403, description=f"Consent does not cover {category}")
            return None

    return consent


def require_consent(*data_categories):
    """
    Decorator to check consent before accessing patient data.

    Usage:
        @require_consent('observations', 'diagnoses')
        def get_patient_data(patient_id):
            ...

    Args:
        *data_categories: Categories of data that will be accessed
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get patient_id from kwargs or args
            patient_id = kwargs.get('patient_id')
            if not patient_id and len(args) > 0:
                patient_id = args[0]

            if not patient_id:
                abort(400, description="patient_id required for consent checking")

            # Get current user
            if not hasattr(g, 'current_user'):
                abort(401, description="Authentication required")

            user_id = g.current_user.id

            # Check consent
            consent = check_consent(
                patient_id=patient_id,
                user_id=user_id,
                data_categories=list(data_categories),
                raise_on_missing=True
            )

            # Store consent_id in request context for audit logging
            g.consent_id = consent.id if consent else None

            return f(*args, **kwargs)

        return decorated_function
    return decorator


def create_default_consent(patient_id, granted_to_user_id, purpose='CAREMGT', duration_days=365):
    """
    Create a default consent artifact for a patient.

    Useful for implicit consent during patient registration.

    Args:
        patient_id: UUID - Patient ID
        granted_to_user_id: UUID - User to grant consent to
        purpose: str - Purpose of consent (default: CAREMGT)
        duration_days: int - Consent validity in days (default: 1 year)

    Returns:
        ConsentArtifact
    """
    from app.extensions import db

    now = datetime.utcnow()
    consent = ConsentArtifact(
        patient_id=patient_id,
        consent_type='treatment',
        purpose=purpose,
        granted_to_user_id=granted_to_user_id,
        data_categories=['observations', 'diagnoses', 'form_answers', 'medications'],
        valid_from=now,
        valid_until=now + timedelta(days=duration_days),
        status='active',
        granted_at=now
    )

    db.session.add(consent)
    return consent


from datetime import timedelta  # Import for create_default_consent
