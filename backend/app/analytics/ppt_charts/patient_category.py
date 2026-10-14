"""
Backend service for Patient Category (BSC vs N-BSC) Analysis.
Decoupled PPT Charts service.
Categorizes patients into:
- BSC Onco
- N-BSC Onco
- N-BSC Non Onco
(plus BSC Non Onco / Not Yet Determined if present)
"""

from typing import Dict, Any, List
from app.extensions import db
from app.patients.models import Patient
from .shared.filters.patient_filters import (
    apply_patient_filters,
    apply_date_range_filter,
    parse_filter_params,
)

CATEGORY_CONFIG = {
    'BSC Onco': {'color': '#2f65b9', 'order': 1},
    'N-BSC Onco': {'color': '#ea580c', 'order': 2},
    'N-BSC Non Onco': {'color': '#94a3b8', 'order': 3},
    'BSC Non Onco': {'color': '#10b981', 'order': 4},
    'Not Yet Determined': {'color': '#64748b', 'order': 5},
}


def classify_category(bsc_status: bool, is_onco: bool) -> str:
    """Classify patient based on BSC status and Oncology status."""
    is_oncology = False if is_onco is False else True

    if bsc_status is True:
        return 'BSC Onco' if is_oncology else 'BSC Non Onco'
    elif bsc_status is False:
        return 'N-BSC Onco' if is_oncology else 'N-BSC Non Onco'
    else:
        return 'Not Yet Determined'


def get_patient_category_data(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get patient distribution by category:
    - BSC Onco
    - N-BSC Onco
    - N-BSC Non Onco
    """
    filters = parse_filter_params(params)
    status = filters.get('status')
    complexity = filters.get('complexity')
    start_date = filters.get('start_date')
    end_date = filters.get('end_date')

    query = (
        db.session.query(
            Patient.id,
            Patient.bsc_status,
            Patient.is_onco
        )
        .filter(Patient.is_active.is_(True))
    )

    if status or complexity:
        query = apply_patient_filters(query, status=status, complexity=complexity)

    if start_date or end_date:
        query = apply_date_range_filter(query, Patient.registration_date, start_date=start_date, end_date=end_date)

    patients = query.all()

    counts: Dict[str, int] = {cat: 0 for cat in CATEGORY_CONFIG}

    for p in patients:
        cat = classify_category(p.bsc_status, p.is_onco)
        counts[cat] = counts.get(cat, 0) + 1

    total = sum(counts.values())

    data: List[Dict[str, Any]] = []
    # Sort by defined order
    for cat_name, config in sorted(CATEGORY_CONFIG.items(), key=lambda x: x[1]['order']):
        cnt = counts.get(cat_name, 0)
        # Always include the 3 primary categories, and secondary ones only if > 0
        if cnt > 0 or cat_name in ('BSC Onco', 'N-BSC Onco', 'N-BSC Non Onco'):
            pct = round((cnt / total) * 100) if total > 0 else 0
            data.append({
                'name': cat_name,
                'count': cnt,
                'percentage': pct,
                'color': config['color'],
            })

    return {
        'success': True,
        'data': data,
        'total': total,
    }
