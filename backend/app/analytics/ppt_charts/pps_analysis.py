"""
Backend service for Palliative Performance Scale (PPS) Analysis.
Completely decoupled from legacy analytics code.
Analyzes functional performance of patients based on PPS Score:
- High (PPS >= 70% or 80-100%)
- Medium (PPS 40-60% or 50-70%)
- Low (PPS 10-30% or <= 40%)
"""

from sqlalchemy import func
from app.extensions import db
from app.patients.models import Patient
from app.saranam.models.pps_score import PpsScore
from .shared.filters.patient_filters import (
    apply_patient_filters,
    apply_date_range_filter,
    parse_filter_params,
)


def classify_pps_score(score: int) -> str:
    """Classify PPS integer score into High, Medium, Low functional performance."""
    if score is None:
        return None
    if score >= 70:
        return 'High'
    if score >= 40:
        return 'Medium'
    return 'Low'


def get_pps_analysis_data(params: dict) -> dict:
    """
    Get distribution of patients by Palliative Performance Scale (PPS):
    - High (e.g. 9, 10%)
    - Medium (e.g. 64, 67%)
    - Low (e.g. 22, 23%)
    """
    filters = parse_filter_params(params)
    status = filters.get('status')
    complexity = filters.get('complexity')
    start_date = filters.get('start_date')
    end_date = filters.get('end_date')

    # Subquery: get latest PPS score per patient from pps_scores table
    latest_pps_subq = (
        db.session.query(
            PpsScore.patient_id,
            func.max(PpsScore.recorded_at).label('max_recorded')
        )
        .filter(PpsScore.pps_score.isnot(None))
        .group_by(PpsScore.patient_id)
        .subquery()
    )

    query = (
        db.session.query(
            Patient.id,
            func.coalesce(PpsScore.pps_score, Patient.latest_pps_score).label('score'),
            Patient.clinical_complexity
        )
        .outerjoin(latest_pps_subq, Patient.id == latest_pps_subq.c.patient_id)
        .outerjoin(
            PpsScore,
            (PpsScore.patient_id == latest_pps_subq.c.patient_id) &
            (PpsScore.recorded_at == latest_pps_subq.c.max_recorded)
        )
        .filter(Patient.is_active.is_(True))
    )

    if status or complexity:
        query = apply_patient_filters(query, status=status, complexity=complexity)

    if start_date or end_date:
        query = apply_date_range_filter(query, Patient.registration_date, start_date=start_date, end_date=end_date)

    patients = query.all()

    counts = {
        'High': 0,
        'Medium': 0,
        'Low': 0,
    }

    for p in patients:
        category = None
        if p.score is not None:
            category = classify_pps_score(p.score)
        elif p.clinical_complexity:
            c = p.clinical_complexity.lower()
            if c == 'low':
                category = 'High'  # Low complexity = high performance
            elif c in ('medium', 'moderate'):
                category = 'Medium'
            elif c == 'high':
                category = 'Low'   # High complexity = low performance

        if category and category in counts:
            counts[category] += 1

    total = sum(counts.values())

    high_pct = round((counts['High'] / total) * 100) if total > 0 else 0
    medium_pct = round((counts['Medium'] / total) * 100) if total > 0 else 0
    low_pct = round((counts['Low'] / total) * 100) if total > 0 else 0

    data = [
        {
            'name': 'High',
            'count': counts['High'],
            'percentage': high_pct,
            'color': '#2f65b9',  # Blue matching slide
        },
        {
            'name': 'Medium',
            'count': counts['Medium'],
            'percentage': medium_pct,
            'color': '#ea580c',  # Orange matching slide
        },
        {
            'name': 'Low',
            'count': counts['Low'],
            'percentage': low_pct,
            'color': '#94a3b8',  # Grey matching slide
        },
    ]

    return {
        'success': True,
        'data': data,
        'total': total,
        'high_count': counts['High'],
        'medium_count': counts['Medium'],
        'low_count': counts['Low'],
    }
