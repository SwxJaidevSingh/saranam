"""
Backend service for Monthly Registration Trends.
Completely decoupled from legacy analytics code.
Queries the Patient domain model directly — 100% actual database data.
"""

from datetime import datetime, date
from collections import OrderedDict
from sqlalchemy import func
from app.extensions import db
from app.patients.models import Patient
from .shared.filters.patient_filters import (
    apply_patient_filters,
    apply_date_range_filter,
    parse_filter_params,
)


def get_monthly_registration_data(params: dict) -> dict:
    """
    Fetch actual monthly registration counts from database with applied status, complexity, and date filters.
    """
    filters = parse_filter_params(params)
    status = filters.get('status')
    complexity = filters.get('complexity')
    start_date = filters.get('start_date')
    end_date = filters.get('end_date')

    # Effective date expression: registration_date or fallback to created_at date
    date_expr = func.coalesce(Patient.registration_date, func.date(Patient.created_at))

    query = db.session.query(
        date_expr.label('reg_date'),
        Patient.id
    ).filter(
        Patient.is_active.is_(True),
        date_expr.isnot(None)
    )

    query = apply_patient_filters(query, status=status, complexity=complexity)
    query = apply_date_range_filter(query, date_expr, start_date=start_date, end_date=end_date)

    rows = query.all()

    # Aggregate by month from actual rows
    monthly_counts = OrderedDict()

    for row in rows:
        r_date = row.reg_date
        if not r_date:
            continue
        if isinstance(r_date, str):
            try:
                r_date = datetime.strptime(r_date[:10], '%Y-%m-%d').date()
            except Exception:
                continue

        month_key = r_date.strftime('%Y-%m')
        month_label = r_date.strftime('%b-%y')

        if month_key not in monthly_counts:
            monthly_counts[month_key] = {
                'month': month_label,
                'month_key': month_key,
                'registrations': 0,
            }
        
        monthly_counts[month_key]['registrations'] += 1

    # Sort sequentially by month key (e.g. 2026-01, 2026-02, ...)
    sorted_data = [
        val for key, val in sorted(monthly_counts.items(), key=lambda item: item[0])
    ]

    total_registrations = sum(item['registrations'] for item in sorted_data)

    return {
        'success': True,
        'data': sorted_data,
        'total': total_registrations
    }
