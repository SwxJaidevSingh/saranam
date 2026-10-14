"""
Backend service for Age Category chart.
Completely decoupled from legacy analytics code.
Queries the Patient domain model directly — 100% actual database data.
"""

from datetime import date
from sqlalchemy import func
from app.extensions import db
from app.patients.models import Patient
from .shared.filters.patient_filters import (
    apply_patient_filters,
    apply_date_range_filter,
    parse_filter_params,
)


def _calculate_age(dob: date, reference_date: date = None) -> int:
    """Calculate age in complete years."""
    if not dob:
        return None
    ref = reference_date or date.today()
    return ref.year - dob.year - ((ref.month, ref.day) < (dob.month, dob.day))


def get_age_category_data(params: dict) -> dict:
    """
    Get age category distribution of cases:
    - Children and Adolescents (1-19)
    - Adult (20-59)
    - Older Adult (60 and above)
    """
    filters = parse_filter_params(params)
    status = filters.get('status')
    complexity = filters.get('complexity')
    start_date = filters.get('start_date')
    end_date = filters.get('end_date')

    date_expr = func.coalesce(Patient.registration_date, func.date(Patient.created_at))

    query = db.session.query(
        Patient.id,
        Patient.date_of_birth
    ).filter(Patient.is_active.is_(True))

    query = apply_patient_filters(query, status=status, complexity=complexity)
    query = apply_date_range_filter(query, date_expr, start_date=start_date, end_date=end_date)

    patients = query.all()
    today_date = date.today()

    categories = {
        'Children and Adolescents (1-19)': 0,
        'Adult (20-59)': 0,
        'Older Adult (60 and above)': 0,
    }

    for p in patients:
        dob = p.date_of_birth
        if not dob:
            continue
        age = _calculate_age(dob, today_date)
        if age is None:
            continue

        if age <= 19:
            categories['Children and Adolescents (1-19)'] += 1
        elif 20 <= age <= 59:
            categories['Adult (20-59)'] += 1
        else:
            categories['Older Adult (60 and above)'] += 1

    total = sum(categories.values())

    color_map = {
        'Children and Adolescents (1-19)': '#3b82f6',  # Blue
        'Adult (20-59)': '#f97316',                   # Orange
        'Older Adult (60 and above)': '#9ca3af',      # Grey
    }

    data = [
        {
            'name': name,
            'value': count,
            'percentage': round((count / total) * 100, 1) if total > 0 else 0,
            'color': color_map[name],
        }
        for name, count in categories.items()
    ]

    return {
        'success': True,
        'data': data,
        'total': total,
    }
