"""Vitals Analytics Service — population-level vitals analysis across all patients."""
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional
from sqlalchemy import func, and_, or_
from app.extensions import db
from app.saranam.models.patient_visit import PatientVisit
from app.saranam.models.esas_score import EsasScore
from app.saranam.models.pps_score import PpsScore
from app.patients.models import Patient

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
    'bp_systolic': 'vitals_bp_systolic',
    'bp_diastolic': 'vitals_bp_diastolic',
    'pr': 'vitals_pr',
    'spo2': 'vitals_spo2',
    'temperature': 'vitals_temperature',
    'rr': 'vitals_rr',
    'grbs': 'vitals_grbs',
}

THRESHOLDS = {
    'bp_systolic': 5, 'bp_diastolic': 5, 'pr': 5,
    'spo2': 1, 'temperature': 0.2, 'rr': 2, 'grbs': 10,
}

DISTRIBUTION_BUCKETS = {
    'bp_systolic': [(0, 90, '<90'), (90, 100, '90-100'), (100, 120, '100-120'), (120, 140, '120-140'), (140, 160, '140-160'), (160, 999, '>160')],
    'bp_diastolic': [(0, 60, '<60'), (60, 70, '60-70'), (70, 80, '70-80'), (80, 90, '80-90'), (90, 100, '90-100'), (100, 999, '>100')],
    'pr': [(0, 60, '<60'), (60, 70, '60-70'), (70, 80, '70-80'), (80, 90, '80-90'), (90, 100, '90-100'), (100, 999, '>100')],
    'spo2': [(0, 90, '<90'), (90, 92, '90-92'), (92, 95, '92-95'), (95, 97, '95-97'), (97, 99, '97-99'), (99, 101, '99-100')],
    'temperature': [(34, 36, '<36'), (36, 36.5, '36-36.5'), (36.5, 37, '36.5-37'), (37, 37.5, '37-37.5'), (37.5, 38, '37.5-38'), (38, 42, '>38')],
    'rr': [(0, 12, '<12'), (12, 16, '12-16'), (16, 20, '16-20'), (20, 24, '20-24'), (24, 30, '24-30'), (30, 999, '>30')],
    'grbs': [(0, 70, '<70'), (70, 100, '70-100'), (100, 140, '100-140'), (140, 200, '140-200'), (200, 300, '200-300'), (300, 9999, '>300')],
}


def _num(val):
    """Coerce a vital value to float, or None if it isn't numeric.

    vitals_temperature is free-text (it may hold non-numeric values like
    'Afebrile'), so any population-level math must skip those rather than crash.
    """
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _classify_change(vital_key, initial_val, latest_val):
    """Classify a vital's change as improved, stable, or deteriorated."""
    initial_val = _num(initial_val)
    latest_val = _num(latest_val)
    if initial_val is None or latest_val is None:
        return None
    ref = REFERENCE_RANGES[vital_key]
    center = (ref['min'] + ref['max']) / 2
    initial_distance = abs(initial_val - center)
    latest_distance = abs(latest_val - center)
    threshold = THRESHOLDS[vital_key]

    if latest_distance < initial_distance - threshold:
        return 'improved'
    elif latest_distance > initial_distance + threshold:
        return 'deteriorated'
    return 'stable'


def _parse_datetime(val: Optional[str]) -> Optional[datetime]:
    if not val:
        return None
    val = val.strip()
    if val.endswith('Z'):
        val = val[:-1] + '+00:00'
    
    # Clean timezone offset colons
    if '+' in val:
        parts = val.split('+')
        if len(parts) == 2 and ':' in parts[1]:
            val = parts[0] + '+' + parts[1].replace(':', '')
    elif '-' in val[10:]:
        parts = val.split('-')
        if len(parts) >= 2 and ':' in parts[-1]:
            val = '-'.join(parts[:-1]) + '-' + parts[-1].replace(':', '')

    try:
        t_part = val.split('.')[0]
        if '+' in val:
            offset_part = val.split('+')[-1]
            val_clean = t_part + '+' + offset_part
            dt = datetime.strptime(val_clean, '%Y-%m-%dT%H:%M:%S+%z')
        elif '-' in val[10:]:
            offset_part = val.split('-')[-1]
            val_clean = t_part + '-' + offset_part
            dt = datetime.strptime(val_clean, '%Y-%m-%dT%H:%M:%S-%z')
        else:
            dt = datetime.strptime(t_part, '%Y-%m-%dT%H:%M:%S')
        
        if dt.tzinfo is not None:
            dt = dt.replace(tzinfo=None)
        return dt
    except Exception:
        try:
            d_str = val.split('T')[0]
            d = date.fromisoformat(d_str)
            return datetime(d.year, d.month, d.day)
        except Exception:
            return None


def _get_initial_and_latest_visits(start_date=None, end_date=None, patient_status=None, age_group=None):
    """Get initial and latest completed visits for each patient that has at least 2 visits, filtered by date range."""
    from app.patients.models import Patient
    from app.analytics.services import AnalyticsService

    # Subquery: min visit number per patient (initial)
    initial_q = db.session.query(
        PatientVisit.patient_id,
        func.min(PatientVisit.visit_number).label('min_num'),
    ).join(Patient, PatientVisit.patient_id == Patient.id).filter(PatientVisit.status.in_(['completed', 'in_progress']))
    
    if start_date:
        initial_q = initial_q.filter(PatientVisit.created_at >= start_date)
    if end_date:
        initial_q = initial_q.filter(PatientVisit.created_at <= end_date)
        
    initial_q = AnalyticsService.apply_patient_filters(initial_q, Patient, patient_status, age_group)
    initial_sq = initial_q.group_by(PatientVisit.patient_id).subquery()

    # Subquery: max visit number per patient (latest)
    latest_q = db.session.query(
        PatientVisit.patient_id,
        func.max(PatientVisit.visit_number).label('max_num'),
    ).join(Patient, PatientVisit.patient_id == Patient.id).filter(PatientVisit.status.in_(['completed', 'in_progress']))
    
    if start_date:
        latest_q = latest_q.filter(PatientVisit.created_at >= start_date)
    if end_date:
        latest_q = latest_q.filter(PatientVisit.created_at <= end_date)
        
    latest_q = AnalyticsService.apply_patient_filters(latest_q, Patient, patient_status, age_group)
    latest_sq = latest_q.group_by(PatientVisit.patient_id).having(func.count(PatientVisit.id) >= 2).subquery()

    # Fetch initial visits
    initial_visits = (
        db.session.query(PatientVisit)
        .join(initial_sq, and_(
            PatientVisit.patient_id == initial_sq.c.patient_id,
            PatientVisit.visit_number == initial_sq.c.min_num,
        ))
        .join(latest_sq, PatientVisit.patient_id == latest_sq.c.patient_id)
        .all()
    )

    # Fetch latest visits
    latest_visits = (
        db.session.query(PatientVisit)
        .join(latest_sq, and_(
            PatientVisit.patient_id == latest_sq.c.patient_id,
            PatientVisit.visit_number == latest_sq.c.max_num,
        ))
        .all()
    )

    initial_map = {str(v.patient_id): v for v in initial_visits}
    latest_map = {str(v.patient_id): v for v in latest_visits}

    return initial_map, latest_map


class VitalsAnalyticsService:

    @staticmethod
    def get_vitals_summary(start_date=None, end_date=None, patient_status=None, age_group=None) -> Dict:
        """Population-level vitals improvement summary."""
        sd = _parse_datetime(start_date)
        ed = _parse_datetime(end_date)
        initial_map, latest_map = _get_initial_and_latest_visits(sd, ed, patient_status, age_group)

        # Only patients present in both maps
        patient_ids = set(initial_map.keys()) & set(latest_map.keys())

        vitals_summary = {}
        for vital_key, col_name in VITAL_COLUMN_MAP.items():
            counts = {'improved': 0, 'stable': 0, 'deteriorated': 0}
            initial_vals = []
            latest_vals = []

            for pid in patient_ids:
                init_val = getattr(initial_map[pid], col_name)
                lat_val = getattr(latest_map[pid], col_name)
                classification = _classify_change(vital_key, init_val, lat_val)
                if classification:
                    counts[classification] += 1
                init_num = _num(init_val)
                if init_num is not None:
                    initial_vals.append(init_num)
                lat_num = _num(lat_val)
                if lat_num is not None:
                    latest_vals.append(lat_num)

            total_classified = sum(counts.values())
            avg_initial = round(sum(initial_vals) / len(initial_vals), 1) if initial_vals else None
            avg_latest = round(sum(latest_vals) / len(latest_vals), 1) if latest_vals else None
            avg_change = round(avg_latest - avg_initial, 1) if avg_initial is not None and avg_latest is not None else None

            vitals_summary[vital_key] = {
                **counts,
                'total_classified': total_classified,
                'avg_initial': avg_initial,
                'avg_latest': avg_latest,
                'avg_change': avg_change,
                'unit': REFERENCE_RANGES[vital_key]['unit'],
            }

        # Overall improvement rate
        total_improved = sum(v['improved'] for v in vitals_summary.values())
        total_classified = sum(v['total_classified'] for v in vitals_summary.values())
        overall_improvement_rate = round(total_improved / total_classified * 100, 1) if total_classified > 0 else 0

        return {
            'total_patients_with_vitals': len(patient_ids),
            'vitals_summary': vitals_summary,
            'overall_improvement_rate': overall_improvement_rate,
            'reference_ranges': REFERENCE_RANGES,
        }

    @staticmethod
    def get_vitals_distribution(start_date=None, end_date=None, patient_status=None, age_group=None) -> Dict:
        """Distribution of latest vital values across the patient population."""
        sd = _parse_datetime(start_date)
        ed = _parse_datetime(end_date)
        
        from app.patients.models import Patient
        from app.analytics.services import AnalyticsService

        # Get latest visit per patient
        latest_q = (
            db.session.query(
                PatientVisit.patient_id,
                func.max(PatientVisit.visit_number).label('max_num'),
            )
            .join(Patient, PatientVisit.patient_id == Patient.id)
            .filter(PatientVisit.status.in_(['completed', 'in_progress']))
        )
        if sd:
            latest_q = latest_q.filter(PatientVisit.created_at >= sd)
        if ed:
            latest_q = latest_q.filter(PatientVisit.created_at <= ed)
            
        latest_q = AnalyticsService.apply_patient_filters(latest_q, Patient, patient_status, age_group)
        latest_sq = latest_q.group_by(PatientVisit.patient_id).subquery()

        latest_visits = (
            db.session.query(PatientVisit)
            .join(latest_sq, and_(
                PatientVisit.patient_id == latest_sq.c.patient_id,
                PatientVisit.visit_number == latest_sq.c.max_num,
            ))
            .all()
        )

        distribution = {}
        for vital_key, col_name in VITAL_COLUMN_MAP.items():
            buckets = DISTRIBUTION_BUCKETS[vital_key]
            bucket_counts = {b[2]: 0 for b in buckets}

            for visit in latest_visits:
                val = _num(getattr(visit, col_name))
                if val is None:
                    continue
                for low, high, label in buckets:
                    if low <= val < high:
                        bucket_counts[label] += 1
                        break

            distribution[vital_key] = {
                'buckets': [{'range': label, 'count': count} for label, count in bucket_counts.items()],
                'total': sum(bucket_counts.values()),
                'unit': REFERENCE_RANGES[vital_key]['unit'],
                'normal_range': f"{REFERENCE_RANGES[vital_key]['min']}-{REFERENCE_RANGES[vital_key]['max']}",
            }

        return distribution

    @staticmethod
    def get_vitals_correlation(score_type: str = 'esas', start_date=None, end_date=None) -> Dict:
        """Correlate vitals changes with ESAS/PPS score changes."""
        sd = _parse_datetime(start_date)
        ed = _parse_datetime(end_date)
        initial_map, latest_map = _get_initial_and_latest_visits(sd, ed)
        patient_ids = set(initial_map.keys()) & set(latest_map.keys())

        # Get initial and latest scores per patient
        score_deltas = {}
        for pid in patient_ids:
            if score_type == 'esas':
                scores = (
                    EsasScore.query
                    .filter_by(patient_id=pid)
                    .order_by(EsasScore.recorded_at.asc())
                    .all()
                )
                if len(scores) >= 2:
                    init_score = scores[0].total_score
                    lat_score = scores[-1].total_score
                    if init_score is not None and lat_score is not None:
                        score_deltas[pid] = lat_score - init_score
            elif score_type == 'pps':
                scores = (
                    PpsScore.query
                    .filter_by(patient_id=pid)
                    .order_by(PpsScore.recorded_at.asc())
                    .all()
                )
                if len(scores) >= 2:
                    init_score = scores[0].pps_score
                    lat_score = scores[-1].pps_score
                    if init_score is not None and lat_score is not None:
                        score_deltas[pid] = lat_score - init_score

        # Build correlation
        correlations = {}
        for vital_key, col_name in VITAL_COLUMN_MAP.items():
            groups = {'improved': [], 'stable': [], 'deteriorated': []}
            for pid in patient_ids:
                if pid not in score_deltas:
                    continue
                init_val = getattr(initial_map[pid], col_name)
                lat_val = getattr(latest_map[pid], col_name)
                classification = _classify_change(vital_key, init_val, lat_val)
                if classification:
                    groups[classification].append(score_deltas[pid])

            correlations[vital_key] = {}
            for group_name, deltas in groups.items():
                correlations[vital_key][group_name] = {
                    'count': len(deltas),
                    'avg_score_change': round(sum(deltas) / len(deltas), 1) if deltas else 0,
                }

        return {
            'score_type': score_type,
            'patients_with_both': len(score_deltas),
            'correlations': correlations,
        }

    @staticmethod
    def get_top_movers(direction: str = 'improved', limit: int = 10) -> List:
        """Get patients with most improved or deteriorated vitals (composite score)."""
        initial_map, latest_map = _get_initial_and_latest_visits()
        patient_ids = set(initial_map.keys()) & set(latest_map.keys())

        patient_scores = []
        for pid in patient_ids:
            improvements = []
            vitals_detail = {}

            for vital_key, col_name in VITAL_COLUMN_MAP.items():
                init_val = _num(getattr(initial_map[pid], col_name))
                lat_val = _num(getattr(latest_map[pid], col_name))
                if init_val is None or lat_val is None:
                    continue

                ref = REFERENCE_RANGES[vital_key]
                center = (ref['min'] + ref['max']) / 2
                range_width = ref['max'] - ref['min']
                if range_width == 0:
                    range_width = 1

                initial_distance = abs(init_val - center)
                latest_distance = abs(lat_val - center)
                # Normalized improvement: positive = improved, negative = deteriorated
                normalized = (initial_distance - latest_distance) / range_width
                improvements.append(normalized)

                vitals_detail[vital_key] = {
                    'initial': init_val,
                    'latest': lat_val,
                    'change': round(lat_val - init_val, 1),
                    'status': _classify_change(vital_key, init_val, lat_val),
                }

            if not improvements:
                continue

            composite = round(sum(improvements) / len(improvements), 3)
            patient_scores.append({
                'patient_id': pid,
                'composite_score': composite,
                'vitals': vitals_detail,
                'initial_visit_date': initial_map[pid].visit_date.isoformat() if initial_map[pid].visit_date else None,
                'latest_visit_date': latest_map[pid].visit_date.isoformat() if latest_map[pid].visit_date else None,
            })

        # Sort
        reverse = direction == 'improved'
        patient_scores.sort(key=lambda x: x['composite_score'], reverse=reverse)
        top = patient_scores[:limit]

        # Fetch patient names
        if top:
            pids = [p['patient_id'] for p in top]
            patients = Patient.query.filter(Patient.id.in_(pids)).all()
            name_map = {str(p.id): p.full_name for p in patients}
            for entry in top:
                entry['patient_name'] = name_map.get(entry['patient_id'], 'Unknown')

        return top
