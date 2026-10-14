"""
Backend service for Incoming Vs. Outgoing Phone Calls Distribution.
Completely decoupled from legacy analytics code.
Considers call direction from tele_documentation (teleconsult_documentation) table only.
"""

from sqlalchemy import func
from app.extensions import db
from app.patients.models import Patient
from app.teleconsult.models.tele_session import TeleSession
from app.teleconsult.models.teleconsult_documentation import TeleconsultDocumentation
from app.saranam.models.patient_visit import PatientVisit
from .shared.filters.patient_filters import (
    apply_patient_filters,
    apply_date_range_filter,
    parse_filter_params,
)


def get_phone_call_distribution_data(params: dict) -> dict:
    """
    Get breakdown of phone consultations by call direction strictly from
    the tele_documentation (teleconsult_documentation) table only:
    - Incoming call
    - Outgoing call
    """
    filters = parse_filter_params(params)
    status = filters.get('status')
    complexity = filters.get('complexity')
    start_date = filters.get('start_date')
    end_date = filters.get('end_date')

    effective_call_date = func.coalesce(
        PatientVisit.visit_date,
        func.date(TeleconsultDocumentation.created_at)
    ).label('call_date')

    # Query call direction strictly from teleconsult_documentation table
    query = (
        db.session.query(
            TeleconsultDocumentation.id,
            TeleconsultDocumentation.call_direction,
            effective_call_date
        )
        .outerjoin(TeleSession, TeleconsultDocumentation.session_id == TeleSession.id)
        .outerjoin(PatientVisit, TeleSession.linked_visit_id == PatientVisit.id)
        .outerjoin(Patient, TeleSession.patient_id == Patient.id)
        .filter(
            TeleconsultDocumentation.call_direction.isnot(None),
            TeleconsultDocumentation.call_direction != ''
        )
    )

    if status or complexity:
        query = apply_patient_filters(query, status=status, complexity=complexity)

    if start_date or end_date:
        query = apply_date_range_filter(
            query,
            effective_call_date,
            start_date=start_date,
            end_date=end_date
        )

    records = query.all()

    incoming_count = 0
    outgoing_count = 0

    for rec in records:
        dir_val = (rec.call_direction or '').lower().strip()
        if 'out' in dir_val:
            outgoing_count += 1
        elif 'incoming' in dir_val or 'inbound' in dir_val or dir_val.startswith('in'):
            incoming_count += 1
        else:
            outgoing_count += 1

    total = incoming_count + outgoing_count

    data = [
        {
            'name': 'Incoming call',
            'count': incoming_count,
            'percentage': round((incoming_count / total) * 100) if total > 0 else 0,
            'color': '#f97316',  # Orange matching presentation slide
        },
        {
            'name': 'Outgoing call',
            'count': outgoing_count,
            'percentage': round((outgoing_count / total) * 100) if total > 0 else 0,
            'color': '#3b82f6',  # Blue matching presentation slide
        },
    ]

    return {
        'success': True,
        'data': data,
        'incoming_count': incoming_count,
        'outgoing_count': outgoing_count,
        'total': total,
    }

