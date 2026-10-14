"""
Backend service for Type of Home-Visit Analysis.
Completely decoupled from legacy analytics code.
Queries domain models directly (Patient, PatientVisit, BereavementAssessment) — 100% actual database data.
"""

from datetime import datetime
from collections import OrderedDict
from sqlalchemy import func, or_
from app.extensions import db
from app.patients.models import Patient
from app.saranam.models.patient_visit import PatientVisit
from app.saranam.models.bereavement_assessment import BereavementAssessment
from .shared.filters.patient_filters import (
    apply_patient_filters,
    apply_date_range_filter,
    parse_filter_params,
)


def get_visit_type_analysis_data(params: dict) -> dict:
    """
    Get monthly breakdown of home visits categorized into:
    - New visit (First visit / initial assessment)
    - Follow up visit
    - Bereavement visit
    """
    filters = parse_filter_params(params)
    status = filters.get('status')
    complexity = filters.get('complexity')
    start_date = filters.get('start_date')
    end_date = filters.get('end_date')

    # Query visits joined with patient and optional bereavement assessment
    query = (
        db.session.query(
            PatientVisit.id,
            PatientVisit.visit_date,
            PatientVisit.created_at,
            PatientVisit.visit_type,
            PatientVisit.visit_number,
            PatientVisit.visit_location,
            BereavementAssessment.id.label('bereavement_id')
        )
        .join(Patient, PatientVisit.patient_id == Patient.id)
        .outerjoin(BereavementAssessment, BereavementAssessment.visit_id == PatientVisit.id)
        .filter(
            Patient.is_active.is_(True),
            or_(PatientVisit.status.in_(['completed', 'in_progress']), PatientVisit.status.is_(None)),
            or_(
                PatientVisit.visit_location.in_(['home', 'Home']),
                PatientVisit.visit_location.is_(None),
                ~PatientVisit.visit_location.in_(['opd', 'ipd', 'phone'])
            )
        )
    )

    query = apply_patient_filters(query, status=status, complexity=complexity)

    visit_date_expr = func.coalesce(PatientVisit.visit_date, func.date(PatientVisit.created_at))
    query = apply_date_range_filter(query, visit_date_expr, start_date=start_date, end_date=end_date)

    rows = query.all()

    # Aggregate by month
    monthly_data = OrderedDict()

    for row in rows:
        v_date = row.visit_date or (row.created_at.date() if row.created_at else None)
        if not v_date:
            continue
        if isinstance(v_date, str):
            try:
                v_date = datetime.strptime(v_date[:10], '%Y-%m-%d').date()
            except Exception:
                continue

        month_key = v_date.strftime('%Y-%m')
        month_label = v_date.strftime('%b-%y').upper()

        if month_key not in monthly_data:
            monthly_data[month_key] = {
                'month': month_label,
                'month_key': month_key,
                'new_visit': 0,
                'follow_up_visit': 0,
                'bereavement_visit': 0,
                'total': 0,
            }

        # Classify visit type
        v_type = (row.visit_type or '').lower().strip()
        v_num = row.visit_number

        if row.bereavement_id is not None or v_type == 'bereavement':
            monthly_data[month_key]['bereavement_visit'] += 1
        elif v_type in ('initial', 'new') or v_num in (0, 1):
            monthly_data[month_key]['new_visit'] += 1
        else:
            monthly_data[month_key]['follow_up_visit'] += 1

        monthly_data[month_key]['total'] += 1

    # Sort months chronologically
    sorted_months = sorted(monthly_data.items(), key=lambda x: x[0])
    data = [item[1] for item in sorted_months]

    total_new = sum(d['new_visit'] for d in data)
    total_follow_up = sum(d['follow_up_visit'] for d in data)
    total_bereavement = sum(d['bereavement_visit'] for d in data)
    grand_total = sum(d['total'] for d in data)

    return {
        'success': True,
        'data': data,
        'total_new_visits': total_new,
        'total_follow_up_visits': total_follow_up,
        'total_bereavement_visits': total_bereavement,
        'grand_total': grand_total,
    }
