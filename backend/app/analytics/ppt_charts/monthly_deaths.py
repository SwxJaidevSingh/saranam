"""
Backend service for Month Wise Deaths trend.
Decoupled PPT Charts service.
Queries Patient.date_of_death for deceased patients, aggregated by calendar month.
"""

from datetime import datetime
from collections import OrderedDict
from typing import Dict, Any
from app.extensions import db
from app.patients.models import Patient
from .shared.filters.patient_filters import (
    apply_patient_filters,
    apply_date_range_filter,
    parse_filter_params,
)


def get_monthly_deaths_data(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Fetch monthly death counts from Patient.date_of_death.
    Filters: status, complexity, start_date, end_date (applied to date_of_death).
    """
    filters = parse_filter_params(params)
    status = filters.get('status')
    complexity = filters.get('complexity')
    start_date = filters.get('start_date')
    end_date = filters.get('end_date')

    query = (
        db.session.query(
            Patient.date_of_death,
            Patient.id
        )
        .filter(Patient.is_deceased.is_(True))
        .filter(Patient.date_of_death.isnot(None))
    )

    if status or complexity:
        query = apply_patient_filters(query, status=status, complexity=complexity)

    if start_date or end_date:
        query = apply_date_range_filter(
            query, Patient.date_of_death,
            start_date=start_date,
            end_date=end_date,
        )

    rows = query.all()

    monthly_counts = OrderedDict()

    for row in rows:
        d = row.date_of_death
        if not d:
            continue
        if isinstance(d, str):
            try:
                d = datetime.strptime(d[:10], '%Y-%m-%d').date()
            except Exception:
                continue

        month_key = d.strftime('%Y-%m')
        month_label = d.strftime('%b-%y')

        if month_key not in monthly_counts:
            monthly_counts[month_key] = {
                'month': month_label,
                'month_key': month_key,
                'deaths': 0,
            }
        monthly_counts[month_key]['deaths'] += 1

    sorted_data = [
        val for key, val in sorted(monthly_counts.items(), key=lambda x: x[0])
    ]

    total = sum(item['deaths'] for item in sorted_data)

    return {
        'success': True,
        'data': sorted_data,
        'total': total,
    }
