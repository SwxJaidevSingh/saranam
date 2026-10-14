"""
Backend service for At-Home Clinical Procedures Trend (Nursing, Physio, Psycho-Social, Doctor).
Completely decoupled from legacy analytics code.
Queries procedures_records joined with patient_visits:
- Counts individual procedure items in JSONB arrays (nursing, counsellor, physiotherapy, medical)
- Filters to at-home / in-person visits (excluding teleconsult)
"""

from datetime import datetime
from collections import OrderedDict
from sqlalchemy import func
from app.extensions import db
from app.patients.models import Patient
from app.saranam.models.patient_visit import PatientVisit
from app.saranam.models.procedures_record import ProceduresRecord
from .shared.filters.patient_filters import (
    apply_patient_filters,
    apply_date_range_filter,
    parse_filter_params,
)


def count_procedures(val) -> int:
    """Count number of selected procedure items in JSONB field."""
    if not val:
        return 0
    if isinstance(val, list):
        return len([item for item in val if item])
    if isinstance(val, dict):
        # Could be {key: True, ...} or {items: [...]}
        if 'items' in val and isinstance(val['items'], list):
            return len(val['items'])
        return len([k for k, v in val.items() if v])
    if isinstance(val, str) and val.strip():
        return 1
    return 0


def get_clinical_procedures_trend_data(params: dict) -> dict:
    """
    Get monthwise breakup of at-home clinical procedures across:
    - Nurse (Nursing procedures)
    - Counsellor (Psychological / Psycho-social procedures)
    - Physiotherapist (Physiotherapy procedures)
    - Doctor (Medical procedures, if present)
    """
    filters = parse_filter_params(params)
    status = filters.get('status')
    complexity = filters.get('complexity')
    start_date = filters.get('start_date')
    end_date = filters.get('end_date')

    # Effective date: prioritize visit_date, fallback to procedures created_at
    effective_date = func.coalesce(
        PatientVisit.visit_date,
        func.date(ProceduresRecord.created_at)
    ).label('proc_date')

    query = (
        db.session.query(
            ProceduresRecord.id,
            ProceduresRecord.nursing,
            ProceduresRecord.counsellor,
            ProceduresRecord.physiotherapy,
            ProceduresRecord.medical,
            effective_date
        )
        .join(PatientVisit, ProceduresRecord.visit_id == PatientVisit.id)
        .join(Patient, PatientVisit.patient_id == Patient.id)
        .filter(
            Patient.is_active.is_(True),
            # Exclude teleconsultation visits since chart is for "At-Home Clinical Procedures"
            func.coalesce(func.lower(PatientVisit.visit_type), '') != 'teleconsult'
        )
    )

    if status or complexity:
        query = apply_patient_filters(query, status=status, complexity=complexity)

    if start_date or end_date:
        query = apply_date_range_filter(query, effective_date, start_date=start_date, end_date=end_date)

    records = query.all()

    monthly_counts = OrderedDict()

    for rec in records:
        p_date = rec.proc_date
        if not p_date:
            continue
        if isinstance(p_date, str):
            try:
                p_date = datetime.strptime(p_date[:10], '%Y-%m-%d').date()
            except Exception:
                continue
        elif hasattr(p_date, 'date'):
            p_date = p_date.date()

        month_key = p_date.strftime('%Y-%m')
        month_label = p_date.strftime('%b-%y')  # e.g. Mar-26 matching slide

        if month_key not in monthly_counts:
            monthly_counts[month_key] = {
                'month': month_label,
                'month_key': month_key,
                'nurse': 0,
                'counsellor': 0,
                'physiotherapist': 0,
                'doctor': 0,
                'total': 0,
            }

        n_cnt = count_procedures(rec.nursing)
        c_cnt = count_procedures(rec.counsellor)
        p_cnt = count_procedures(rec.physiotherapy)
        m_cnt = count_procedures(rec.medical)

        monthly_counts[month_key]['nurse'] += n_cnt
        monthly_counts[month_key]['counsellor'] += c_cnt
        monthly_counts[month_key]['physiotherapist'] += p_cnt
        monthly_counts[month_key]['doctor'] += m_cnt
        monthly_counts[month_key]['total'] += (n_cnt + c_cnt + p_cnt + m_cnt)

    sorted_months = sorted(monthly_counts.items(), key=lambda x: x[0])
    data = [item[1] for item in sorted_months]

    total_nurse = sum(d['nurse'] for d in data)
    total_counsellor = sum(d['counsellor'] for d in data)
    total_physio = sum(d['physiotherapist'] for d in data)
    total_doctor = sum(d['doctor'] for d in data)
    grand_total = sum(d['total'] for d in data)

    has_doctor = total_doctor > 0

    return {
        'success': True,
        'data': data,
        'has_doctor': has_doctor,
        'total_nurse': total_nurse,
        'total_counsellor': total_counsellor,
        'total_physiotherapist': total_physio,
        'total_doctor': total_doctor,
        'grand_total': grand_total,
    }
