"""
Audit middleware - Automatic audit logging for all requests.

Logs all patient data access and system actions for compliance.
"""

from functools import wraps
from flask import request, g
from app.audit.models import AuditLog
from app.extensions import db
import time


def audit_action(action, entity_type, get_entity_id=None, get_patient_id=None):
    """
    Decorator to automatically log actions.

    Usage:
        @audit_action('read', 'patient', get_entity_id=lambda kwargs: kwargs['patient_id'])
        def get_patient(patient_id):
            ...

    Args:
        action: str - Action type (create, read, update, delete, etc.)
        entity_type: str - Type of entity
        get_entity_id: callable - Function to extract entity_id from kwargs
        get_patient_id: callable - Function to extract patient_id from kwargs
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            start_time = time.time()

            # Extract IDs
            entity_id = get_entity_id(kwargs) if get_entity_id else kwargs.get('id')
            patient_id = get_patient_id(kwargs) if get_patient_id else kwargs.get('patient_id')

            # Get current user
            user = getattr(g, 'current_user', None)
            user_id = user.id if user else None
            user_email = user.email if user else None
            user_role = user.role if user else None

            # Get consent_id if available
            consent_id = getattr(g, 'consent_id', None)

            try:
                # Execute function
                result = f(*args, **kwargs)

                # Calculate duration
                duration_ms = int((time.time() - start_time) * 1000)

                # Log successful action
                AuditLog.log_action(
                    user_id=user_id,
                    action=action,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    patient_id=patient_id,
                    user_email=user_email,
                    user_role=user_role,
                    consent_id=consent_id,
                    consent_required=patient_id is not None,
                    consent_verified=consent_id is not None if patient_id else None,
                    http_method=request.method,
                    endpoint=request.endpoint,
                    ip_address=request.remote_addr,
                    user_agent=request.user_agent.string if request.user_agent else None,
                    success=True,
                    duration_ms=duration_ms
                )

                db.session.commit()
                return result

            except Exception as e:
                # Calculate duration
                duration_ms = int((time.time() - start_time) * 1000)

                # Log failed action
                AuditLog.log_action(
                    user_id=user_id,
                    action=action,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    patient_id=patient_id,
                    user_email=user_email,
                    user_role=user_role,
                    http_method=request.method,
                    endpoint=request.endpoint,
                    ip_address=request.remote_addr,
                    user_agent=request.user_agent.string if request.user_agent else None,
                    success=False,
                    error_message=str(e),
                    duration_ms=duration_ms
                )

                db.session.commit()
                raise

        return decorated_function
    return decorator


def log_data_access(patient_id, data_type, entity_ids=None):
    """
    Manually log data access (for complex scenarios).

    Args:
        patient_id: UUID - Patient whose data was accessed
        data_type: str - Type of data accessed
        entity_ids: list - IDs of specific records accessed
    """
    user = getattr(g, 'current_user', None)
    consent_id = getattr(g, 'consent_id', None)

    AuditLog.log_patient_access(
        user_id=user.id if user else None,
        patient_id=patient_id,
        action='access_patient_data',
        consent_id=consent_id,
        user_email=user.email if user else None,
        user_role=user.role if user else None,
        new_values={'data_type': data_type, 'entity_ids': entity_ids},
        http_method=request.method,
        endpoint=request.endpoint,
        ip_address=request.remote_addr,
        user_agent=request.user_agent.string if request.user_agent else None
    )

    db.session.commit()
