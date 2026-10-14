"""
Backend service for Responsiveness Analysis (in Homecare Days).
Completely decoupled from legacy analytics code.
Queries domain models directly (Patient, PatientVisit, DailyVehicleSchedule) — 100% actual database data.
"""

from datetime import datetime, date, timedelta
from collections import OrderedDict, Counter, defaultdict
from typing import Any, Dict, Optional, Tuple, Set
from sqlalchemy import func, or_
from app.extensions import db
from app.patients.models import Patient
from app.saranam.models.patient_visit import PatientVisit
from app.saranam.models.daily_vehicle_schedule import DailyVehicleSchedule
from .shared.filters.patient_filters import (
    apply_patient_filters,
    apply_date_range_filter,
    parse_filter_params,
)


def parse_homecare_days_val(val: Any) -> Optional[int]:
    """
    Parse homecare_days_at_schedule column into an integer number of days per week (1-7).
    Handles integers, floats, string numbers, and day names.
    """
    if val is None:
        return None
    val_str = str(val).strip()
    if not val_str:
        return None
    try:
        n = int(float(val_str))
        if 1 <= n <= 7:
            return n
    except (ValueError, TypeError):
        pass

    # Check weekday names (e.g. "Mon, Tue, Thu, Fri")
    day_map = {'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'}
    lower_s = val_str.lower().replace('and', ',').replace(';', ',')
    matched = set()
    for part in lower_s.split(','):
        part = part.strip()
        for d in day_map:
            if part.startswith(d):
                matched.add(d)
                break
    if matched:
        return len(matched)

    return None


def get_weekdays_for_count(n: int) -> Set[int]:
    """
    Return the set of weekdays (0=Monday, 6=Sunday) considered active homecare days
    for a given days/week count.
    - 4 days: Mon, Tue, Thu, Fri {0, 1, 3, 4} (per clinical protocol)
    - 5 days: Mon through Fri {0, 1, 2, 3, 4}
    - 6 days: Mon through Sat {0, 1, 2, 3, 4, 5}
    - 7 days: All days {0..6}
    """
    if n == 4:
        return {0, 1, 3, 4}  # Mon, Tue, Thu, Fri
    elif n == 5:
        return {0, 1, 2, 3, 4}  # Mon-Fri
    elif n == 6:
        return {0, 1, 2, 3, 4, 5}
    elif n >= 7:
        return {0, 1, 2, 3, 4, 5, 6}
    elif n == 3:
        return {0, 1, 3}
    elif n == 2:
        return {0, 3}
    elif n == 1:
        return {0}
    return {0, 1, 3, 4}  # Fallback to 4 days


def get_responsiveness_analysis_data(params: dict) -> dict:
    """
    Calculate average elapsed Homecare Days between patient registration and first contact,
    grouped by patient registration month.

    Homecare Days Schedule Logic:
    - Queries daily_vehicle_schedules table for homecare_days_at_schedule.
    - If a specific date/week has homecare days defined (e.g. 4 for first 2 weeks, 5 for next week),
      use that week's configuration.
    - If any date in that month contains homecare_days data, use it for that month.
    - Otherwise, fallback to 4 homecare days/week (Mon, Tue, Thu, Fri).
    """
    filters = parse_filter_params(params)
    status = filters.get('status')
    complexity = filters.get('complexity')
    start_date = filters.get('start_date')
    end_date = filters.get('end_date')

    # Effective patient registration date
    reg_date_expr = func.coalesce(Patient.registration_date, func.date(Patient.created_at))

    # Base query for patients with a registration date
    patient_q = db.session.query(
        Patient.id.label('patient_id'),
        reg_date_expr.label('registration_date')
    ).filter(
        reg_date_expr.isnot(None)
    )

    patient_q = apply_patient_filters(patient_q, status=status, complexity=complexity)
    patient_q = apply_date_range_filter(patient_q, reg_date_expr, start_date=start_date, end_date=end_date)

    patients = patient_q.all()
    if not patients:
        return {
            'success': True,
            'data': [],
            'overall_average_days': 0,
            'overall_average_homecare_days': 0,
            'overall_average_calendar_days': 0,
            'total_patients_with_contact': 0,
            'homecare_days_note': "Home Care Days are: Mon, Tue, and Thu, Friday",
        }

    patient_map: Dict[Any, date] = {}
    for p in patients:
        r_date = p.registration_date
        if isinstance(r_date, str):
            try:
                r_date = datetime.strptime(r_date[:10], '%Y-%m-%d').date()
            except Exception:
                continue
        elif hasattr(r_date, 'date'):
            r_date = r_date.date()
        patient_map[p.patient_id] = r_date

    patient_ids = list(patient_map.keys())

    # Query earliest completed/in-progress homecare visit per patient (excluding teleconsult)
    first_visits = (
        db.session.query(
            PatientVisit.patient_id,
            func.min(PatientVisit.visit_date).label('first_visit_date')
        )
        .filter(
            PatientVisit.patient_id.in_(patient_ids),
            or_(
                PatientVisit.status.in_(['completed', 'in_progress']),
                PatientVisit.status.is_(None)
            ),
            or_(
                PatientVisit.visit_type.is_(None),
                PatientVisit.visit_type != 'teleconsult'
            )
        )
        .group_by(PatientVisit.patient_id)
        .all()
    )

    first_visit_map: Dict[Any, date] = {}
    for fv in first_visits:
        v_date = fv.first_visit_date
        if isinstance(v_date, str):
            try:
                v_date = datetime.strptime(v_date[:10], '%Y-%m-%d').date()
            except Exception:
                continue
        elif hasattr(v_date, 'date'):
            v_date = v_date.date()
        first_visit_map[fv.patient_id] = v_date

    # Build homecare days schedule lookup from daily_vehicle_schedules
    date_hc_map: Dict[date, int] = {}
    week_values: Dict[Tuple[int, int], list] = defaultdict(list)
    month_values: Dict[Tuple[int, int], list] = defaultdict(list)

    try:
        dvs_rows = (
            db.session.query(
                DailyVehicleSchedule.schedule_date,
                DailyVehicleSchedule.homecare_days_at_schedule,
            )
            .filter(
                DailyVehicleSchedule.homecare_days_at_schedule.isnot(None)
            )
            .all()
        )

        for row in dvs_rows:
            s_date = row.schedule_date
            if hasattr(s_date, 'date'):
                s_date = s_date.date()
            elif isinstance(s_date, str):
                try:
                    s_date = datetime.strptime(s_date[:10], '%Y-%m-%d').date()
                except Exception:
                    continue
            if not s_date:
                continue

            n_days = parse_homecare_days_val(row.homecare_days_at_schedule)
            if n_days is not None:
                date_hc_map[s_date] = n_days
                iso_yr, iso_wk, _ = s_date.isocalendar()
                week_values[(iso_yr, iso_wk)].append(n_days)
                month_values[(s_date.year, s_date.month)].append(n_days)
    except Exception as ex:
        print(f"Error querying daily_vehicle_schedules for homecare days: {ex}")

    week_hc_map: Dict[Tuple[int, int], int] = {
        k: Counter(v).most_common(1)[0][0] for k, v in week_values.items() if v
    }
    month_hc_map: Dict[Tuple[int, int], int] = {
        k: Counter(v).most_common(1)[0][0] for k, v in month_values.items() if v
    }

    def resolve_homecare_days_for_date(d: date) -> int:
        """
        Resolve homecare days count for date d:
        1. Exact date schedule if available.
        2. ISO week schedule if available (e.g. 4 for first two weeks, 5 for next week).
        3. Month schedule if any date in that month has homecare days data.
        4. Fallback: 4 homecare days/week.
        """
        if d in date_hc_map:
            return date_hc_map[d]
        iso_yr, iso_wk, _ = d.isocalendar()
        if (iso_yr, iso_wk) in week_hc_map:
            return week_hc_map[(iso_yr, iso_wk)]
        if (d.year, d.month) in month_hc_map:
            return month_hc_map[(d.year, d.month)]
        return 4

    def count_homecare_days_between(reg_d: date, visit_d: date) -> int:
        """Count operational homecare days elapsed between reg_d and visit_d."""
        if not reg_d or not visit_d or visit_d <= reg_d:
            return 0
        count = 0
        curr = reg_d + timedelta(days=1)
        while curr <= visit_d:
            hc_count = resolve_homecare_days_for_date(curr)
            active_weekdays = get_weekdays_for_count(hc_count)
            if curr.weekday() in active_weekdays:
                count += 1
            curr += timedelta(days=1)
        return count

    # Aggregate by patient registration month
    monthly_stats = OrderedDict()
    total_hc_days_all = 0
    total_cal_days_all = 0
    total_contacted_all = 0

    for pid, reg_date in patient_map.items():
        first_visit_date = first_visit_map.get(pid)
        if not first_visit_date:
            continue

        cal_gap = max(0, (first_visit_date - reg_date).days)
        hc_gap = count_homecare_days_between(reg_date, first_visit_date)

        month_key = reg_date.strftime('%Y-%m')
        month_name = reg_date.strftime('%B')

        if month_key not in monthly_stats:
            monthly_stats[month_key] = {
                'month': month_name,
                'month_key': month_key,
                'total_homecare_days': 0,
                'total_calendar_days': 0,
                'patient_count': 0,
            }

        monthly_stats[month_key]['total_homecare_days'] += hc_gap
        monthly_stats[month_key]['total_calendar_days'] += cal_gap
        monthly_stats[month_key]['patient_count'] += 1
        total_hc_days_all += hc_gap
        total_cal_days_all += cal_gap
        total_contacted_all += 1

    sorted_months = sorted(monthly_stats.items(), key=lambda x: x[0])

    data = [
        {
            'month': item[1]['month'],
            'month_key': item[1]['month_key'],
            'average_homecare_days': round(item[1]['total_homecare_days'] / item[1]['patient_count'])
            if item[1]['patient_count'] > 0 else 0,
            'average_homecare_days_decimal': round(item[1]['total_homecare_days'] / item[1]['patient_count'], 1)
            if item[1]['patient_count'] > 0 else 0,
            'average_calendar_days': round(item[1]['total_calendar_days'] / item[1]['patient_count'])
            if item[1]['patient_count'] > 0 else 0,
            'average_calendar_days_decimal': round(item[1]['total_calendar_days'] / item[1]['patient_count'], 1)
            if item[1]['patient_count'] > 0 else 0,
            'average_days': round(item[1]['total_homecare_days'] / item[1]['patient_count'])
            if item[1]['patient_count'] > 0 else 0,
            'patients_count': item[1]['patient_count'],
        }
        for item in sorted_months
    ]

    overall_hc_avg = round(total_hc_days_all / total_contacted_all, 1) if total_contacted_all > 0 else 0
    overall_cal_avg = round(total_cal_days_all / total_contacted_all, 1) if total_contacted_all > 0 else 0

    observed_days = set(week_hc_map.values()) | set(month_hc_map.values())
    if not observed_days or observed_days == {4}:
        hc_note = "Home Care Days are:\nMon, Tue, and Thu, Friday"
    elif observed_days == {5}:
        hc_note = "Home Care Days are:\nMon, Tue, Wed, Thu, Friday"
    elif observed_days == {6}:
        hc_note = "Home Care Days are:\nMon, Tue, Wed, Thu, Fri, Saturday"
    elif observed_days == {7}:
        hc_note = "Home Care Days are:\nAll 7 Days (Mon–Sun)"
    else:
        hc_note = f"Home Care Days: Dynamic ({', '.join(str(d) for d in sorted(observed_days))} days/week per schedule)"

    return {
        'success': True,
        'data': data,
        'overall_average_days': overall_hc_avg,
        'overall_average_homecare_days': overall_hc_avg,
        'overall_average_calendar_days': overall_cal_avg,
        'total_patients_with_contact': total_contacted_all,
        'homecare_days_note': hc_note,
    }

