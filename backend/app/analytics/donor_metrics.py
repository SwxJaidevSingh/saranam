"""Donor / Stakeholder analytics — Theory of Change-aligned headline metrics.

Built per 2026-04-28 client meeting (section 9A) and the analytics plan at
docs/Saranam/plans/analytics/PLAN.md. Designed for a high-level dashboard that
external stakeholders (donors, board, partner orgs) can scan in 30 seconds.

Scope of this module — aligned to the client's Theory of Change activity list:
  Outputs / activities reflected here (ToC PDF):
    1.  Multi-disciplinary team participation (A2 / multidisciplinary())
    3.  Home-visit count (incl. 25 km radius — handled separately)
    4.  Physician + nurse-led home care (consultations_mix())
    6.  Clinical consultations (consultations_mix())
    8.  Phone check-ins (visits_timeline visit_location='phone')
    9.  Specialist palliative-care telemedicine (telemedicine_timeline())
   13.  Death records to Kidwai (deaths_timeline() — raw, no spike suppression
        per latest client direction)
  Plus operational stewardship:
    - A1 / A3 / A5 / B8 — visit & patient & death counts per period
    - A4 KMs — estimated from approved weekly schedule × avg km/visit
    - B5 — opioid / morphine usage (proxy for access to opioids)

Design notes:
  - Every public method takes `start`, `end` (date) and `period` ('daily' |
    'monthly' | 'quarterly' | 'yearly'). Period is *only* for time-series
    bucketing; aggregate counts use start/end directly.
  - 'previous period' delta: same-length window immediately preceding `start`.
    Returned as `delta_pct` (None when no comparable data).
  - Death timeline shows RAW data (no spike suppression) per 2026-05-02
    client direction: "leave the data entry spikes". The chart is honest about
    the import history.
  - KMs from weekly schedule: estimated as
        sum(scheduled_slots in week) × ANALYTICS_AVG_KM_PER_VISIT
    Defaults to 12 km/visit (≈ 6 km one-way + return + chained route bias).
    Tunable via env `ANALYTICS_AVG_KM_PER_VISIT`.
  - Opioid detection uses a 3-way OR:
      narcotic == True
      who_atc_code starts with 'N02A'
      medicine_name OR generic_name matches a curated keyword list
"""
from __future__ import annotations

import os
import re
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from typing import Iterable, List, Optional, Set, Tuple

from sqlalchemy import func, and_, or_

from app.extensions import db
from app.patients.models import Patient
from app.saranam.models.patient_visit import PatientVisit


PERIOD_HOURLY = "hourly"
PERIOD_DAILY = "daily"
PERIOD_MONTHLY = "monthly"
PERIOD_QUARTERLY = "quarterly"
PERIOD_YEARLY = "yearly"
VALID_PERIODS = {PERIOD_DAILY, PERIOD_MONTHLY, PERIOD_QUARTERLY, PERIOD_YEARLY, PERIOD_HOURLY}


# ─── Time-bucket helpers ────────────────────────────────────────────

def _bucket_label(d: date | datetime, period: str) -> str:
    if period == PERIOD_HOURLY:
        h = d.hour if hasattr(d, "hour") else 0
        return f"{h:02d}:00"
    if period == PERIOD_DAILY:
        return d.isoformat()
    if period == PERIOD_MONTHLY:
        return f"{d.year:04d}-{d.month:02d}"
    if period == PERIOD_QUARTERLY:
        q = (d.month - 1) // 3 + 1
        return f"{d.year:04d}-Q{q}"
    if period == PERIOD_YEARLY:
        return f"{d.year:04d}"
    raise ValueError(f"Unknown period: {period}")


def _next_bucket_start(d: date, period: str) -> date:
    """Return the first day of the next bucket after the bucket containing `d`."""
    if period == PERIOD_DAILY:
        return d + timedelta(days=1)
    if period == PERIOD_MONTHLY:
        return date(d.year + (1 if d.month == 12 else 0),
                    1 if d.month == 12 else d.month + 1, 1)
    if period == PERIOD_QUARTERLY:
        q = (d.month - 1) // 3
        next_q = q + 1
        if next_q == 4:
            return date(d.year + 1, 1, 1)
        return date(d.year, next_q * 3 + 1, 1)
    if period == PERIOD_YEARLY:
        return date(d.year + 1, 1, 1)
    raise ValueError(f"Unknown period: {period}")


def _bucket_start(d: date, period: str) -> date:
    """First day of the bucket containing `d`."""
    if period == PERIOD_DAILY:
        return d
    if period == PERIOD_MONTHLY:
        return date(d.year, d.month, 1)
    if period == PERIOD_QUARTERLY:
        q = (d.month - 1) // 3
        return date(d.year, q * 3 + 1, 1)
    if period == PERIOD_YEARLY:
        return date(d.year, 1, 1)
    raise ValueError(f"Unknown period: {period}")


def _build_bucket_skeleton(start: date, end: date, period: str) -> List[str]:
    """Inclusive zero-fill skeleton of bucket labels from start..end."""
    if period == PERIOD_HOURLY:
        return [f"{h:02d}:00" for h in range(24)]
    if start > end:
        return []
    labels: List[str] = []
    cursor = _bucket_start(start, period)
    end_bucket = _bucket_start(end, period)
    seen = set()
    while cursor <= end_bucket:
        label = _bucket_label(cursor, period)
        if label not in seen:
            labels.append(label)
            seen.add(label)
        cursor = _next_bucket_start(cursor, period)
    return labels


# ─── Spike-suppression helper ───────────────────────────────────────

def _import_spike_dates() -> set:
    """Dates to filter out of timeline charts because the bulk-import dumped
    historic deaths there. Empty set if no env override is configured."""
    raw = os.getenv("ANALYTICS_DEATH_IMPORT_DATES") or os.getenv("ANALYTICS_DEATH_IMPORT_DATE", "")
    out = set()
    for chunk in (raw or "").split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        try:
            out.add(date.fromisoformat(chunk))
        except ValueError:
            continue
    return out


# ─── Period parsing ─────────────────────────────────────────────────

def parse_period(value: Optional[str]) -> str:
    if not value:
        return PERIOD_MONTHLY
    v = value.lower()
    if v not in VALID_PERIODS:
        raise ValueError(f"Invalid period '{value}'. Use one of: {sorted(VALID_PERIODS)}")
    return v


def parse_date_range(start: Optional[str], end: Optional[str]) -> Tuple[date, date]:
    """Defaults to 'last 12 calendar months ending today'."""
    today = date.today()
    end_d = date.fromisoformat(end) if end else today
    if start:
        start_d = date.fromisoformat(start)
    else:
        # 12 months back, day 1 — gives clean monthly buckets
        y, m = end_d.year, end_d.month
        m -= 11
        while m <= 0:
            m += 12
            y -= 1
        start_d = date(y, m, 1)
    if start_d > end_d:
        raise ValueError("start_date must be <= end_date")
    return start_d, end_d


# ─── Service ────────────────────────────────────────────────────────

class DonorMetricsService:
    """Stewardship-tier metrics. All methods are static; no instance state."""

    # ---------- A1 / A5 / A2 building blocks --------------------------------

    @staticmethod
    def _completed_visits_query(start: date, end: date,
                                visit_location: Optional[str] = None):
        q = (
            db.session.query(PatientVisit)
            .filter(PatientVisit.status == "completed")
            .filter(PatientVisit.visit_date >= start)
            .filter(PatientVisit.visit_date <= end)
        )
        if visit_location:
            q = q.filter(PatientVisit.visit_location == visit_location)
        return q

    # ---------- Top-line overview (StatCards) -------------------------------

    @staticmethod
    def _count_in_window(start: date, end: date, *,
                        visit_location: Optional[str] = None,
                        visit_locations: Optional[List[str]] = None,
                        visit_type: Optional[str] = None) -> int:
        q = (
            db.session.query(func.count(PatientVisit.id))
            .filter(PatientVisit.status == "completed")
            .filter(PatientVisit.visit_date >= start)
            .filter(PatientVisit.visit_date <= end)
        )
        if visit_locations:
            q = q.filter(PatientVisit.visit_location.in_(visit_locations))
        elif visit_location:
            q = q.filter(PatientVisit.visit_location == visit_location)
        if visit_type:
            q = q.filter(PatientVisit.visit_type == visit_type)
        return q.scalar() or 0

    @staticmethod
    def overview(start: date, end: date) -> dict:
        """Returns the StatCard numbers + previous-period deltas.

        Numbers are RAW (no spike suppression) — operators see real totals.
        Spike suppression only applies to the deaths-timeline series.

        Includes the 2026-05-13 client-meeting additions:
          - new_registrations: Patient.created_at in window
          - home_first_visits: home visits of type 'initial' (unique patients)
          - home_follow_up_visits: home visits of type 'follow_up'
        """
        def _window_counts(s: date, e: date) -> dict:
            return {
                "home_visits": DonorMetricsService._count_in_window(
                    s, e, visit_location="home"),
                "home_first_visits": DonorMetricsService._count_in_window(
                    s, e, visit_locations=["home", "opd"], visit_type="initial"),
                "home_follow_up_visits": DonorMetricsService._count_in_window(
                    s, e, visit_location="home", visit_type="follow_up"),
                "total_visits": DonorMetricsService._count_in_window(s, e),
                "patients_seen": (
                    db.session.query(func.count(func.distinct(PatientVisit.patient_id)))
                    .filter(PatientVisit.status == "completed")
                    .filter(PatientVisit.visit_date >= s)
                    .filter(PatientVisit.visit_date <= e)
                    .scalar() or 0
                ),
                "deaths": (
                    db.session.query(func.count(Patient.id))
                    .filter(Patient.is_deceased.is_(True))
                    .filter(Patient.date_of_death.isnot(None))
                    .filter(Patient.date_of_death >= s)
                    .filter(Patient.date_of_death <= e)
                    .scalar() or 0
                ),
                # Consultations = visits where team_members JSONB has at least
                # one provider. Role-encounter breakdown is in consultations_mix.
                "consultations": (
                    DonorMetricsService._completed_visits_query(s, e)
                    .filter(PatientVisit.team_members.isnot(None))
                    .count()
                ),
                # New (2026-05-13): patient registrations in window
                "new_registrations": (
                    db.session.query(func.count(Patient.id))
                    .filter(Patient.created_at >= datetime.combine(s, datetime.min.time()))
                    .filter(Patient.created_at <= datetime.combine(e, datetime.max.time()))
                    .scalar() or 0
                ),
            }

        curr = _window_counts(start, end)

        # Previous period (same length, immediately preceding)
        period_days = (end - start).days + 1
        prev_end = start - timedelta(days=1)
        prev_start = prev_end - timedelta(days=period_days - 1)
        prev = _window_counts(prev_start, prev_end)

        # All-time metrics (no date boundaries, scoped from 1970 to 3000)
        all_time = _window_counts(date(1970, 1, 1), date(3000, 12, 31))

        def _delta(c: int, p: int) -> Optional[float]:
            if p == 0:
                return None  # no comparable baseline
            return round((c - p) / p * 100, 1)

        def _tile(key: str) -> dict:
            return {
                "value": curr[key],
                "previous": prev[key],
                "delta_pct": _delta(curr[key], prev[key]),
                "all_time": all_time[key],
            }

        return {
            "range": {"start": start.isoformat(), "end": end.isoformat()},
            "previous_range": {"start": prev_start.isoformat(), "end": prev_end.isoformat()},
            "metrics": {
                "home_visits": _tile("home_visits"),
                "home_first_visits": _tile("home_first_visits"),
                "home_follow_up_visits": _tile("home_follow_up_visits"),
                "total_visits": _tile("total_visits"),
                "patients_seen": _tile("patients_seen"),
                "deaths": _tile("deaths"),
                "consultations": _tile("consultations"),
                "new_registrations": _tile("new_registrations"),
            },
        }

    # ---------- A1 / B8 — visits over time ---------------------------------

    @staticmethod
    def visits_timeline(start: date, end: date, period: str = PERIOD_MONTHLY) -> dict:
        """Bucketed visit counts split by visit_location.

        Returns:
            {
              "labels": [...bucket strings...],
              "series": [
                 {"name": "home",  "data": [12, 14, ...]},
                 {"name": "opd",   "data": [...]},
                 ...
              ]
            }
        """
        period = parse_period(period)
        labels = _build_bucket_skeleton(start, end, period)

        if period == PERIOD_HOURLY:
            rows = (
                DonorMetricsService._completed_visits_query(start, end)
                .with_entities(PatientVisit.created_at, PatientVisit.visit_location)
                .all()
            )
        else:
            rows = (
                DonorMetricsService._completed_visits_query(start, end)
                .with_entities(PatientVisit.visit_date, PatientVisit.visit_location)
                .all()
            )

        # Aggregate
        by_loc_bucket: dict = defaultdict(lambda: defaultdict(int))
        for dt_val, loc in rows:
            if not dt_val:
                continue
            label = _bucket_label(dt_val, period)
            by_loc_bucket[(loc or "unknown")][label] += 1

        # Locations in stable order
        locations = ["home", "opd", "ipd", "phone", "unknown"]
        # Add anything unexpected at the end
        for loc in by_loc_bucket:
            if loc not in locations:
                locations.append(loc)

        series = []
        for loc in locations:
            if loc not in by_loc_bucket:
                continue
            data = [by_loc_bucket[loc].get(lbl, 0) for lbl in labels]
            if any(v > 0 for v in data):
                series.append({"name": loc, "data": data})

        return {
            "period": period,
            "labels": labels,
            "series": series,
        }

    # ---------- A3 / B1 — deaths over time (raw, per client direction) ------

    @staticmethod
    def deaths_timeline(start: date, end: date, period: str = PERIOD_MONTHLY) -> dict:
        """Bucketed death counts. Raw data — no spike suppression.

        Per 2026-05-02 client direction: 'leave the data entry spikes'. Showing
        the bulk-import day in the chart is honest reporting of when records
        landed in the system; donors / Kidwai understand that initial digitization
        loaded historic deaths on a single day.
        """
        period = parse_period(period)
        labels = _build_bucket_skeleton(start, end, period)

        rows = (
            db.session.query(Patient.date_of_death)
            .filter(Patient.is_deceased.is_(True))
            .filter(Patient.date_of_death.isnot(None))
            .filter(Patient.date_of_death >= start)
            .filter(Patient.date_of_death <= end)
            .all()
        )

        by_bucket: dict = defaultdict(int)
        for (d,) in rows:
            by_bucket[_bucket_label(d, period)] += 1

        return {
            "period": period,
            "labels": labels,
            "data": [by_bucket.get(lbl, 0) for lbl in labels],
        }

    # ---------- A2 — consultations mix from team_members --------------------

    @staticmethod
    def consultations_mix(start: date, end: date) -> dict:
        """Count team-member roles across all completed visits in the period.

        The same visit can contribute multiple roles (it's a multi-disciplinary
        team). So the role counts sum to MORE than the visit count — this is
        intended (one home visit by nurse + physio = 2 role-encounters).
        """
        rows = (
            DonorMetricsService._completed_visits_query(start, end)
            .with_entities(PatientVisit.team_members)
            .all()
        )

        role_counter: Counter = Counter()
        for (members,) in rows:
            if not members or not isinstance(members, list):
                continue
            for m in members:
                role = (m or {}).get("role")
                if role:
                    role_counter[role.lower()] += 1

        # Stable, presentation-friendly order
        canonical_order = [
            "physician", "doctor", "nurse",
            "physiotherapist", "psycho_social", "psycho-social",
            "social_worker", "counsellor",
        ]
        ordered: List[Tuple[str, int]] = []
        seen = set()
        for r in canonical_order:
            if r in role_counter:
                ordered.append((r, role_counter[r]))
                seen.add(r)
        for r, n in role_counter.most_common():
            if r not in seen:
                ordered.append((r, n))

        return {
            "labels": [r for r, _ in ordered],
            "data": [n for _, n in ordered],
            "total_role_encounters": sum(role_counter.values()),
        }

    # ---------- A4 — KMs from approved weekly schedule ---------------------

    @staticmethod
    def distance_timeline(start: date, end: date) -> dict:
        """Kilometres covered per ISO-week, derived from actual vehicle logs
        (VehicleLog table) and actual completed visits.
        """
        from app.saranam.models.vehicle_log import VehicleLog
        from app.saranam.models.patient_visit import PatientVisit

        # Query vehicle logs in date range
        rows = (
            db.session.query(VehicleLog.date, func.sum(VehicleLog.number_of_kms))
            .filter(VehicleLog.date >= start)
            .filter(VehicleLog.date <= end)
            .group_by(VehicleLog.date)
            .all()
        )

        # Bucket by ISO-week (Monday-anchored)
        by_week: dict = defaultdict(float)
        for d, km_sum in rows:
            if d is None:
                continue
            week_start = d - timedelta(days=d.weekday())  # Monday
            by_week[week_start] += float(km_sum or 0.0)

        # Build inclusive zero-fill from first ISO-week containing start
        first_monday = start - timedelta(days=start.weekday())
        last_monday = end - timedelta(days=end.weekday())
        labels: List[str] = []
        cursor = first_monday
        while cursor <= last_monday:
            labels.append(cursor.isoformat())
            cursor += timedelta(weeks=1)

        km_data = [round(by_week.get(date.fromisoformat(lbl), 0.0), 1) for lbl in labels]
        total_km = round(sum(km_data), 1)

        # All-time
        all_time_km_sum = (
            db.session.query(func.sum(VehicleLog.number_of_kms))
            .scalar() or 0.0
        )
        all_time_km = round(float(all_time_km_sum), 1)

        # Calculate average km per visit in this window
        total_completed_visits = (
            db.session.query(func.count(PatientVisit.id))
            .filter(PatientVisit.status == "completed")
            .filter(PatientVisit.visit_date >= start)
            .filter(PatientVisit.visit_date <= end)
            .scalar() or 0
        )
        if total_completed_visits > 0:
            avg_km = round(total_km / total_completed_visits, 1)
        else:
            avg_km = 0.0

        # Query actual completed visits per week as the slots
        visit_rows = (
            db.session.query(PatientVisit.visit_date, func.count(PatientVisit.id))
            .filter(PatientVisit.status == "completed")
            .filter(PatientVisit.visit_date >= start)
            .filter(PatientVisit.visit_date <= end)
            .group_by(PatientVisit.visit_date)
            .all()
        )
        visits_by_week = defaultdict(int)
        for d, v_count in visit_rows:
            if d is None:
                continue
            week_start = d - timedelta(days=d.weekday())
            visits_by_week[week_start] += int(v_count or 0)

        slots_data = [visits_by_week.get(date.fromisoformat(lbl), 0) for lbl in labels]

        return {
            "labels": labels,
            "slots_per_week": slots_data,
            "km_per_week": km_data,
            "total_km": total_km,
            "all_time_km": all_time_km,
            "avg_km_per_visit": avg_km,
            "note": "Derived from vehicle logs (mileage log on active visits).",
        }

    # ---------- B5 — Opioid / morphine usage --------------------------------

    OPIOID_KEYWORDS: Set[str] = {
        "morphine", "fentanyl", "tramadol", "oxycodone", "codeine",
        "buprenorphine", "methadone", "pethidine", "hydromorphone",
        "tapentadol", "hydrocodone", "diamorphine", "oxymorphone",
    }

    @staticmethod
    def _opioid_medicine_filter():
        """SQLAlchemy filter clause matching opioid medicines.

        OR of:
          1. narcotic == True (curated catalog flag)
          2. who_atc_code starts with 'N02A' (WHO opioid analgesics)
          3. medicine_name or generic_name contains an opioid keyword
        """
        from app.inventory.models import MedicineMaster

        keyword_filters = []
        for kw in DonorMetricsService.OPIOID_KEYWORDS:
            pattern = f"%{kw}%"
            keyword_filters.append(MedicineMaster.medicine_name.ilike(pattern))
            keyword_filters.append(MedicineMaster.generic_name.ilike(pattern))

        return or_(
            MedicineMaster.narcotic.is_(True),
            MedicineMaster.who_atc_code.ilike("N02A%"),
            *keyword_filters,
        )

    @staticmethod
    def opioid_usage(start: date, end: date,
                     period: str = PERIOD_MONTHLY) -> dict:
        """Two views: distinct patients on opioids in period, dispensation
        timeline. Period bucketing for the line chart."""
        period = parse_period(period)
        labels = _build_bucket_skeleton(start, end, period)

        try:
            from app.inventory.models import (
                DispensingRecord, MedicineMaster, MedicineBatch,
            )
        except ImportError:
            return {
                "period": period,
                "labels": labels,
                "data": [0] * len(labels),
                "patient_count": 0,
                "dispensation_count": 0,
                "note": "Inventory module not loaded; opioid metrics unavailable.",
            }

        opioid_filter = DonorMetricsService._opioid_medicine_filter()

        # Joins: DispensingRecord → MedicineBatch → MedicineMaster
        # OR DispensingRecord may have a direct medicine_id; both supported.
        # We filter by date and by opioid_filter on the joined Medicine row.
        q = (
            db.session.query(DispensingRecord)
            .outerjoin(MedicineBatch,
                       DispensingRecord.batch_id == MedicineBatch.id)
            .outerjoin(MedicineMaster,
                       MedicineMaster.id == MedicineBatch.medicine_id)
            .filter(DispensingRecord.dispensed_at >= datetime.combine(start, datetime.min.time()))
            .filter(DispensingRecord.dispensed_at <= datetime.combine(end, datetime.max.time()))
            .filter(opioid_filter)
        )

        records = q.all()

        by_bucket: dict = defaultdict(int)
        patient_ids = set()
        for r in records:
            d = r.dispensed_at.date() if r.dispensed_at else None
            if not d:
                continue
            by_bucket[_bucket_label(d, period)] += 1
            if r.patient_id:
                patient_ids.add(r.patient_id)

        # All-time
        q_all = (
            db.session.query(DispensingRecord)
            .outerjoin(MedicineBatch,
                       DispensingRecord.batch_id == MedicineBatch.id)
            .outerjoin(MedicineMaster,
                       MedicineMaster.id == MedicineBatch.medicine_id)
            .filter(opioid_filter)
        )
        records_all = q_all.all()
        all_time_patient_ids = {r.patient_id for r in records_all if r.patient_id}

        return {
            "period": period,
            "labels": labels,
            "data": [by_bucket.get(lbl, 0) for lbl in labels],
            "patient_count": len(patient_ids),
            "dispensation_count": len(records),
            "all_time_patient_count": len(all_time_patient_ids),
            "all_time_dispensation_count": len(records_all),
            "note": (
                "Detected via narcotic=true, WHO ATC N02A*, or curated keyword "
                "match on medicine name. Refine the catalog (set narcotic=true "
                "on opioid SKUs) for precision."
            ),
        }

    # ---------- D3 — Telemedicine consultations ----------------------------

    @staticmethod
    def telemedicine_timeline(start: date, end: date,
                              period: str = PERIOD_MONTHLY) -> dict:
        """Bucketed count of teleconsult sessions and UI documentation forms (video + voice).

        Includes:
        - TeleSession records (status in completed/in_progress/ringing)
        - TeleconsultDocumentation forms (submitted teleconsult SOP forms in UI)
        - PatientVisit records with visit_type='phone' or visit_location='phone'

        Uses the date of contact (visit_date / scheduled_at / started_at / created_at).
        """
        period = parse_period(period)
        labels = _build_bucket_skeleton(start, end, period)

        by_bucket: dict = defaultdict(int)
        video = voice = 0
        all_dates = []

        seen_session_ids = set()
        seen_visit_ids = set()

        # 1. TeleSession (video/voice calling sessions + documentation links)
        try:
            from app.teleconsult.models.tele_session import TeleSession
            from app.saranam.models.patient_visit import PatientVisit

            kept_statuses = {"completed", "in_progress", "ringing"}
            rows = (
                db.session.query(
                    TeleSession.id,
                    TeleSession.scheduled_at,
                    TeleSession.started_at,
                    TeleSession.created_at,
                    TeleSession.channel,
                    TeleSession.linked_visit_id,
                    PatientVisit.visit_date
                )
                .outerjoin(PatientVisit, TeleSession.linked_visit_id == PatientVisit.id)
                .filter(TeleSession.status.in_(kept_statuses))
                .all()
            )
            for sess_id, sch_at, started_at, created_at, channel, linked_visit_id, visit_date in rows:
                seen_session_ids.add(sess_id)
                if linked_visit_id:
                    seen_visit_ids.add(linked_visit_id)
                
                # Priority: visit_date (date of contact), then scheduled/started/created date
                ref = visit_date or sch_at or started_at or created_at
                if not ref:
                    continue
                d = ref.date() if isinstance(ref, datetime) else ref
                all_dates.append((d, channel))
                if channel == "video":
                    video += 1
                else:
                    voice += 1
        except Exception as e:
            logger.warning(f"Error querying TeleSession in telemedicine_timeline: {e}")

        # 2. TeleconsultDocumentation (Teleconsult Forms collected in UI not already counted via TeleSession)
        try:
            from app.teleconsult.models.teleconsult_documentation import TeleconsultDocumentation
            from app.teleconsult.models.tele_session import TeleSession
            from app.saranam.models.patient_visit import PatientVisit

            doc_rows = (
                db.session.query(
                    TeleconsultDocumentation.id,
                    TeleconsultDocumentation.session_id,
                    TeleconsultDocumentation.created_at,
                    PatientVisit.visit_date
                )
                .outerjoin(TeleSession, TeleconsultDocumentation.session_id == TeleSession.id)
                .outerjoin(PatientVisit, TeleSession.linked_visit_id == PatientVisit.id)
                .all()
            )
            for doc_id, sess_id, created_at, visit_date in doc_rows:
                if sess_id in seen_session_ids:
                    continue  # already counted in TeleSession step
                seen_session_ids.add(sess_id)
                ref = visit_date or created_at
                if not ref:
                    continue
                d = ref.date() if isinstance(ref, datetime) else ref
                all_dates.append((d, "voice"))
                voice += 1
        except Exception as e:
            logger.warning(f"Error querying TeleconsultDocumentation in telemedicine_timeline: {e}")

        # 3. PatientVisit (phone/teleconsult visits not already linked to a session)
        try:
            from app.saranam.models.patient_visit import PatientVisit
            visit_rows = (
                db.session.query(PatientVisit.id, PatientVisit.visit_date, PatientVisit.created_at)
                .filter(or_(PatientVisit.visit_type == 'phone', PatientVisit.visit_location == 'phone'))
                .all()
            )
            for v_id, v_date, created_at in visit_rows:
                if v_id in seen_visit_ids:
                    continue  # already counted via session
                seen_visit_ids.add(v_id)
                ref = v_date or created_at
                if not ref:
                    continue
                d = ref.date() if isinstance(ref, datetime) else ref
                all_dates.append((d, "voice"))
                voice += 1
        except Exception as e:
            logger.warning(f"Error querying PatientVisit in telemedicine_timeline: {e}")

        # Bucket all records within [start, end]
        for d, _chan in all_dates:
            if start <= d <= end:
                by_bucket[_bucket_label(d, period)] += 1

        return {
            "period": period,
            "labels": labels,
            "data": [by_bucket.get(lbl, 0) for lbl in labels],
            "total": sum(by_bucket.values()),
            "all_time_total": len(all_dates),
            "video_count": video,
            "voice_count": voice,
        }

    @staticmethod
    def telemedicine_summary(start: date, end: date, period: str = PERIOD_MONTHLY, patient_status: str = None) -> dict:
        """Comprehensive teleconsultation analytics from UI forms & sessions.

        Calculates breakdown by consultation_type (Nurse/Doctor/etc), call_type
        (Follow-up/Condolence/etc), call_direction, who_answered, and severity.
        """
        timeline_data = DonorMetricsService.telemedicine_timeline(start, end, period)
        
        consultation_types = defaultdict(int)
        call_types = defaultdict(int)
        call_directions = defaultdict(int)
        who_answered_map = defaultdict(int)
        severity_map = defaultdict(int)
        total_forms = 0

        try:
            from app.teleconsult.models.teleconsult_documentation import TeleconsultDocumentation
            from app.teleconsult.models.tele_session import TeleSession
            from app.saranam.models.patient_visit import PatientVisit
            from app.patients.models import Patient

            query = (
                db.session.query(
                    TeleconsultDocumentation.consultation_type,
                    TeleconsultDocumentation.call_type,
                    TeleconsultDocumentation.call_direction,
                    TeleconsultDocumentation.who_answered,
                    TeleconsultDocumentation.severity,
                    TeleconsultDocumentation.created_at,
                    PatientVisit.visit_date,
                    PatientVisit.doctor_consultation,
                    PatientVisit.nursing_consultation,
                    PatientVisit.counsellor_consultation,
                    PatientVisit.physiotherapy_consultation,
                    PatientVisit.social_worker_consultation
                )
                .outerjoin(TeleSession, TeleconsultDocumentation.session_id == TeleSession.id)
                .outerjoin(PatientVisit, TeleSession.linked_visit_id == PatientVisit.id)
                .outerjoin(Patient, TeleSession.patient_id == Patient.id)
            )

            if patient_status and patient_status != 'all':
                if patient_status == 'active':
                    query = query.filter(Patient.is_active == True, Patient.is_deceased == False, Patient.care_status == 'active')
                elif patient_status == 'inactive':
                    query = query.filter(Patient.is_active == True, Patient.is_deceased == False, Patient.care_status == 'inactive')
                elif patient_status == 'deceased':
                    query = query.filter(Patient.is_deceased == True)

            docs = query.all()

            for c_type, c_call_type, c_dir, who_ans, sev, created_at, visit_date, doc_c, nurse_c, couns_c, phys_c, soc_c in docs:
                ref = visit_date or created_at
                if ref:
                    d = ref.date() if isinstance(ref, datetime) else ref
                    if start and end and not (start <= d <= end):
                        continue

                total_forms += 1

                has_flags = any([doc_c, nurse_c, couns_c, phys_c, soc_c])
                if has_flags:
                    if doc_c: consultation_types["Doctor"] += 1
                    if nurse_c: consultation_types["Nurse"] += 1
                    if couns_c: consultation_types["Counsellor"] += 1
                    if phys_c: consultation_types["Physiotherapist"] += 1
                    if soc_c: consultation_types["Social Worker"] += 1
                else:
                    c_type_label = c_type.strip().title() if c_type else "Nurse"
                    consultation_types[c_type_label] += 1

                call_type_label = c_call_type.strip().title() if c_call_type else "Follow-up"
                call_types[call_type_label] += 1

                direction_label = c_dir.strip().title() if c_dir else "Outgoing Call"
                call_directions[direction_label] += 1

                ans_label = (who_ans or "patient").replace("_", " ").title()
                who_answered_map[ans_label] += 1

                sev_label = (sev or "low").capitalize()
                severity_map[sev_label] += 1

        except Exception as e:
            logger.warning(f"Error querying TeleconsultDocumentation summary: {e}")

        # Format breakdowns as list of objects for Recharts
        c_type_breakdown = [{'name': k, 'value': v} for k, v in consultation_types.items()]
        call_type_breakdown = [{'name': k, 'value': v} for k, v in call_types.items()]
        call_direction_breakdown = [{'name': k, 'value': v} for k, v in call_directions.items()]
        who_answered_breakdown = [{'name': k, 'value': v} for k, v in who_answered_map.items()]
        severity_breakdown = [{'name': k, 'value': v} for k, v in severity_map.items()]

        return {
            "summary": {
                "total_teleconsults": timeline_data.get("total", total_forms),
                "nurse_consults": consultation_types.get("Nurse", 0),
                "doctor_consults": consultation_types.get("Doctor", 0),
                "counsellor_consults": consultation_types.get("Counsellor", 0),
                "physio_consults": consultation_types.get("Physiotherapist", 0),
                "other_consults": sum(v for k, v in consultation_types.items() if k not in ["Nurse", "Doctor", "Counsellor", "Physiotherapist"])
            },
            "consultation_type_breakdown": c_type_breakdown,
            "call_type_breakdown": call_type_breakdown,
            "call_direction_breakdown": call_direction_breakdown,
            "who_answered_breakdown": who_answered_breakdown,
            "severity_breakdown": severity_breakdown,
            "timeline": timeline_data
        }

    # ---------- D2 — Multi-disciplinary participation ----------------------

    @staticmethod
    def multidisciplinary_participation(start: date, end: date) -> dict:
        """Average distinct team-member roles per home visit in the period.

        A multi-disciplinary visit (≥2 roles) is a quality marker — it shows
        the patient got integrated care rather than a single-discipline touch.
        """
        def _calc(r_list):
            total_visits = len(r_list)
            role_counts = []
            multidisciplinary_visits = 0
            visits_with_data = 0
            for (members,) in r_list:
                if not members or not isinstance(members, list):
                    continue
                roles = {(m or {}).get("role", "").lower() for m in members}
                roles.discard("")
                if not roles:
                    continue
                visits_with_data += 1
                role_counts.append(len(roles))
                if len(roles) >= 2:
                    multidisciplinary_visits += 1

            avg_roles = (sum(role_counts) / len(role_counts)) if role_counts else 0
            multi_pct = (multidisciplinary_visits / visits_with_data * 100) if visits_with_data else 0
            return {
                "total_home_visits": total_visits,
                "visits_with_team_data": visits_with_data,
                "multidisciplinary_visits": multidisciplinary_visits,
                "multidisciplinary_pct": round(multi_pct, 1),
                "avg_roles_per_visit": round(avg_roles, 2),
            }

        rows = (
            DonorMetricsService._completed_visits_query(start, end, "home")
            .with_entities(PatientVisit.team_members)
            .all()
        )
        rows_all = (
            DonorMetricsService._completed_visits_query(date(1970, 1, 1), date(3000, 12, 31), "home")
            .with_entities(PatientVisit.team_members)
            .all()
        )

        res = _calc(rows)
        all_time_res = _calc(rows_all)
        res["all_time_multidisciplinary_pct"] = all_time_res["multidisciplinary_pct"]
        res["all_time_avg_roles_per_visit"] = all_time_res["avg_roles_per_visit"]
        return res

    # ---------- Follow-ups — patients who got follow-up visits --------------

    @staticmethod
    def followups(start: date, end: date,
                  period: str = PERIOD_MONTHLY) -> dict:
        """How many patients got follow-up visits in the period.

        Reports: distinct patient count, total follow-up visit count, plus a
        timeline of follow-up visits bucketed by `period`.
        """
        period = parse_period(period)
        labels = _build_bucket_skeleton(start, end, period)

        rows = (
            db.session.query(PatientVisit.patient_id, PatientVisit.visit_date)
            .filter(PatientVisit.status == "completed")
            .filter(PatientVisit.visit_type == "follow_up")
            .filter(PatientVisit.visit_date >= start)
            .filter(PatientVisit.visit_date <= end)
            .all()
        )

        patient_set = set()
        by_bucket: dict = defaultdict(int)
        for patient_id, visit_date_ in rows:
            if visit_date_:
                by_bucket[_bucket_label(visit_date_, period)] += 1
            patient_set.add(patient_id)

        return {
            "period": period,
            "labels": labels,
            "data": [by_bucket.get(lbl, 0) for lbl in labels],
            "patients_with_followups": len(patient_set),
            "total_followup_visits": len(rows),
        }

    # ---------- B2 — Place-of-death zone-wise -------------------------------

    @staticmethod
    def place_of_death_by_zone(start: date, end: date) -> dict:
        """Deceased patients grouped by (geographic_cluster, place_of_death).

        Returns a matrix-friendly shape:
          {
            zones: ['Central', 'East', 'North', 'South', 'West', 'Other'],
            places: ['home', 'hospital', 'in_transit', 'unknown'],
            matrix: [[zone × place counts]],
            totals_by_zone:  [...],
            totals_by_place: [...],
            grand_total: int
          }
        """
        rows = (
            db.session.query(Patient.geographic_cluster, Patient.place_of_death)
            .filter(Patient.is_deceased.is_(True))
            .filter(Patient.date_of_death.isnot(None))
            .filter(Patient.date_of_death >= start)
            .filter(Patient.date_of_death <= end)
            .all()
        )

        # Canonical orderings
        canonical_zones = ["Central", "East", "North", "South", "West"]
        canonical_places = ["home", "hospital", "in_transit"]

        cell: dict = defaultdict(int)
        seen_zones: set = set()
        seen_places: set = set()
        for zone, place in rows:
            z = (zone or "Unknown").strip() or "Unknown"
            p = (place or "unknown").strip().lower() or "unknown"
            cell[(z, p)] += 1
            seen_zones.add(z)
            seen_places.add(p)

        zones = [z for z in canonical_zones if z in seen_zones]
        for z in sorted(seen_zones):
            if z not in zones:
                zones.append(z)

        places = [p for p in canonical_places if p in seen_places]
        for p in sorted(seen_places):
            if p not in places:
                places.append(p)

        matrix = [[cell.get((z, p), 0) for p in places] for z in zones]
        totals_by_zone = [sum(row) for row in matrix]
        totals_by_place = [sum(matrix[i][j] for i in range(len(zones)))
                           for j in range(len(places))]

        return {
            "zones": zones,
            "places": places,
            "matrix": matrix,
            "totals_by_zone": totals_by_zone,
            "totals_by_place": totals_by_place,
            "grand_total": sum(totals_by_zone),
        }

    # ---------- Loss-to-follow-up alert -------------------------------------

    @staticmethod
    def loss_to_followup(threshold_days: int = 60, limit: int = 50,
                          start_date: Optional[date] = None,
                          end_date: Optional[date] = None) -> dict:
        """Active, alive patients with no completed visit in the last N days.

        Catches silent drop-offs the team would otherwise miss until quarterly
        review. In palliative care this is also a clinical signal — patients
        lost to follow-up often died at home unrecorded.
        """
        if threshold_days < 1:
            threshold_days = 60

        anchor_date = end_date or date.today()
        cutoff = anchor_date - timedelta(days=threshold_days)

        # Subquery: latest completed visit_date per active patient prior to or equal to anchor_date
        latest = (
            db.session.query(
                PatientVisit.patient_id.label("patient_id"),
                func.max(PatientVisit.visit_date).label("last_visit"),
            )
            .filter(PatientVisit.status == "completed")
            .filter(PatientVisit.visit_date <= anchor_date)
            .group_by(PatientVisit.patient_id)
            .subquery()
        )

        rows = (
            db.session.query(
                Patient.id, Patient.full_name, Patient.geographic_cluster,
                Patient.uhid, latest.c.last_visit,
            )
            .outerjoin(latest, latest.c.patient_id == Patient.id)
            .filter(Patient.created_at <= datetime.combine(anchor_date, datetime.max.time()))
            .filter(Patient.is_active.is_(True))
            .filter(
                or_(
                    Patient.is_deceased.is_(False),
                    Patient.date_of_death > anchor_date
                )
            )
            .filter(
                or_(
                    latest.c.last_visit.is_(None),
                    latest.c.last_visit < cutoff,
                )
            )
            .order_by(latest.c.last_visit.asc().nullsfirst())
            .all()
        )

        items = []
        for pid, name, cluster, uhid, last_visit in rows[:limit]:
            days = (anchor_date - last_visit).days if last_visit else None
            items.append({
                "patient_id": str(pid),
                "name": name or "(unnamed)",
                "uhid": uhid,
                "zone": cluster or "—",
                "last_visit": last_visit.isoformat() if last_visit else None,
                "days_since": days,
                "never_visited": last_visit is None,
            })

        # Buckets for the StatCard footer
        bucket_60_90 = sum(1 for r in rows if r.last_visit and (anchor_date - r.last_visit).days < 91)
        bucket_91_180 = sum(1 for r in rows if r.last_visit and 91 <= (anchor_date - r.last_visit).days < 181)
        bucket_180_plus = sum(1 for r in rows if r.last_visit and (anchor_date - r.last_visit).days >= 181)
        never = sum(1 for r in rows if r.last_visit is None)

        # All-time calculation (relative to today)
        today = date.today()
        latest_all = (
            db.session.query(
                PatientVisit.patient_id.label("patient_id"),
                func.max(PatientVisit.visit_date).label("last_visit"),
            )
            .filter(PatientVisit.status == "completed")
            .filter(PatientVisit.visit_date <= today)
            .group_by(PatientVisit.patient_id)
            .subquery()
        )
        cutoff_today = today - timedelta(days=threshold_days)
        all_time_count = (
            db.session.query(func.count(Patient.id))
            .outerjoin(latest_all, latest_all.c.patient_id == Patient.id)
            .filter(Patient.created_at <= datetime.combine(today, datetime.max.time()))
            .filter(Patient.is_active.is_(True))
            .filter(
                or_(
                    Patient.is_deceased.is_(False),
                    Patient.date_of_death > today
                )
            )
            .filter(
                or_(
                    latest_all.c.last_visit.is_(None),
                    latest_all.c.last_visit < cutoff_today,
                )
            )
            .scalar() or 0
        )

        return {
            "threshold_days": threshold_days,
            "total_count": len(rows),
            "all_time_total": all_time_count,
            "buckets": {
                f"{threshold_days}-90_days": bucket_60_90,
                "91-180_days": bucket_91_180,
                "180+_days": bucket_180_plus,
                "never_visited": never,
            },
            "items": items,
            "limit": limit,
        }

    # ---------- Vehicle utilization -----------------------------------------

    @staticmethod
    def vehicle_utilization(start: date, end: date,
                            target_slots_per_week: int = 25) -> dict:
        """Scheduled-slot count per vehicle per ISO-week + utilization %.
        Only counts slots for days where a run log (VehicleLog) was submitted
        indicating the vehicle was actually out.

        target_slots_per_week is a configurable benchmark (default 25 slots/week
        ≈ 5 slots/day × 5 days). Override via env ANALYTICS_TARGET_SLOTS_PER_WEEK.
        """
        try:
            target_env = os.getenv("ANALYTICS_TARGET_SLOTS_PER_WEEK")
            if target_env:
                target_slots_per_week = int(target_env)
        except ValueError:
            pass

        from app.saranam.models.schedule_day import ScheduleDay
        from app.saranam.models.schedule_slot import ScheduleSlot
        from app.saranam.models.vehicle import Vehicle
        from app.saranam.models.vehicle_log import VehicleLog

        # Pre-populate with all active vehicles in the database
        active_vehicles = Vehicle.query.filter(Vehicle.is_active == True).all()
        by_vehicle: dict = {}
        for v in active_vehicles:
            by_vehicle[str(v.id)] = {
                "name": v.name,
                "registration": v.registration_number,
                "weeks": defaultdict(int),
            }

        # Query slots that have an associated vehicle log (meaning run was logged/occurred)
        rows = (
            db.session.query(
                ScheduleSlot.vehicle_id,
                Vehicle.name,
                Vehicle.registration_number,
                ScheduleDay.date,
            )
            .join(ScheduleDay, ScheduleSlot.schedule_day_id == ScheduleDay.id)
            .join(Vehicle, Vehicle.id == ScheduleSlot.vehicle_id)
            .join(VehicleLog, and_(
                VehicleLog.vehicle_id == ScheduleSlot.vehicle_id,
                VehicleLog.schedule_day_id == ScheduleDay.id
            ))
            .filter(ScheduleDay.date >= start)
            .filter(ScheduleDay.date <= end)
            .filter(ScheduleSlot.status != "cancelled")
            .all()
        )

        for vid, vname, vreg, d in rows:
            if not vid:
                continue
            key = str(vid)
            if key not in by_vehicle:
                by_vehicle[key] = {
                    "name": vname or f"Vehicle {key[:8]}",
                    "registration": vreg,
                    "weeks": defaultdict(int),
                }
            entry = by_vehicle[key]
            week_monday = d - timedelta(days=d.weekday())
            entry["weeks"][week_monday] += 1

        # Build inclusive week label skeleton
        first_monday = start - timedelta(days=start.weekday())
        last_monday = end - timedelta(days=end.weekday())
        week_labels: List[str] = []
        cursor = first_monday
        while cursor <= last_monday:
            week_labels.append(cursor.isoformat())
            cursor += timedelta(weeks=1)

        vehicles_out = []
        for key, entry in by_vehicle.items():
            data = [entry["weeks"].get(date.fromisoformat(lbl), 0)
                    for lbl in week_labels]
            total_slots = sum(data)
            weeks_used = sum(1 for n in data if n > 0)
            avg_per_week = (total_slots / weeks_used) if weeks_used else 0
            utilization = (avg_per_week / target_slots_per_week * 100) if target_slots_per_week else 0
            vehicles_out.append({
                "vehicle_id": key,
                "name": entry["name"],
                "registration": entry["registration"],
                "weeks": week_labels,
                "slots_per_week": data,
                "total_slots": total_slots,
                "avg_slots_per_active_week": round(avg_per_week, 1),
                "utilization_pct": round(utilization, 1),
            })

        # Sort by total descending
        vehicles_out.sort(key=lambda v: v["total_slots"], reverse=True)

        return {
            "target_slots_per_week": target_slots_per_week,
            "weeks": week_labels,
            "vehicles": vehicles_out,
            "fleet_total_slots": sum(v["total_slots"] for v in vehicles_out),
        }

    # ---------- Home-care calendar (per 2026-05-13 client meeting) ----------
    #
    # Saranam's clinical team runs home visits on a fixed weekday cadence —
    # 4 days per week. Farzan: "8 home-care days = 2 calendar weeks because
    # each week has 4 home-care days." All "X home-care days" metrics use the
    # helper below so the calendar is honest about non-operating days.
    #
    # Override via env SARANAM_HOMECARE_WEEKDAYS as a comma-separated list of
    # ISO weekday numbers (0=Mon..6=Sun). Default: Mon–Thu = [0,1,2,3].

    @staticmethod
    def _homecare_weekdays() -> Set[int]:
        raw = os.getenv("SARANAM_HOMECARE_WEEKDAYS")
        if not raw:
            return {0, 1, 2, 3}
        out: Set[int] = set()
        for chunk in raw.split(","):
            chunk = chunk.strip()
            if not chunk:
                continue
            try:
                v = int(chunk)
                if 0 <= v <= 6:
                    out.add(v)
            except ValueError:
                continue
        return out or {0, 1, 2, 3}

    @staticmethod
    def _count_homecare_days_between(start_excl: date, end_incl: date) -> int:
        """Home-care days in (start_excl, end_incl]. Same-day returns 0."""
        if end_incl <= start_excl:
            return 0
        hc = DonorMetricsService._homecare_weekdays()
        count = 0
        cursor = start_excl + timedelta(days=1)
        while cursor <= end_incl:
            if cursor.weekday() in hc:
                count += 1
            cursor += timedelta(days=1)
        return count

    # ---------- Registration → First-visit time -----------------------------
    #
    # Cohort = patients whose FIRST completed visit (any location) falls in
    # the window. We measure how many home-care days passed between their
    # registration (Patient.created_at) and that first visit. Target = ≤ 8
    # home-care days per the 2026-05-13 meeting; configurable via param.

    @staticmethod
    def registration_to_first_visit(start: date, end: date,
                                    target_homecare_days: int = 8) -> dict:
        # Subquery: every patient's first completed visit (any location)
        first_visit = (
            db.session.query(
                PatientVisit.patient_id.label("patient_id"),
                func.min(PatientVisit.visit_date).label("first_visit_date"),
            )
            .filter(PatientVisit.status == "completed")
            .group_by(PatientVisit.patient_id)
            .subquery()
        )

        rows = (
            db.session.query(
                Patient.id, Patient.created_at, first_visit.c.first_visit_date,
            )
            .join(first_visit, first_visit.c.patient_id == Patient.id)
            .filter(first_visit.c.first_visit_date >= start)
            .filter(first_visit.c.first_visit_date <= end)
            .filter(Patient.created_at.isnot(None))
            .all()
        )

        hc_days_list: List[int] = []
        within = outside = 0
        # Distribution buckets keyed to the 8-HC-day target
        buckets = [
            ("0 HC-days",  0,  0),
            ("1–2",        1,  2),
            ("3–4",        3,  4),
            ("5–6",        5,  6),
            ("7–8",        7,  8),
            ("9–12",       9, 12),
            ("13–20",     13, 20),
            ("21+",       21, 10**6),
        ]
        bucket_counts = [0] * len(buckets)

        for _pid, created_at, first_visit_date in rows:
            reg_day = (created_at.date()
                       if isinstance(created_at, datetime) else created_at)
            if not reg_day or not first_visit_date:
                continue
            if first_visit_date < reg_day:
                continue  # bad data — visit before registration
            hc = DonorMetricsService._count_homecare_days_between(
                reg_day, first_visit_date)
            hc_days_list.append(hc)
            if hc <= target_homecare_days:
                within += 1
            else:
                outside += 1
            for i, (_label, lo, hi) in enumerate(buckets):
                if lo <= hc <= hi:
                    bucket_counts[i] += 1
                    break

        hc_days_list.sort()
        n = len(hc_days_list)

        def _q(p: float) -> int:
            if n == 0:
                return 0
            idx = max(0, min(n - 1, int(round((n - 1) * p))))
            return hc_days_list[idx]

        within_pct = round(within / n * 100, 1) if n else 0.0

        return {
            "range": {"start": start.isoformat(), "end": end.isoformat()},
            "target_homecare_days": target_homecare_days,
            "homecare_weekdays": sorted(DonorMetricsService._homecare_weekdays()),
            "cohort_size": n,
            "within_target": within,
            "outside_target": outside,
            "within_target_pct": within_pct,
            "median_homecare_days": _q(0.5),
            "p90_homecare_days": _q(0.9),
            "distribution": {
                "labels": [b[0] for b in buckets],
                "data": bucket_counts,
            },
            "note": (
                "Cohort = patients whose first completed visit fell in this "
                "window. Days counted only on configured home-care weekdays "
                "(default Mon–Thu, override via SARANAM_HOMECARE_WEEKDAYS)."
            ),
        }

    # ---------- Time from enrollment to death (histogram) -------------------

    @staticmethod
    def enrollment_to_death(start: date, end: date, start_event: str = 'registration', age_group: Optional[str] = None) -> dict:
        """Distribution of days from a start event to death.
        - 'registration': from Patient.registration_date (coalesced with created_at) to death.
        - 'initial_visit': from the first completed visit of type 'initial' to death.

        Used to flag late-referral patterns. Indian palliative oncology is
        notorious for last-fortnight referrals — a heavy left tail in this
        chart is a referrer-education issue worth surfacing to Dr. Ashwini.
        """
        if start_event == 'initial_visit':
            from app.saranam.models.patient_visit import PatientVisit
            # Subquery to find the first completed visit of type 'initial' per patient
            first_initial_visit = (
                db.session.query(
                    PatientVisit.patient_id.label("patient_id"),
                    func.min(PatientVisit.visit_date).label("first_visit_date")
                )
                .filter(PatientVisit.status == "completed")
                .filter(PatientVisit.visit_type == "initial")
                .group_by(PatientVisit.patient_id)
                .subquery()
            )

            rows = (
                db.session.query(first_initial_visit.c.first_visit_date, Patient.date_of_death, Patient.date_of_birth)
                .join(first_initial_visit, first_initial_visit.c.patient_id == Patient.id)
                .filter(Patient.is_deceased.is_(True))
                .filter(Patient.date_of_death.isnot(None))
                .filter(Patient.date_of_death >= start)
                .filter(Patient.date_of_death <= end)
                .all()
            )
        else:
            rows = (
                db.session.query(
                    func.coalesce(Patient.registration_date, func.cast(Patient.created_at, db.Date)),
                    Patient.date_of_death,
                    Patient.date_of_birth
                )
                .filter(Patient.is_deceased.is_(True))
                .filter(Patient.date_of_death.isnot(None))
                .filter(Patient.date_of_death >= start)
                .filter(Patient.date_of_death <= end)
                .all()
            )

        # Bin into clinically-meaningful buckets
        buckets = [
            ("0–7 days",     0,    7,    "Referred too late"),
            ("8–30 days",    8,    30,   "Acute palliation"),
            ("31–90 days",   31,   90,   "Short-course"),
            ("91–180 days",  91,   180,  "Mid-course"),
            ("181–365 days", 181,  365,  "Long-course"),
            ("365+ days",    366,  10**6, "Multi-year"),
        ]
        bucket_counts = [0] * len(buckets)
        days_list: List[int] = []

        today_date = date.today()
        for start_date, dod, dob in rows:
            if age_group and age_group != 'all':
                if dob is None:
                    p_age_grp = 'unknown'
                else:
                    age = today_date.year - dob.year - ((today_date.month, today_date.day) < (dob.month, dob.day))
                    if age < 0:
                        p_age_grp = 'unknown'
                    elif age < 19:
                        p_age_grp = 'child_adolescent'
                    elif age < 60:
                        p_age_grp = 'adults'
                    else:
                        p_age_grp = 'older_adults'

                if p_age_grp != age_group:
                    continue

            start_day = start_date.date() if isinstance(start_date, datetime) else start_date
            if not start_day or not dod:
                continue
            days = (dod - start_day).days
            if days < 0:
                continue  # bad data — death before start event
            days_list.append(days)
            for i, (label, lo, hi, desc) in enumerate(buckets):
                if lo <= days <= hi:
                    bucket_counts[i] += 1
                    break

        # Median + IQR
        days_list.sort()
        n = len(days_list)
        def _q(p):
            if n == 0:
                return 0
            idx = max(0, min(n - 1, int(round((n - 1) * p))))
            return days_list[idx]
        median = _q(0.5)
        q1 = _q(0.25)
        q3 = _q(0.75)
        late_referral_count = bucket_counts[0]  # 0-7 days
        late_referral_pct = round(late_referral_count / n * 100, 1) if n else 0

        return {
            "labels": [b[0] for b in buckets],
            "descriptions": [b[3] for b in buckets],
            "data": bucket_counts,
            "total_deceased_with_enrollment": n,
            "median_days_in_care": median,
            "q1_days_in_care": q1,
            "q3_days_in_care": q3,
            "late_referral_count": late_referral_count,
            "late_referral_pct": late_referral_pct,
        }
