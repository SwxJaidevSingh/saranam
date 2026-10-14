"""
Backend service for Break up of Consultations (Home care vs Phone call consultations).
Completely decoupled from legacy analytics code.
Queries patient_visits table directly:
- visit_type == 'teleconsult' -> Phone call consultations
- otherwise -> Home care consultations
"""

from sqlalchemy import func
from app.extensions import db
from app.patients.models import Patient
from app.saranam.models.patient_visit import PatientVisit
from .shared.filters.patient_filters import (
    apply_patient_filters,
    apply_date_range_filter,
    parse_filter_params,
)


from .consultation_split import get_consultation_split_data


def get_consultation_breakup_data(params: dict) -> dict:
    """
    Get breakdown of consultations into Home care vs Phone call consultations.
    Synchronized with get_consultation_split_data to ensure 100% consistency across:
    - Overview cards: "Number of Home-based Consultations" & "Number of Phone - Consultations"
    - "Break up of Consultations" chart
    - "Split of Consultations" table
    """
    split_res = get_consultation_split_data(params)
    split_data = split_res.get('data', [])

    homecare_count = sum(item.get('homecare', 0) for item in split_data)
    phone_count = sum(item.get('phonecall', 0) for item in split_data)

    total = homecare_count + phone_count
    homecare_pct = round((homecare_count / total) * 100) if total > 0 else 0
    phone_pct = round((phone_count / total) * 100) if total > 0 else 0

    data = [
        {
            'name': 'Home care consultations',
            'count': homecare_count,
            'percentage': homecare_pct,
            'color': '#2f65b9',  # Classic presentation blue
        },
        {
            'name': 'Phone call consultations',
            'count': phone_count,
            'percentage': phone_pct,
            'color': '#ea580c',  # Warm orange
        },
    ]

    return {
        'success': True,
        'data': data,
        'total_consultations': total,
        'homecare_count': homecare_count,
        'phone_count': phone_count,
    }
