"""
Patient priority derivation — maps PPS score → clinical_complexity.

Meeting §2.1 (2026-04-14) requires priority to be INVERSELY proportional to
PPS: worse functional state (low PPS) = higher priority.

    PPS   0 – 40   → 'high'
    PPS  50 – 70   → 'medium'
    PPS  80 – 100  → 'low'
    No PPS         → None (displays as 'Not Yet Determined')

Flow:
  1. User saves a PPS (either via the Initial Assessment accordion
     or the universal PpsCard).
  2. `sync_patient_priority_from_pps(patient_id)` finds the latest row in
     `pps_scores` by `recorded_at` and writes the derived priority back to
     `patients.latest_pps_score` + `patients.clinical_complexity`.
"""
from typing import Optional
from uuid import UUID

from app.extensions import db
from app.patients.models import Patient
from app.saranam.models.pps_score import PpsScore


def derive_priority_from_pps(pps_score: Optional[int]) -> Optional[str]:
    """
    Map a PPS score to the clinical_complexity bucket.

    Args:
        pps_score: Integer 0-100 (multiples of 10), or None.

    Returns:
        'high' | 'medium' | 'low' | None.
    """
    if pps_score is None:
        return None
    if pps_score <= 40:
        return 'high'
    if pps_score <= 70:
        return 'medium'
    return 'low'


def get_latest_pps(patient_id) -> Optional[PpsScore]:
    """Return the most recent PpsScore row for a patient (by recorded_at)."""
    return (
        PpsScore.query
        .filter_by(patient_id=patient_id)
        .filter(PpsScore.pps_score.isnot(None))
        .order_by(PpsScore.recorded_at.desc())
        .first()
    )


def sync_patient_priority_from_pps(patient_id) -> dict:
    """
    Recompute `latest_pps_score` + `clinical_complexity` from the latest PPS
    record and persist them on the patient row.

    Safe to call repeatedly — idempotent. Commits the patient update. Caller
    is responsible for invalidating the scheduler pool cache afterwards.

    Args:
        patient_id: UUID (string or UUID type).

    Returns:
        {'latest_pps_score': int|None, 'clinical_complexity': str|None,
         'changed': bool}
    """
    patient = Patient.query.get(patient_id)
    if not patient:
        return {'latest_pps_score': None, 'clinical_complexity': None, 'changed': False}

    latest = get_latest_pps(patient_id)
    new_score = latest.pps_score if latest else None
    new_bucket = derive_priority_from_pps(new_score)

    # latest_pps_score + clinical_complexity are tied together: both derived
    # from the same source of truth (pps_scores.pps_score). Update atomically
    # so the card never shows "PPS: None  →  Priority: Low".
    changed = (
        patient.latest_pps_score != new_score
        or patient.clinical_complexity != new_bucket
    )
    if changed:
        patient.latest_pps_score = new_score
        patient.clinical_complexity = new_bucket
        db.session.commit()

    return {
        'latest_pps_score': new_score,
        'clinical_complexity': new_bucket,
        'changed': changed,
    }
