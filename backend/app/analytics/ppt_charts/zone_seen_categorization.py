"""
Backend service for Zone Wise Categorization of Patients Seen.
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

# Standard recognized Bangalore zones
ZONES = ['SOUTH', 'WEST', 'NORTH', 'CENTRAL', 'EAST']
ZONE_LABELS = {
    'SOUTH': 'South',
    'WEST': 'West',
    'NORTH': 'North',
    'CENTRAL': 'Central',
    'EAST': 'East',
}


def get_zone_seen_data(params: dict) -> dict:
    """
    Get zone-wise breakdown of patients seen (who received at least one home-care visit):
    - South
    - West
    - North
    - Central
    - East
    """
    filters = parse_filter_params(params)
    status = filters.get('status')
    complexity = filters.get('complexity')
    start_date = filters.get('start_date')
    end_date = filters.get('end_date')

    # Join Patient with PatientVisit for completed/in-progress visits
    query = (
        db.session.query(
            Patient.id,
            Patient.geographic_cluster
        )
        .join(PatientVisit, PatientVisit.patient_id == Patient.id)
        .filter(Patient.is_active.is_(True))
        .filter(or_(PatientVisit.status.in_(['completed', 'in_progress']), PatientVisit.status.is_(None)))
    )

    query = apply_patient_filters(query, status=status, complexity=complexity)

    # Date range filters by visit date (fallback to visit creation date)
    visit_date_expr = func.coalesce(PatientVisit.visit_date, func.date(PatientVisit.created_at))
    query = apply_date_range_filter(query, visit_date_expr, start_date=start_date, end_date=end_date)

    # Distinct patients who were seen
    patients = query.distinct(Patient.id).all()

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
            'zone': ZONE_LABELS.get(zone, zone.title()),
            'raw_zone': zone,
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
