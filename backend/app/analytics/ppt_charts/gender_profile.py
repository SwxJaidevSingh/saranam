"""
Backend service for Gender Profile chart.
Completely decoupled from legacy analytics code.
Queries the Patient domain model directly — 100% actual database data.
"""

from sqlalchemy import func
from app.extensions import db
from app.patients.models import Patient
from .shared.filters.patient_filters import (
    apply_patient_filters,
    apply_date_range_filter,
    parse_filter_params,
)


def get_gender_profile_data(params: dict) -> dict:
    """
    Get gender distribution of cases:
    - Male
    - Female
    """
    filters = parse_filter_params(params)
    status = filters.get('status')
    complexity = filters.get('complexity')
    start_date = filters.get('start_date')
    end_date = filters.get('end_date')

    date_expr = func.coalesce(Patient.registration_date, func.date(Patient.created_at))

    query = db.session.query(
        Patient.id,
        Patient.gender
    ).filter(Patient.is_active.is_(True))

    query = apply_patient_filters(query, status=status, complexity=complexity)
    query = apply_date_range_filter(query, date_expr, start_date=start_date, end_date=end_date)

    patients = query.all()

    counts = {
        'Male': 0,
        'Female': 0,
    }

    for p in patients:
        g = (p.gender or '').strip().capitalize()
        if g == 'Male':
            counts['Male'] += 1
        elif g == 'Female':
            counts['Female'] += 1
        elif g:
            counts[g] = counts.get(g, 0) + 1

    total = sum(counts.values())

    color_map = {
        'Male': '#3b82f6',    # Blue
        'Female': '#f97316',  # Orange
    }

    data = [
        {
            'name': name,
            'value': count,
            'percentage': round((count / total) * 100, 1) if total > 0 else 0,
            'color': color_map.get(name, '#a855f7'),
        }
        for name, count in counts.items()
    ]

    return {
        'success': True,
        'data': data,
        'total': total,
    }
