"""Vitals Service — unified patient vitals from all sources (Saranam, OPD, IPD)."""
from uuid import UUID
from datetime import datetime
from app.extensions import db
from app.saranam.models.patient_visit import PatientVisit

REFERENCE_RANGES = {
    'bp_systolic': {'min': 90, 'max': 140, 'unit': 'mmHg'},
    'bp_diastolic': {'min': 60, 'max': 90, 'unit': 'mmHg'},
    'pr': {'min': 60, 'max': 100, 'unit': 'bpm'},
    'spo2': {'min': 95, 'max': 100, 'unit': '%'},
    'temperature': {'min': 36.1, 'max': 37.2, 'unit': '\u00b0C'},
    'rr': {'min': 12, 'max': 20, 'unit': '/min'},
    'grbs': {'min': 70, 'max': 140, 'unit': 'mg/dL'},
}

VITAL_COLUMN_MAP = {
    'pr': 'vitals_pr',
    'bp_systolic': 'vitals_bp_systolic',
    'bp_diastolic': 'vitals_bp_diastolic',
    'rr': 'vitals_rr',
    'spo2': 'vitals_spo2',
    'temperature': 'vitals_temperature',
    'grbs': 'vitals_grbs',
}

# Map for extracting vitals from VitalsRecord JSON → our normalized keys
VR_KEY_MAP = {
    'bp_systolic': 'bp_systolic',
    'bp_diastolic': 'bp_diastolic',
    'pr': 'pulse',
    'rr': 'respiratory_rate',
    'spo2': 'spo2',
    'temperature': 'temperature',
    'grbs': 'blood_sugar',
}


def _safe_float(val):
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _extract_vitals_from_visit(visit):
    """Extract vitals dict from a PatientVisit row."""
    return {
        'pr': visit.vitals_pr,
        'bp_systolic': visit.vitals_bp_systolic,
        'bp_diastolic': visit.vitals_bp_diastolic,
        'rr': visit.vitals_rr,
        'spo2': _safe_float(visit.vitals_spo2),
        'temperature': _safe_float(visit.vitals_temperature),
        'grbs': _safe_float(visit.vitals_grbs),
    }


def _extract_vitals_from_record(vitals_data):
    """Extract vitals dict from a VitalsRecord.vitals_data JSON."""
    if not vitals_data or not isinstance(vitals_data, dict):
        return None
    result = {}
    for our_key, json_key in VR_KEY_MAP.items():
        result[our_key] = _safe_float(vitals_data.get(json_key))
    return result


def _compute_delta(current_vitals, baseline_vitals):
    """Compute change from baseline for each vital."""
    delta = {}
    for key in VITAL_COLUMN_MAP:
        curr = current_vitals.get(key)
        base = baseline_vitals.get(key)
        if curr is not None and base is not None:
            delta[key] = round(curr - base, 2)
        else:
            delta[key] = None
    return delta


def _source_label(visit_type, visit_location, visit_number):
    """Generate a human-readable source label."""
    if visit_type == 'initial':
        return 'Initial Assessment'
    if visit_location == 'opd':
        return 'OPD Visit'
    if visit_location == 'ipd':
        return 'IPD Visit'
    if visit_location == 'home':
        return f'Home Care #{visit_number}'
    if visit_type == 'follow_up':
        return f'Follow-up #{visit_number}'
    if visit_type == 'emergency':
        return 'Emergency'
    if visit_type == 'phone':
        return f'Phone #{visit_number}'
    return f'Visit #{visit_number}'


def _source_type(visit_type, visit_location, encounter_type=None):
    """Return a machine-readable source type for coloring."""
    if encounter_type == 'OPD':
        return 'opd'
    if encounter_type == 'IPD':
        return 'ipd'
    if visit_type == 'initial':
        return 'initial'
    if visit_location == 'home':
        return 'home_care'
    if visit_location == 'opd':
        return 'opd'
    if visit_location == 'ipd':
        return 'ipd'
    return 'follow_up'


class VitalsService:

    @staticmethod
    def get_patient_vitals_trend(patient_id: UUID) -> dict:
        """Get unified time-series vitals from ALL sources for a patient."""
        all_records = []

        # ── 1. Saranam PatientVisit vitals ──
        visits = (
            PatientVisit.query
            .filter_by(patient_id=patient_id)
            .filter(PatientVisit.status.in_(['completed', 'in_progress']))
            .order_by(PatientVisit.visit_date.asc(), PatientVisit.visit_number.asc())
            .all()
        )

        for v in visits:
            vitals = _extract_vitals_from_visit(v)
            if all(val is None for val in vitals.values()):
                continue
            all_records.append({
                'visit_id': str(v.id),
                'visit_number': v.visit_number,
                'visit_type': v.visit_type,
                'visit_date': v.visit_date.isoformat() if v.visit_date else None,
                'sort_key': datetime.combine(v.visit_date, datetime.min.time()) if v.visit_date else datetime.min,
                'source': _source_label(v.visit_type, v.visit_location, v.visit_number),
                'source_type': _source_type(v.visit_type, v.visit_location),
                'vitals': vitals,
            })

        # ── 2. OPD / IPD VitalsRecord vitals ──
        try:
            from app.ipd.models import VitalsRecord
            from app.encounters.models import Encounter

            vr_records = (
                db.session.query(VitalsRecord, Encounter)
                .join(Encounter, VitalsRecord.encounter_id == Encounter.id)
                .filter(VitalsRecord.patient_id == patient_id)
                .order_by(VitalsRecord.recorded_at.asc())
                .all()
            )

            for vr, enc in vr_records:
                vitals = _extract_vitals_from_record(vr.vitals_data)
                if not vitals or all(val is None for val in vitals.values()):
                    continue

                enc_type = enc.encounter_type or 'OPD'
                rec_date = vr.recorded_at or enc.start_time

                all_records.append({
                    'visit_id': str(vr.id),
                    'visit_number': None,
                    'visit_type': enc_type.lower(),
                    'visit_date': rec_date.strftime('%Y-%m-%d') if rec_date else None,
                    'sort_key': rec_date if rec_date else datetime.min,
                    'source': f'{enc_type} Visit',
                    'source_type': _source_type(None, None, enc_type),
                    'vitals': vitals,
                })
        except Exception:
            pass  # If IPD/OPD models not available, skip silently

        if not all_records:
            return {
                'baseline': None,
                'reference_ranges': REFERENCE_RANGES,
                'visits': [],
                'total': 0,
            }

        # Sort all records chronologically
        all_records.sort(key=lambda r: r['sort_key'])

        # Find baseline: first initial visit, or earliest record
        baseline_record = next(
            (r for r in all_records if r.get('source_type') == 'initial'),
            all_records[0],
        )
        baseline_vitals = baseline_record['vitals']

        # Compute deltas and clean up sort_key
        for r in all_records:
            r['change_from_baseline'] = _compute_delta(r['vitals'], baseline_vitals)
            del r['sort_key']

        return {
            'baseline': baseline_vitals,
            'reference_ranges': REFERENCE_RANGES,
            'visits': all_records,
            'total': len(all_records),
        }
