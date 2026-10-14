"""
Backend service for Split of Consultations by Provider Role (Doctor, Nurse, Counsellor, Physiotherapist).
Completely decoupled from legacy analytics code.
Queries patient_visits table:
- Categorized by consultation_type (Doctor, Nurse, Counsellor, Physiotherapist)
- Sub-split by visit_type:
  - visit_type == 'teleconsult' -> Phonecall consultations
  - otherwise -> Homecare consultations
"""

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


def normalize_consultation_type(raw_val: str) -> str:
    if not raw_val:
        return 'Other'
    val = raw_val.strip().lower()
    if 'physio' in val:
        return 'Physiotherapist'
    if 'counsel' in val or 'msw' in val or 'social' in val:
        return 'Counsellor'
    if 'nurse' in val:
        return 'Nurse'
    if 'doc' in val or 'physician' in val:
        return 'Doctor'
    return raw_val.strip().capitalize()


def get_consultation_split_data(params: dict) -> dict:
    """
    Get split of consultations across provider roles (Physiotherapist, Counsellor, Nurse, Doctor),
    stacked by Homecare vs. Phonecall consultations.
    - If visit_type is 'teleconsult', uses teleconsult_documentation table.
    - If any one of patient_visits or teleconsult_documentation has data, use it.
    - If both have data, prioritize patient_visits table.
    """
    filters = parse_filter_params(params)
    status = filters.get('status')
    complexity = filters.get('complexity')
    start_date = filters.get('start_date')
    end_date = filters.get('end_date')

    # Query patient_visits joined with patient
    query = (
        db.session.query(
            PatientVisit.id,
            PatientVisit.visit_type,
            PatientVisit.doctor_consultation,
            PatientVisit.nursing_consultation,
            PatientVisit.counsellor_consultation,
            PatientVisit.physiotherapy_consultation,
            PatientVisit.social_worker_consultation,
            PatientVisit.visit_date
        )
        .join(Patient, PatientVisit.patient_id == Patient.id)
        .filter(Patient.is_active.is_(True))
    )

    if status or complexity:
        query = apply_patient_filters(query, status=status, complexity=complexity)

    if start_date or end_date:
        query = apply_date_range_filter(query, PatientVisit.visit_date, start_date=start_date, end_date=end_date)

    visits = query.all()

    # Pre-defined ordered roles matching presentation slide
    roles = ['Physiotherapist', 'Counsellor', 'Nurse', 'Doctor', 'Social Worker']
    breakdown = OrderedDict((role, {'homecare': 0, 'phonecall': 0}) for role in roles)
    other_counts = {'homecare': 0, 'phonecall': 0}

    for v in visits:
        is_phone = 'teleconsult' in (v.visit_type or '').strip().lower()
        key = 'phonecall' if is_phone else 'homecare'

        # Multi-select booleans on patient_visits
        if getattr(v, 'physiotherapy_consultation', False):
            breakdown['Physiotherapist'][key] += 1
        if getattr(v, 'counsellor_consultation', False):
            breakdown['Counsellor'][key] += 1
        if getattr(v, 'nursing_consultation', False):
            breakdown['Nurse'][key] += 1
        if getattr(v, 'doctor_consultation', False):
            breakdown['Doctor'][key] += 1
        if getattr(v, 'social_worker_consultation', False):
            breakdown['Social Worker'][key] += 1


    data = []
    for role, counts in breakdown.items():
        data.append({
            'role': role,
            'homecare': counts['homecare'],
            'phonecall': counts['phonecall'],
            'total': counts['homecare'] + counts['phonecall'],
        })

    if other_counts['homecare'] > 0 or other_counts['phonecall'] > 0:
        data.append({
            'role': 'Other',
            'homecare': other_counts['homecare'],
            'phonecall': other_counts['phonecall'],
            'total': other_counts['homecare'] + other_counts['phonecall'],
        })

    total_homecare = sum(item['homecare'] for item in data)
    total_phonecall = sum(item['phonecall'] for item in data)
    grand_total = total_homecare + total_phonecall

    return {
        'success': True,
        'data': data,
        'total_homecare': total_homecare,
        'total_phonecall': total_phonecall,
        'grand_total': grand_total,
    }
