"""Inbound voice routing — when a patient calls our virtual number.

EnableX queries this endpoint when an inbound call hits +911169040030.
We:
  1. Look up the patient by caller phone (best-effort).
  2. Find the first on-duty HealthcareProvider (reusing CallLogAgentStatus).
  3. Create an inbound TeleSession row.
  4. Return a JSON action telling EnableX to bridge to the doctor.

If no doctor is on-duty: return a polite "we'll call back" greeting and
mark the session 'missed'.
"""
from __future__ import annotations
import os
import logging
from datetime import datetime
from typing import Optional

from app.extensions import db
from app.patients.models import Patient
from app.providers.models import HealthcareProvider
from app.call_logs.models import CallLogAgentStatus
from app.teleconsult.models.tele_session import (
    TeleSession,
    CHANNEL_VOICE,
    STATUS_RINGING,
    STATUS_MISSED,
    VENDOR_ENABLEX,
)

logger = logging.getLogger(__name__)


def _normalize_phone(raw: str) -> str:
    if not raw:
        return ""
    s = "".join(ch for ch in str(raw) if ch.isdigit())
    # Strip leading country prefix variants
    if s.startswith("00"):
        s = s[2:]
    if s.startswith("91") and len(s) > 10:
        s = s[-10:]
    if len(s) > 10:
        s = s[-10:]
    return s


def _find_patient_by_phone(phone: str) -> Optional[Patient]:
    if not phone:
        return None
    last10 = _normalize_phone(phone)
    if not last10:
        return None
    # Cheap scan: caregiver / decision-maker / alternative phone columns.
    candidates = (
        Patient.query.filter(
            (Patient.primary_caregiver_phone.like(f"%{last10}%"))
            | (Patient.decision_maker_phone.like(f"%{last10}%"))
            | (Patient.alternative_phone.like(f"%{last10}%"))
        )
        .limit(1)
        .all()
    )
    if candidates:
        return candidates[0]
    # Fallback: linear scan with decryption (slow). Skip for >1000 patients.
    if Patient.query.count() <= 1000:
        for p in Patient.query.all():
            try:
                if p.get_phone() and _normalize_phone(p.get_phone()) == last10:
                    return p
            except Exception:
                continue
    return None


def _find_on_duty_doctor() -> Optional[HealthcareProvider]:
    """First on-duty active provider, by longest on-duty time."""
    row = (
        db.session.query(HealthcareProvider)
        .join(CallLogAgentStatus, HealthcareProvider.id == CallLogAgentStatus.provider_id)
        .filter(HealthcareProvider.is_active.is_(True))
        .filter(CallLogAgentStatus.is_on_duty.is_(True))
        .order_by(CallLogAgentStatus.last_updated.asc())
        .first()
    )
    return row


def _doctor_phone(provider: Optional[HealthcareProvider]) -> Optional[str]:
    if not provider:
        return None
    try:
        return provider.get_phone() if hasattr(provider, "get_phone") else None
    except Exception:
        return None


def handle_inbound_call(payload: dict, request_args=None) -> dict:
    """Returns an EnableX action JSON to play + bridge, plus logs a session."""
    caller = (
        payload.get("from")
        or payload.get("caller")
        or (payload.get("data") or {}).get("from")
        or (request_args.get("from") if request_args else None)
    )
    voice_id = (
        payload.get("voice_id")
        or payload.get("call_id")
        or payload.get("id")
    )

    patient = _find_patient_by_phone(caller) if caller else None
    doctor = _find_on_duty_doctor()
    doctor_phone = _doctor_phone(doctor)
    caller_id = os.getenv("ENABLEX_VOICE_CALLER_ID", "")

    # Persist the inbound session
    session = TeleSession(
        patient_id=patient.id if patient else None,
        provider_id=doctor.id if doctor else None,
        channel=CHANNEL_VOICE,
        direction="inbound",
        provider_vendor=VENDOR_ENABLEX,
        vendor_session_id=voice_id,
        status=STATUS_RINGING if doctor_phone else STATUS_MISSED,
        started_at=datetime.utcnow(),
        notes=(
            f"Inbound from {caller or 'unknown'}"
            + (" — no on-duty doctor; routed to voicemail" if not doctor_phone else "")
        ),
        raw_payload={"inbound_payload": payload},
    )
    # patient_id is NOT NULL in our schema; if unknown caller, drop the row
    # rather than break — log it instead.
    if patient is None:
        logger.warning("Inbound call from unknown number: %s", caller)
        session = None
    else:
        try:
            db.session.add(session)
            db.session.commit()
        except Exception:
            logger.exception("failed to persist inbound TeleSession")
            db.session.rollback()
            session = None

    # ------------------------------------------------------------------
    # Build the EnableX response
    # ------------------------------------------------------------------
    if doctor_phone and caller_id:
        return {
            "action_on_connect": {
                "play": {
                    "text": (
                        "Connecting you with a Saranam Palliative Care doctor."
                    ),
                    "voice": "female",
                    "language": "en-US",
                    "prompt_ref": "1",
                },
                "connect": {
                    "from": caller_id,
                    "to": str(doctor_phone),
                },
            },
        }

    # No doctor on duty → polite greeting then hang up
    return {
        "action_on_connect": {
            "play": {
                "text": (
                    "Thank you for calling Saranam Palliative Care. "
                    "Our care team is unavailable right now. We will call you back shortly."
                ),
                "voice": "female",
                "language": "en-US",
                "prompt_ref": "1",
            }
        }
    }
