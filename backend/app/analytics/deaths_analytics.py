"""
Deaths Analytics Service.

Aggregates palliative-care outcome metrics: how many patients died in a
window, how many team visits each of them had before death, and a 12-month
time series for the deaths-over-time chart. Added per client meeting
2026-04-07 (section 6.3 / 6.4) — replaces the "improvement" framing of the
dashboard.
"""
from sqlalchemy import func
from datetime import date, timedelta, datetime
from typing import List, Optional

from app.extensions import db
from app.patients.models import Patient
from app.saranam.models.patient_visit import PatientVisit
from app.analytics.models import PatientLocation


class DeathsAnalyticsService:
    """Dashboard aggregates tied to patient death outcomes."""

    @staticmethod
    def get_deaths_impact(window_days: int = 30, patient_status: Optional[str] = None, initial_visit_status: Optional[str] = None) -> dict:
        """
        Palliative outcomes: deaths volume and visit count correlation.
        - window_days: rolling days looking back from today.
        - patient_status: optional status to filter Patients (e.g. alive_active, dead).
        - initial_visit_status: 'completed' (completed initial visit), 'none' (no completed initial visit), or None.
        
        Returns:
        - window_days: echo of input parameter.
        - deaths_in_window: total count of deceased patients in the range.
        - avg_visits_before_death: mean of the completed-visit count per
          deceased patient, limited to visits dated on or before the
          patient's date_of_death.
        - deceased_patients: per-patient breakdown used as the supporting
          list under the dashboard KPIs.
        """
        today = date.today()
        window_start = today - timedelta(days=window_days)

        query = (
            Patient.query
            .filter(Patient.is_active == True)
            .filter(Patient.is_deceased.is_(True))
            .filter(Patient.date_of_death.isnot(None))
            .filter(Patient.date_of_death >= window_start)
            .filter(Patient.date_of_death <= today)
        )

        if initial_visit_status == 'completed':
            completed_initial_subquery = (
                db.session.query(PatientVisit.patient_id)
                .filter(PatientVisit.status == 'completed')
                .filter(PatientVisit.visit_type == 'initial')
                .subquery()
            )
            query = query.filter(Patient.id.in_(completed_initial_subquery))
        elif initial_visit_status == 'none':
            completed_initial_subquery = (
                db.session.query(PatientVisit.patient_id)
                .filter(PatientVisit.status == 'completed')
                .filter(PatientVisit.visit_type == 'initial')
                .subquery()
            )
            query = query.filter(~Patient.id.in_(completed_initial_subquery))

        from app.analytics.services import AnalyticsService
        query = AnalyticsService.apply_patient_filters(query, Patient, patient_status=patient_status)
        deceased = query.order_by(Patient.date_of_death.desc()).all()

        deceased_list = []
        visit_counts = []
        for p in deceased:
            visit_count = (
                PatientVisit.query
                .filter(PatientVisit.patient_id == p.id)
                .filter(PatientVisit.status == 'completed')
                .filter(PatientVisit.visit_date <= p.date_of_death)
                .count()
            )
            visit_counts.append(visit_count)
            
            # Retrieve Patient Location details
            loc = PatientLocation.query.filter(PatientLocation.patient_id == p.id).first()
            
            deceased_list.append({
                'patient_id': str(p.id),
                'name': p.full_name,
                'date_of_death': p.date_of_death.isoformat(),
                'visit_count': visit_count,
                'gender': p.gender or 'Unknown',
                'zone': p.geographic_cluster or 'Central',
                'latitude': float(loc.latitude) if (loc and loc.latitude is not None) else None,
                'longitude': float(loc.longitude) if (loc and loc.longitude is not None) else None,
                'address': loc.address_full if loc else None,
                'bsc_status': p.bsc_status,
                'linked_hospital': p.linked_hospital,
            })

        avg_visits = round(sum(visit_counts) / len(visit_counts), 1) if visit_counts else 0.0

        return {
            'window_days': window_days,
            'deaths_in_window': len(deceased),
            'avg_visits_before_death': avg_visits,
            'deceased_patients': deceased_list,
            'deaths_by_month': DeathsAnalyticsService._get_deaths_timeline(window_days, patient_status=patient_status, initial_visit_status=initial_visit_status),
        }

    @staticmethod
    def _get_deaths_timeline(window_days: int = 30, patient_status: Optional[str] = None, initial_visit_status: Optional[str] = None) -> List[dict]:
        """
        Return bucketed deaths data based on the window length, grouped by age groups
        to enable multi-line charts.
        """
        today = date.today()
        start_d = today - timedelta(days=window_days)
        
        # Determine grouping granularity
        if window_days <= 1:
            trunc_unit = 'hour'
            date_format = '%H:00'
        elif window_days <= 31:
            trunc_unit = 'day'
            date_format = '%Y-%m-%d'
        elif window_days <= 366:
            trunc_unit = 'month'
            date_format = '%Y-%m'
        else:
            trunc_unit = 'year'
            date_format = '%Y'

        query = db.session.query(
            Patient.id,
            Patient.date_of_death,
            Patient.created_at,
            Patient.date_of_birth
        ).select_from(Patient).filter(
            Patient.is_active == True,
            Patient.is_deceased.is_(True),
            Patient.date_of_death.isnot(None),
            Patient.date_of_death >= start_d,
            Patient.date_of_death <= today
        )
        
        if initial_visit_status == 'completed':
            completed_initial_subquery = (
                db.session.query(PatientVisit.patient_id)
                .filter(PatientVisit.status == 'completed')
                .filter(PatientVisit.visit_type == 'initial')
                .subquery()
            )
            query = query.filter(Patient.id.in_(completed_initial_subquery))
        elif initial_visit_status == 'none':
            completed_initial_subquery = (
                db.session.query(PatientVisit.patient_id)
                .filter(PatientVisit.status == 'completed')
                .filter(PatientVisit.visit_type == 'initial')
                .subquery()
            )
            query = query.filter(~Patient.id.in_(completed_initial_subquery))

        from app.analytics.services import AnalyticsService
        query = AnalyticsService.apply_patient_filters(query, Patient, patient_status=patient_status)
        
        patients = query.all()
        
        from collections import defaultdict
        grouped = defaultdict(lambda: {
            'child_adolescent': 0,
            'adults': 0,
            'older_adults': 0,
            'unknown': 0,
            'count': 0
        })
        
        today_date = date.today()
        
        for p in patients:
            dod = p.date_of_death
            
            # Format bucket key
            if trunc_unit == 'hour':
                dt = p.created_at if p.date_of_death is None else datetime.combine(p.date_of_death, datetime.min.time())
                bucket_key = dt.strftime(date_format)
            else:
                bucket_key = dod.strftime(date_format)
                
            # Determine age group
            if p.date_of_birth is None:
                age_grp = 'unknown'
            else:
                dob = p.date_of_birth
                # Calculate age in years
                age = today_date.year - dob.year - ((today_date.month, today_date.day) < (dob.month, dob.day))
                if age < 0:
                    age_grp = 'unknown'
                elif age < 19:
                    age_grp = 'child_adolescent'
                elif age < 60:
                    age_grp = 'adults'
                else:
                    age_grp = 'older_adults'
            
            grouped[bucket_key][age_grp] += 1
            grouped[bucket_key]['count'] += 1
            
        sorted_keys = sorted(grouped.keys())
        
        return [
            {
                'month': key,
                'child_adolescent': grouped[key]['child_adolescent'],
                'adults': grouped[key]['adults'],
                'older_adults': grouped[key]['older_adults'],
                'unknown': grouped[key]['unknown'],
                'count': grouped[key]['count']
            }
            for key in sorted_keys
        ]

    @staticmethod
    def _get_deaths_by_month(months: int = 12) -> List[dict]:
        """
        Return a `months`-length series of {month: 'YYYY-MM', count: N}
        ending at the current month. Months with no deaths are zero-filled
        so the line chart renders without gaps.
        """
        today = date.today()

        # Build the zero-filled month skeleton (oldest -> newest)
        skeleton: List[dict] = []
        year, month = today.year, today.month
        # Walk backwards `months - 1` steps to find the start month
        start_year, start_month = year, month
        for _ in range(months - 1):
            start_month -= 1
            if start_month == 0:
                start_month = 12
                start_year -= 1
        # Then walk forward filling the skeleton
        y, m = start_year, start_month
        for _ in range(months):
            skeleton.append({'month': f'{y:04d}-{m:02d}', 'count': 0})
            m += 1
            if m == 13:
                m = 1
                y += 1

        # First day of the first skeleton month = lower bound for the query
        lower_bound = date(start_year, start_month, 1)

        deceased = (
            Patient.query
            .filter(Patient.is_deceased.is_(True))
            .filter(Patient.date_of_death.isnot(None))
            .filter(Patient.date_of_death >= lower_bound)
            .filter(Patient.date_of_death <= today)
            .all()
        )

        # Aggregate into the skeleton
        by_key = {b['month']: b for b in skeleton}
        for p in deceased:
            key = f'{p.date_of_death.year:04d}-{p.date_of_death.month:02d}'
            if key in by_key:
                by_key[key]['count'] += 1

        return skeleton
