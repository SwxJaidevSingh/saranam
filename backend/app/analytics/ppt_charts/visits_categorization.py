"""
Backend service for Categorization by Number of Visits (Alive and Deceased Patients).
Completely decoupled from legacy analytics code.
Queries domain models directly (Patient & PatientVisit) — 100% actual database data.
"""

from sqlalchemy import func, or_
from app.extensions import db
from app.patients.models import Patient
from app.saranam.models.patient_visit import PatientVisit
from .shared.filters.patient_filters import (
    apply_patient_filters,
    apply_date_range_filter,
    parse_filter_params,
)

VISIT_BUCKETS = [
    {
        'key': '1',
        'label': '1 visit',
        'min': 1,
        'max': 1,
    },
    {
        'key': '2-3',
        'label': '2 to 3 visits',
        'min': 2,
        'max': 3,
    },
    {
        'key': '4-5',
        'label': '4 to 5 visits',
        'min': 4,
        'max': 5,
    },
    {
        'key': '6-7',
        'label': '6 to 7 visits',
        'min': 6,
        'max': 7,
    },
    {
        'key': '8+',
        'label': '8 and above visits',
        'min': 8,
        'max': 999999,
    },
]


def get_visits_categorization_data(params: dict) -> dict:
    """
    Get breakdown of patients by number of visits received,
    split across Alive and Deceased patients.
    """
    filters = parse_filter_params(params)
    status = filters.get('status')
    complexity = filters.get('complexity')
    start_date = filters.get('start_date')
    end_date = filters.get('end_date')

    # Subquery: count of visits per patient
    visit_query = db.session.query(
        PatientVisit.patient_id,
        func.count(PatientVisit.id).label('visit_count')
    ).filter(
        or_(PatientVisit.status.in_(['completed', 'in_progress']), PatientVisit.status.is_(None))
    )

    visit_date_expr = func.coalesce(PatientVisit.visit_date, func.date(PatientVisit.created_at))
    visit_query = apply_date_range_filter(visit_query, visit_date_expr, start_date=start_date, end_date=end_date)
    visit_subquery = visit_query.group_by(PatientVisit.patient_id).subquery()

    # Join with Patient to get alive/deceased status and apply patient filters
    query = db.session.query(
        Patient.id,
        Patient.is_deceased,
        visit_subquery.c.visit_count
    ).join(
        visit_subquery, visit_subquery.c.patient_id == Patient.id
    ).filter(
        Patient.is_active.is_(True)
    )

    query = apply_patient_filters(query, status=status, complexity=complexity)

    patient_records = query.all()

    # Initialize bucket counts
    bucket_counts = {
        b['key']: {'label': b['label'], 'alive': 0, 'deceased': 0, 'total': 0}
        for b in VISIT_BUCKETS
    }

    for p in patient_records:
        count = p.visit_count or 0
        is_dec = bool(p.is_deceased)

        target_bucket = None
        for b in VISIT_BUCKETS:
            if b['min'] <= count <= b['max']:
                target_bucket = b['key']
                break

        if target_bucket:
            if is_dec:
                bucket_counts[target_bucket]['deceased'] += 1
            else:
                bucket_counts[target_bucket]['alive'] += 1
            bucket_counts[target_bucket]['total'] += 1

    total_alive = sum(b['alive'] for b in bucket_counts.values())
    total_deceased = sum(b['deceased'] for b in bucket_counts.values())
    grand_total = sum(b['total'] for b in bucket_counts.values())

    data = [
        {
            'key': b['key'],
            'category': b['label'],
            'alive': bucket_counts[b['key']]['alive'],
            'deceased': bucket_counts[b['key']]['deceased'],
            'total': bucket_counts[b['key']]['total'],
            'percentage': round((bucket_counts[b['key']]['total'] / grand_total) * 100, 1) if grand_total > 0 else 0,
        }
        for b in VISIT_BUCKETS
    ]

    return {
        'success': True,
        'data': data,
        'total_alive': total_alive,
        'total_deceased': total_deceased,
        'grand_total': grand_total,
    }

