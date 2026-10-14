"""
Backend service for Mortality Overview Metrics.
Completely decoupled from legacy analytics code.
Analyzes deceased patients:
- Number of Deaths
- Deaths Before First Visit
- Ave. Days Between Regn. and Death
- Deaths At Home (%)
"""

from typing import Dict, Any
from sqlalchemy import func
from app.extensions import db
from app.patients.models import Patient
from app.saranam.models.patient_visit import PatientVisit
from .shared.filters.patient_filters import (
    apply_patient_filters,
    apply_date_range_filter,
    parse_filter_params,
)


def get_mortality_overview_data(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get mortality summary metrics:
    - number_of_deaths: total deceased patients
    - deaths_before_first_visit: deceased patients with no clinical visit before death
    - avg_days_regn_to_death: average days between registration_date and date_of_death
    - deaths_at_home_pct: percentage of deceased patients whose place of death was home
    """
    filters = parse_filter_params(params)
    status = filters.get('status')
    complexity = filters.get('complexity')
    start_date = filters.get('start_date')
    end_date = filters.get('end_date')

    # Query all deceased patients
    query = (
        db.session.query(
            Patient.id,
            Patient.registration_date,
            Patient.date_of_death,
            Patient.place_of_death
        )
        .filter(
            Patient.is_deceased.is_(True),
            Patient.is_active.is_(True)
        )
    )

    if status or complexity:
        query = apply_patient_filters(query, status=status, complexity=complexity)

    if start_date or end_date:
        query = apply_date_range_filter(
            query,
            func.coalesce(Patient.date_of_death, Patient.registration_date),
            start_date=start_date,
            end_date=end_date
        )

    deceased_patients = query.all()
    number_of_deaths = len(deceased_patients)

    if number_of_deaths == 0:
        return {
            'success': True,
            'number_of_deaths': 0,
            'deaths_before_first_visit': 0,
            'avg_days_regn_to_death': 0,
            'deaths_at_home_pct': 0,
        }

    deceased_ids = [p.id for p in deceased_patients]

    # Query visits for deceased patients to determine who received a clinical visit before death
    visits = (
        db.session.query(
            PatientVisit.patient_id,
            PatientVisit.visit_date,
            PatientVisit.visit_type
        )
        .filter(
            PatientVisit.patient_id.in_(deceased_ids),
            func.coalesce(func.lower(PatientVisit.visit_type), '') != 'teleconsult',
            PatientVisit.visit_date.isnot(None)
        )
        .all()
    )

    # Map patient_id to their earliest clinical visit date (excluding bereavement)
    patient_first_visit = {}
    for v in visits:
        v_type = (v.visit_type or '').strip().lower()
        if 'bereave' in v_type:
            continue
        pid = v.patient_id
        v_date = v.visit_date
        if pid not in patient_first_visit or (v_date and v_date < patient_first_visit[pid]):
            patient_first_visit[pid] = v_date

    deaths_before_first_visit = 0
    days_diffs = []
    home_deaths = 0
    deaths_with_place = 0

    for p in deceased_patients:
        # 1. Did patient receive a clinical visit before death?
        first_v = patient_first_visit.get(p.id)
        if not first_v:
            deaths_before_first_visit += 1
        elif p.date_of_death and first_v > p.date_of_death:
            deaths_before_first_visit += 1

        # 2. Days between registration and death
        if p.registration_date and p.date_of_death:
            reg_d = p.registration_date
            dod = p.date_of_death
            if hasattr(reg_d, 'date'):
                reg_d = reg_d.date()
            if hasattr(dod, 'date'):
                dod = dod.date()
            diff = (dod - reg_d).days
            if diff >= 0:
                days_diffs.append(diff)

        # 3. Place of death
        place = (p.place_of_death or '').strip().lower()
        if place:
            deaths_with_place += 1
            if place == 'home':
                home_deaths += 1

    avg_days = round(sum(days_diffs) / len(days_diffs)) if days_diffs else 0

    if deaths_with_place > 0:
        deaths_at_home_pct = round((home_deaths / deaths_with_place) * 100)
    elif number_of_deaths > 0:
        deaths_at_home_pct = round((home_deaths / number_of_deaths) * 100)
    else:
        deaths_at_home_pct = 0

    return {
        'success': True,
        'number_of_deaths': number_of_deaths,
        'deaths_before_first_visit': deaths_before_first_visit,
        'avg_days_regn_to_death': avg_days,
        'deaths_at_home_pct': deaths_at_home_pct,
    }
