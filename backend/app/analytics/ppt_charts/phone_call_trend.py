"""
Backend service for Month Wise Trend of Phone Call Consultations.
Completely decoupled from legacy analytics code.
Queries patient_visits table directly using the 5 boolean consultation columns.
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


def get_phone_call_trend_data(params: dict) -> dict:
    """
    Get monthly volume trend of phone consultations:
    - March: 23
    - April: 58
    - May: 60
    - June: 97
    - July: 86
    """
    filters = parse_filter_params(params)
    status = filters.get('status')
    complexity = filters.get('complexity')
    start_date = filters.get('start_date')
    end_date = filters.get('end_date')

    # Primary source: patient_visits table where visit_type is 'teleconsult'
    pv_query = (
        db.session.query(
            PatientVisit.id,
            PatientVisit.visit_date.label('call_date'),
            PatientVisit.doctor_consultation,
            PatientVisit.nursing_consultation,
            PatientVisit.counsellor_consultation,
            PatientVisit.physiotherapy_consultation,
            PatientVisit.social_worker_consultation,
        )
        .join(Patient, PatientVisit.patient_id == Patient.id)
        .filter(
            Patient.is_active.is_(True),
            func.lower(PatientVisit.visit_type).like('%teleconsult%')
        )
    )
    if status or complexity:
        pv_query = apply_patient_filters(pv_query, status=status, complexity=complexity)
    if start_date or end_date:
        pv_query = apply_date_range_filter(pv_query, PatientVisit.visit_date, start_date=start_date, end_date=end_date)
    pv_records = pv_query.all()

    monthly_counts = OrderedDict()

    # Process teleconsult visits (1 visit can have multiple consultations across disciplines)
    for v in pv_records:
        c_date = v.call_date
        if not c_date:
            continue
        if isinstance(c_date, str):
            try:
                c_date = datetime.strptime(c_date[:10], '%Y-%m-%d').date()
            except Exception:
                continue
        elif hasattr(c_date, 'date'):
            c_date = c_date.date()

        # Count active discipline flags
        consult_count = sum([
            bool(getattr(v, 'physiotherapy_consultation', False)),
            bool(getattr(v, 'counsellor_consultation', False)),
            bool(getattr(v, 'nursing_consultation', False)),
            bool(getattr(v, 'doctor_consultation', False)),
            bool(getattr(v, 'social_worker_consultation', False)),
        ])

        if consult_count == 0:
            continue

        month_key = c_date.strftime('%Y-%m')
        month_name = c_date.strftime('%B')

        if month_key not in monthly_counts:
            monthly_counts[month_key] = {
                'month': month_name,
                'month_key': month_key,
                'consultations': 0,
            }

        monthly_counts[month_key]['consultations'] += consult_count

    sorted_months = sorted(monthly_counts.items(), key=lambda x: x[0])
    data = [item[1] for item in sorted_months]
    total = sum(d['consultations'] for d in data)

    return {
        'success': True,
        'data': data,
        'total_consultations': total,
    }
