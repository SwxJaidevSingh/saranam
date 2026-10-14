"""
Backend service for Monthwise Trend of Consultations.
Completely decoupled from legacy analytics code.
Queries patient_visits table directly using the 5 boolean consultation columns.
- visit_type == 'teleconsult' -> Phone Care Consultations
- otherwise -> Home Care Consultations
- total = Home Care + Phone Care
"""

from datetime import datetime
from collections import OrderedDict
from sqlalchemy import func
from app.extensions import db
from app.patients.models import Patient
from app.saranam.models.patient_visit import PatientVisit
from .shared.filters.patient_filters import (
    apply_patient_filters,
    apply_date_range_filter,
    parse_filter_params,
)


def get_consultation_monthly_trend_data(params: dict) -> dict:
    """
    Get monthwise trend of consultations:
    - Home Care Consultations (bars)
    - Phone Care Consultations (bars)
    - Total Consultations (line)
    """
    filters = parse_filter_params(params)
    status = filters.get('status')
    complexity = filters.get('complexity')
    start_date = filters.get('start_date')
    end_date = filters.get('end_date')

    query = (
        db.session.query(
            PatientVisit.id,
            PatientVisit.visit_type,
            PatientVisit.visit_date,
            PatientVisit.doctor_consultation,
            PatientVisit.nursing_consultation,
            PatientVisit.counsellor_consultation,
            PatientVisit.physiotherapy_consultation,
            PatientVisit.social_worker_consultation,
        )
        .join(Patient, PatientVisit.patient_id == Patient.id)
        .filter(
            Patient.is_active.is_(True),
            PatientVisit.visit_date.isnot(None)
        )
    )

    if status or complexity:
        query = apply_patient_filters(query, status=status, complexity=complexity)

    if start_date or end_date:
        query = apply_date_range_filter(query, PatientVisit.visit_date, start_date=start_date, end_date=end_date)

    visits = query.all()

    monthly_counts = OrderedDict()

    for v in visits:
        v_date = v.visit_date
        if not v_date:
            continue
        if isinstance(v_date, str):
            try:
                v_date = datetime.strptime(v_date[:10], '%Y-%m-%d').date()
            except Exception:
                continue
        elif hasattr(v_date, 'date'):
            v_date = v_date.date()

        v_type = (v.visit_type or '').strip().lower()
        is_phone = 'teleconsult' in v_type

        # Multi-select consultation count from 5 booleans on patient_visits
        consult_count = sum([
            bool(getattr(v, 'physiotherapy_consultation', False)),
            bool(getattr(v, 'counsellor_consultation', False)),
            bool(getattr(v, 'nursing_consultation', False)),
            bool(getattr(v, 'doctor_consultation', False)),
            bool(getattr(v, 'social_worker_consultation', False)),
        ])

        # Skip visits that have 0 consultations recorded
        if consult_count == 0:
            continue

        month_key = v_date.strftime('%Y-%m')
        month_name = v_date.strftime('%B')

        if month_key not in monthly_counts:
            monthly_counts[month_key] = {
                'month': month_name,
                'month_key': month_key,
                'homecare': 0,
                'phone': 0,
                'total': 0,
            }

        if is_phone:
            monthly_counts[month_key]['phone'] += consult_count
        else:
            monthly_counts[month_key]['homecare'] += consult_count

        monthly_counts[month_key]['total'] += consult_count

    sorted_months = sorted(monthly_counts.items(), key=lambda x: x[0])
    data = [item[1] for item in sorted_months]

    total_homecare = sum(d['homecare'] for d in data)
    total_phone = sum(d['phone'] for d in data)
    grand_total = sum(d['total'] for d in data)

    return {
        'success': True,
        'data': data,
        'total_homecare': total_homecare,
        'total_phone': total_phone,
        'grand_total': grand_total,
    }
