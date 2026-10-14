"""
Backend service for Homecare days trend.
Decoupled PPT Charts service.
Queries patient_visits table for unique visit dates where visit_type != 'teleconsult'
grouped by calendar month.
Only live data from the database is returned.
"""

from datetime import datetime
from collections import OrderedDict
from typing import Dict, Any, List
from sqlalchemy import func
from app.extensions import db
from app.saranam.models.patient_visit import PatientVisit
from app.patients.models import Patient
from .shared.filters.patient_filters import (
    parse_filter_params,
    apply_patient_filters,
    apply_date_range_filter,
)


def get_homecare_days_data(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Fetch monthly homecare days count (distinct visit dates with home visits)
    from patient_visits table where visit_type is NOT 'teleconsult'.
    """
    filters = parse_filter_params(params)
    status = filters.get('status')
    complexity = filters.get('complexity')
    start_date = filters.get('start_date')
    end_date = filters.get('end_date')

    query = (
        db.session.query(
            PatientVisit.visit_date
        )
        .outerjoin(Patient, PatientVisit.patient_id == Patient.id)
        .filter(
            PatientVisit.visit_date.isnot(None),
            func.coalesce(func.lower(PatientVisit.visit_type), '') != 'teleconsult'
        )
    )

    if status or complexity:
        query = apply_patient_filters(query, status=status, complexity=complexity)

    if start_date or end_date:
        query = apply_date_range_filter(query, PatientVisit.visit_date, start_date=start_date, end_date=end_date)

    query = query.distinct(PatientVisit.visit_date).order_by(PatientVisit.visit_date.asc())
    rows = query.all()

    if not rows:
        return {
            'success': True,
            'data': [],
            'total': 0,
        }

    monthly_dates = OrderedDict()

    for row in rows:
        d = row.visit_date
        if not d:
            continue
        if isinstance(d, str):
            try:
                d = datetime.strptime(d[:10], '%Y-%m-%d').date()
            except Exception:
                continue

        month_key = d.strftime('%Y-%m')
        month_label = d.strftime('%b-%y').upper()

        if month_key not in monthly_dates:
            monthly_dates[month_key] = {
                'month': month_label,
                'month_key': month_key,
                'dates': set(),
            }
        monthly_dates[month_key]['dates'].add(d)

    sorted_data: List[Dict[str, Any]] = [
        {
            'month': item['month'],
            'month_key': item['month_key'],
            'days': len(item['dates']),
        }
        for month_key, item in sorted(monthly_dates.items(), key=lambda x: x[0])
    ]

    total = sum(item['days'] for item in sorted_data)

    return {
        'success': True,
        'data': sorted_data,
        'total': total,
    }
