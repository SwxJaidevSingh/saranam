"""
Backend service for Zone Wise Categorization of Patients Registered.
Completely decoupled from legacy analytics code.
Queries the Patient domain model directly — 100% actual database data.
"""

from collections import OrderedDict
from sqlalchemy import func
from app.extensions import db
from app.patients.models import Patient
from .shared.filters.patient_filters import (
    apply_patient_filters,
    apply_date_range_filter,
    parse_filter_params,
)

# Standard recognized Bangalore zones
ZONES = ['SOUTH', 'WEST', 'NORTH', 'CENTRAL', 'EAST']


def get_zone_categorization_data(params: dict) -> dict:
    """
    Get zone-wise breakdown of registered patients:
    - SOUTH
    - WEST
    - NORTH
    - CENTRAL
    - EAST
    """
    filters = parse_filter_params(params)
    status = filters.get('status')
    complexity = filters.get('complexity')
    start_date = filters.get('start_date')
    end_date = filters.get('end_date')

    date_expr = func.coalesce(Patient.registration_date, func.date(Patient.created_at))

    query = db.session.query(
        Patient.id,
        Patient.geographic_cluster
    ).filter(Patient.is_active.is_(True))

    query = apply_patient_filters(query, status=status, complexity=complexity)
    query = apply_date_range_filter(query, date_expr, start_date=start_date, end_date=end_date)

    patients = query.all()

    # Tally by uppercase zone
    zone_counts = {z: 0 for z in ZONES}

    for p in patients:
        cluster = (p.geographic_cluster or '').strip().upper()
        if cluster in zone_counts:
            zone_counts[cluster] += 1
        elif cluster:
            zone_counts[cluster] = zone_counts.get(cluster, 0) + 1

    total = sum(zone_counts.values())

    # Sort descending by count
    sorted_zones = sorted(zone_counts.items(), key=lambda x: x[1], reverse=True)

    data = [
        {
            'zone': zone,
            'count': count,
            'percentage': round((count / total) * 100, 1) if total > 0 else 0,
        }
        for zone, count in sorted_zones
    ]

    return {
        'success': True,
        'data': data,
        'total': total,
    }
