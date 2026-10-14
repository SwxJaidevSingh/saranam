"""
Backend service for Place of Death Analysis.
Decoupled PPT Charts service.
Analyzes deceased patients grouped by place_of_death:
- home
- hospital
- on_the_way
- others
"""

from typing import Dict, Any, List
from app.extensions import db
from app.patients.models import Patient
from .shared.filters.patient_filters import (
    apply_patient_filters,
    apply_date_range_filter,
    parse_filter_params,
)


PLACE_CONFIG = [
    {'key': 'home',       'label': 'Home',        'color': '#ea580c', 'order': 1},
    {'key': 'hospital',   'label': 'Hospital',    'color': '#2f65b9', 'order': 2},
    {'key': 'on_the_way', 'label': 'On The Way',  'color': '#94a3b8', 'order': 3},
    {'key': 'others',     'label': 'Others',      'color': '#f59e0b', 'order': 4},
]

KEY_TO_CONFIG = {cfg['key']: cfg for cfg in PLACE_CONFIG}


def get_place_of_death_data(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get distribution of deceased patients by place of death.
    Filters: status, complexity, date range (date_of_death).
    """
    filters = parse_filter_params(params)
    status = filters.get('status')
    complexity = filters.get('complexity')
    start_date = filters.get('start_date')
    end_date = filters.get('end_date')

    query = (
        db.session.query(
            Patient.place_of_death,
        )
        .filter(Patient.is_deceased.is_(True))
        .filter(Patient.place_of_death.isnot(None))
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

    counts: Dict[str, int] = {cfg['key']: 0 for cfg in PLACE_CONFIG}
    unknown = 0

    for (place,) in rows:
        key = (place or '').strip().lower()
        if key in counts:
            counts[key] += 1
        else:
            unknown += 1

    # Add unknowns into "others"
    counts['others'] += unknown

    total = sum(counts.values())

    data: List[Dict[str, Any]] = []
    for cfg in PLACE_CONFIG:
        cnt = counts.get(cfg['key'], 0)
        pct = round((cnt / total) * 100) if total > 0 else 0
        data.append({
            'name': cfg['label'],
            'key': cfg['key'],
            'count': cnt,
            'percentage': pct,
            'color': cfg['color'],
        })

    return {
        'success': True,
        'data': data,
        'total': total,
    }
