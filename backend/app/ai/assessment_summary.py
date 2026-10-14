"""LLM-backed clinical summary service.

Two entry points:

- summarize_assessment(visit_id, assessment_type) — per-form summary.
- summarize_patient(patient_id) — holistic patient-level summary.

Both call Google Gemini Flash via the existing `get_llm_provider` factory in
`app.ai.llm_providers`. The API key is read from the `GEMINI_API_KEY` env var
(no per-request keys, no per-user keys). On any failure the caller gets a
ValueError with a clinician-readable message — there is no silent fallback.
"""
from __future__ import annotations

import os
from datetime import date, datetime
from typing import Optional, Tuple
from uuid import UUID

import json

from app.ai.llm_providers import get_llm_provider
from app.ai.assessment_summary_prompts import (
    ASSESSMENT_SUMMARY_SYSTEM,
    PATIENT_COMBINED_STRUCTURED_SYSTEM,
    FOLLOWUP_VISIT_STRUCTURED_SYSTEM,
    build_form_user_prompt,
    build_patient_structured_user_prompt,
    build_followup_visit_user_prompt,
)
from app.ai.body_locations import (
    BODY_ZONE_SLUGS,
    validate_ai_locations,
)
from app.saranam.services.assessment_service import ASSESSMENT_MODELS
from app.saranam.models.patient_visit import PatientVisit
from app.saranam.models.nursing_assessment import NursingAssessment
from app.saranam.models.doctor_assessment import DoctorAssessment
from app.saranam.models.psychological_assessment import PsychologicalAssessment
from app.saranam.models.physiotherapy_assessment import PhysiotherapyAssessment
from app.saranam.models.esas_score import EsasScore
from app.saranam.models.pps_score import PpsScore
from app.saranam.models.plan_of_care import PlanOfCare
from app.saranam.models.procedures_record import ProceduresRecord
from app.patients.models import Patient


SUPPORTED_FORM_TYPES = ('nursing', 'doctor', 'psychological', 'physiotherapy')

DEFAULT_MODEL = os.getenv('GEMINI_MODEL', 'gemini-2.5-flash')


def _get_provider():
    # Primary env var: SARANAM_SUMMARY_KEY (the dedicated Gemini key for the
    # assessment-summary feature). Falls back to GEMINI_API_KEY for any
    # alternate setups.
    api_key = os.getenv('SARANAM_SUMMARY_KEY') or os.getenv('GEMINI_API_KEY')
    if not api_key:
        raise ValueError(
            "AI summary unavailable: SARANAM_SUMMARY_KEY is not configured on the server."
        )
    return get_llm_provider('gemini', api_key=api_key, model=DEFAULT_MODEL), DEFAULT_MODEL


def _generate(system: str, user: str) -> str:
    provider, _model = _get_provider()
    try:
        text = provider.generate(
            messages=[
                {'role': 'system', 'content': system},
                {'role': 'user', 'content': user},
            ],
            # gemini-2.5-flash spends output tokens on hidden "thinking" before
            # emitting the visible reply. Keep this high enough that thinking +
            # paragraph both fit; otherwise the response gets truncated mid-sentence.
            temperature=0.2,
            max_tokens=8000,
        )
    except Exception as e:  # provider-specific failures bubble up as ValueError
        raise ValueError(f"AI summary generation failed: {e}")
    return (text or '').strip()


def summarize_assessment(visit_id: UUID, assessment_type: str) -> Tuple[str, str]:
    """Generate a per-form clinical summary. Returns (summary_text, model_name)."""
    if assessment_type not in SUPPORTED_FORM_TYPES:
        raise ValueError(
            f"AI summary not supported for assessment type '{assessment_type}'. "
            f"Supported: {', '.join(SUPPORTED_FORM_TYPES)}."
        )
    model_cls = ASSESSMENT_MODELS[assessment_type]
    record = model_cls.query.filter_by(visit_id=visit_id).first()
    if record is None:
        raise ValueError(
            "Save the assessment first — there is nothing to summarize yet."
        )

    user_prompt = build_form_user_prompt(record.to_dict(), assessment_type)
    text = _generate(ASSESSMENT_SUMMARY_SYSTEM, user_prompt)
    return text, DEFAULT_MODEL


# ─── Patient-level (combined) summary ─────────────────────────────────────

def _calc_age(dob: Optional[date]) -> Optional[int]:
    if not dob:
        return None
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def _latest_for_patient(model_cls, patient_id: UUID, order_col: str):
    """Return the most-recent row (by `order_col`) for this patient, or None."""
    col = getattr(model_cls, order_col, None) or getattr(model_cls, 'updated_at')
    return (
        model_cls.query
        .filter_by(patient_id=patient_id)
        .order_by(col.desc())
        .first()
    )


def _strip_record(d: Optional[dict]) -> dict:
    if not d:
        return {}
    drop = {
        'id', 'patient_id', 'visit_id', 'assessed_by', 'recorded_by',
        'created_by', 'created_at', 'updated_at', 'ai_summary',
    }
    return {k: v for k, v in d.items() if k not in drop and v not in (None, '', [], {})}


def _build_patient_bundle(patient_id: UUID) -> dict:
    patient = Patient.query.get(patient_id)
    if patient is None:
        raise ValueError("Patient not found.")

    bundle: dict = {
        'patient': {
            'name': patient.full_name,
            'uhid': patient.uhid,
            'age': _calc_age(patient.date_of_birth),
            'gender': patient.gender,
            'diagnosis': patient.diagnosis,
            'referred_from': patient.referred_from,
            'bsc_status': (
                'Best Supportive Care' if patient.bsc_status is True
                else 'Non-BSC' if patient.bsc_status is False
                else None
            ),
            'is_onco': (
                'Oncology' if patient.is_onco is True
                else 'Non-oncology' if patient.is_onco is False
                else None
            ),
            'latest_pps_score': patient.latest_pps_score,
            'clinical_complexity': patient.clinical_complexity,
            'care_status': patient.care_status,
            'is_deceased': patient.is_deceased,
            'date_of_death': patient.date_of_death.isoformat() if patient.date_of_death else None,
            'primary_caregiver': (
                f"{patient.primary_caregiver_name} ({patient.primary_caregiver_relationship})"
                if patient.primary_caregiver_name else None
            ),
        },
    }

    # Latest of each assessment type — across all visits.
    bundle['doctor']        = _strip_record(_record_dict(_latest_for_patient(DoctorAssessment, patient_id, 'assessed_at')))
    bundle['nursing']       = _strip_record(_record_dict(_latest_for_patient(NursingAssessment, patient_id, 'assessed_at')))
    bundle['psychological'] = _strip_record(_record_dict(_latest_for_patient(PsychologicalAssessment, patient_id, 'assessed_at')))
    bundle['physiotherapy'] = _strip_record(_record_dict(_latest_for_patient(PhysiotherapyAssessment, patient_id, 'assessed_at')))
    bundle['esas']          = _strip_record(_record_dict(_latest_for_patient(EsasScore, patient_id, 'recorded_at')))
    bundle['pps']           = _strip_record(_record_dict(_latest_for_patient(PpsScore, patient_id, 'recorded_at')))
    bundle['care_plan']     = _strip_record(_record_dict(_latest_for_patient(PlanOfCare, patient_id, 'updated_at')))
    bundle['procedures']    = _strip_record(_record_dict(_latest_for_patient(ProceduresRecord, patient_id, 'updated_at')))

    # Last 5 visits — visit_summary lines if present.
    recent = (
        PatientVisit.query
        .filter_by(patient_id=patient_id)
        .order_by(PatientVisit.visit_date.desc())
        .limit(5)
        .all()
    )
    bundle['recent_visits'] = [
        {
            'visit_date': v.visit_date.isoformat() if v.visit_date else None,
            'visit_type': v.visit_type,
            'visit_summary': v.visit_summary,
        }
        for v in recent
        if v.visit_summary
    ]
    return bundle


def _record_dict(record):
    return record.to_dict() if record is not None else None


BLOCK_KEYS = ('nursing', 'psychosocial', 'physiotherapy')


def summarize_patient(patient_id: UUID, previous_locations: list = None) -> Tuple[dict, list, str]:
    """Generate per-block patient-summary narratives + body-location highlights.

    Returns (blocks, body_locations, model_name) where blocks is a dict with
    keys: nursing, psychosocial, physiotherapy — each a short clinical
    paragraph.

    Demographics, diagnosis, chief complaints, and raw ESAS/PPS scores are
    rendered by the UI directly from form data; this function intentionally
    does NOT ask the AI to produce them.
    """
    bundle = _build_patient_bundle(patient_id)
    user_prompt = build_patient_structured_user_prompt(
        bundle,
        valid_slugs=list(BODY_ZONE_SLUGS),
        previous_locations=previous_locations or [],
    )

    response_schema = {
        'type': 'object',
        'properties': {
            'nursing':        {'type': 'string'},
            'psychosocial':   {'type': 'string'},
            'physiotherapy':  {'type': 'string'},
            'body_locations': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'slug': {'type': 'string', 'enum': list(BODY_ZONE_SLUGS)},
                        'label': {'type': 'string'},
                    },
                    'required': ['slug', 'label'],
                },
            },
        },
        'required': ['nursing', 'psychosocial', 'physiotherapy', 'body_locations'],
    }

    provider, _ = _get_provider()
    try:
        raw = provider.generate_json(
            messages=[
                {'role': 'system', 'content': PATIENT_COMBINED_STRUCTURED_SYSTEM},
                {'role': 'user', 'content': user_prompt},
            ],
            response_schema=response_schema,
            temperature=0.2,
            max_tokens=8000,
        )
    except Exception as e:
        raise ValueError(f"AI summary generation failed: {e}")

    try:
        parsed = json.loads(raw or '{}')
    except json.JSONDecodeError as e:
        raise ValueError(f"AI returned malformed JSON: {e}")

    blocks = {k: (parsed.get(k) or '').strip() for k in BLOCK_KEYS}
    body_locations_raw = parsed.get('body_locations') or []
    body_locations_clean = validate_ai_locations(body_locations_raw)

    if not any(blocks.values()):
        raise ValueError("AI returned empty narrative blocks.")

    return blocks, body_locations_clean, DEFAULT_MODEL


def flatten_blocks(blocks: dict) -> str:
    """Render a blocks dict into a single text fallback for legacy consumers
    (PDF, summary_text column). Each block is prefixed with its title.
    """
    if not blocks:
        return ''
    titles = {
        'nursing':       'Nursing Assessment',
        'psychosocial':  'Psychosocial Assessment',
        'physiotherapy': 'Physiotherapy Assessment',
    }
    parts = []
    for k in BLOCK_KEYS:
        body = (blocks.get(k) or '').strip()
        if not body:
            continue
        parts.append(f"{titles.get(k, k.title())}\n{body}")
    return '\n\n'.join(parts)


# ─── Per-visit follow-up summary (2026-05-13 client meeting) ──────────────

# How many previous follow-up summaries to feed into the prompt as context.
# Confirmed scope: 3.
FOLLOWUP_LOOKBACK = 3


def _build_visit_bundle(visit_id: UUID) -> dict:
    """Pull THIS visit's assessments + scores into the prompt-ready shape."""
    visit = PatientVisit.query.get(visit_id)
    if visit is None:
        raise ValueError("Visit not found.")

    bundle: dict = {
        'visit_meta': {
            'visit_date': visit.visit_date.isoformat() if visit.visit_date else None,
            'visit_type': visit.visit_type,
            'visit_location': visit.visit_location,
            'visit_number': visit.visit_number,
            'visit_summary': visit.visit_summary,
        },
    }

    def _visit_record(model_cls):
        rec = model_cls.query.filter_by(visit_id=visit_id).first()
        return _strip_record(_record_dict(rec))

    bundle['doctor']        = _visit_record(DoctorAssessment)
    bundle['nursing']       = _visit_record(NursingAssessment)
    bundle['psychological'] = _visit_record(PsychologicalAssessment)
    bundle['physiotherapy'] = _visit_record(PhysiotherapyAssessment)
    bundle['esas']          = _visit_record(EsasScore)
    bundle['pps']           = _visit_record(PpsScore)
    bundle['procedures']    = _visit_record(ProceduresRecord)
    return bundle, visit


def summarize_followup_visit(
    visit_id: UUID,
    previous_locations: list = None,
) -> Tuple[str, list, str]:
    """Generate a follow-up visit summary + per-visit body-map highlights.

    Returns (summary_text, body_locations, model_name).

    Pulls:
      - the patient-level baseline (PatientAiSummary.summary_text), if any
      - the last FOLLOWUP_LOOKBACK VisitAiSummary rows for this patient,
        excluding the current visit, ordered oldest → newest
      - all assessment + score data captured on THIS visit

    The AI is asked to write a CHANGE-FOCUSED note rather than a comprehensive
    chart summary, and to evolve the body-locations list as a delta from the
    previous visit's locations (passed via `previous_locations`).
    """
    bundle, visit = _build_visit_bundle(visit_id)
    patient_id = visit.patient_id

    # Pull baseline summary (may be absent)
    from app.saranam.models.patient_ai_summary import PatientAiSummary
    from app.saranam.models.visit_ai_summary import VisitAiSummary

    baseline = (
        PatientAiSummary.query
        .filter_by(patient_id=patient_id)
        .first()
    )
    baseline_text = baseline.summary_text if baseline else None

    # Pull last N prior follow-up summaries (exclude this visit if it already exists)
    prior_rows = (
        VisitAiSummary.query
        .filter(VisitAiSummary.patient_id == patient_id)
        .filter(VisitAiSummary.visit_id != visit_id)
        .order_by(VisitAiSummary.generated_at.desc())
        .limit(FOLLOWUP_LOOKBACK)
        .all()
    )
    # Reverse to oldest-first so the AI sees temporal order
    prior_rows.reverse()

    # Look up visit_date for each prior row for nicer prompt formatting
    prior_visit_ids = [r.visit_id for r in prior_rows]
    visit_date_lookup: dict = {}
    if prior_visit_ids:
        for v in PatientVisit.query.filter(PatientVisit.id.in_(prior_visit_ids)).all():
            visit_date_lookup[v.id] = v.visit_date.isoformat() if v.visit_date else None

    previous_followups = [
        {
            'visit_date': visit_date_lookup.get(r.visit_id),
            'summary_text': r.summary_text,
        }
        for r in prior_rows
    ]

    # If the caller didn't pass previous_locations, use the most-recent visit
    # summary's body_locations as the starting state.
    if previous_locations is None:
        previous_locations = prior_rows[-1].body_locations if prior_rows else []

    user_prompt = build_followup_visit_user_prompt(
        visit_bundle=bundle,
        baseline_summary=baseline_text,
        previous_followups=previous_followups,
        valid_slugs=list(BODY_ZONE_SLUGS),
        previous_locations=previous_locations or [],
    )

    response_schema = {
        'type': 'object',
        'properties': {
            'summary': {'type': 'string'},
            'body_locations': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'slug': {'type': 'string', 'enum': list(BODY_ZONE_SLUGS)},
                        'label': {'type': 'string'},
                    },
                    'required': ['slug', 'label'],
                },
            },
        },
        'required': ['summary', 'body_locations'],
    }

    provider, _ = _get_provider()
    try:
        raw = provider.generate_json(
            messages=[
                {'role': 'system', 'content': FOLLOWUP_VISIT_STRUCTURED_SYSTEM},
                {'role': 'user', 'content': user_prompt},
            ],
            response_schema=response_schema,
            temperature=0.2,
            max_tokens=8000,
        )
    except Exception as e:
        raise ValueError(f"AI summary generation failed: {e}")

    try:
        parsed = json.loads(raw or '{}')
    except json.JSONDecodeError as e:
        raise ValueError(f"AI returned malformed JSON: {e}")

    summary = (parsed.get('summary') or '').strip()
    body_locations_raw = parsed.get('body_locations') or []
    body_locations_clean = validate_ai_locations(body_locations_raw)

    if not summary:
        raise ValueError("AI returned an empty summary.")

    return summary, body_locations_clean, DEFAULT_MODEL
