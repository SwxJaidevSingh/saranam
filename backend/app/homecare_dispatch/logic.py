"""Homecare dispatch scheduling rules (pure functions, no database access).

A 1:1 port of the Saranam Streamlit dispatch console
(``pages/scheduling/service.py``, ``pages/scheduling/boundary_analyzer.py`` and
the rules embedded in ``pages/scheduling/ui.py``). Behaviour — including the
quirks — intentionally matches the Streamlit app so both consoles produce the
same schedules against the shared ``daily_vehicle_schedules`` table.
"""
import copy
import json
import os
from datetime import date, datetime, time as dt_time, timedelta, timezone
from functools import lru_cache
from math import atan2, atanh, cos, cosh, radians, sin, sinh, sqrt
from typing import Any, Dict, List, Optional, Tuple

import requests

DATE_FMT = "%Y-%m-%d"
DEFAULT_HOMECARE_WEEKDAYS = {0, 1, 3, 4}
DEFAULT_WEEKDAY_NAMES = ["Monday", "Tuesday", "Thursday", "Friday"]

DAY_MAP = {
    "Monday": 0,
    "Tuesday": 1,
    "Wednesday": 2,
    "Thursday": 3,
    "Friday": 4,
    "Saturday": 5,
    "Sunday": 6,
}

PRIORITY_TIERS = {"Emergency": 1, "Urgent": 2, "High": 3, "New": 4, "Medium": 5, "Low": 6}


def _parse_date(s: Optional[Any]) -> Optional[date]:
    try:
        if not s:
            return None
        if isinstance(s, datetime):
            return s.date()
        if isinstance(s, date):
            return s
        s_str = str(s).strip()
        if not s_str:
            return None
        return datetime.strptime(s_str[:10], DATE_FMT).date()
    except (ValueError, TypeError):
        return None


def weekdays_set_from_config(config: Dict[str, Any]) -> set:
    weekdays_list = config.get("homecare_weekdays", DEFAULT_WEEKDAY_NAMES)
    return {DAY_MAP[d] for d in weekdays_list if d in DAY_MAP}


def homecare_days_string(config: Dict[str, Any]) -> str:
    weekdays_list = config.get("homecare_weekdays", DEFAULT_WEEKDAY_NAMES)
    return ", ".join(weekdays_list) if isinstance(weekdays_list, list) else str(weekdays_list)


def count_homecare_days(start_date: date, end_date: date, weekdays_set: Optional[set] = None) -> int:
    """Count elapsed operational homecare days between start_date and end_date.

    Excludes unselected weekdays from the elapsed gap calculation.
    """
    if weekdays_set is None:
        weekdays_set = DEFAULT_HOMECARE_WEEKDAYS

    if not isinstance(start_date, date) or not isinstance(end_date, date):
        return 0
    if start_date >= end_date:
        return 0

    count = 0
    current = start_date + timedelta(days=1)
    while current <= end_date:
        if current.weekday() in weekdays_set:
            count += 1
        current += timedelta(days=1)
    return count


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    try:
        lat1, lon1, lat2, lon2 = map(float, (lat1, lon1, lat2, lon2))
        lat1, lon1, lat2, lon2 = map(radians, (lat1, lon1, lat2, lon2))
        dlat, dlon = lat2 - lat1, lon2 - lon1
        a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
        a = min(1.0, max(0.0, a))
        return 2 * R * atan2(sqrt(a), sqrt(1 - a))
    except (TypeError, ValueError):
        return 0.0


def safe_coord(val) -> Optional[float]:
    """Treat missing values and Null Island (0.0) as no coordinate."""
    if val is None:
        return None
    try:
        f = float(val)
        if abs(f) <= 0.0001:
            return None
        return f
    except (ValueError, TypeError):
        return None


def extract_lat_lon(ext_meta: Any) -> Tuple[Optional[float], Optional[float]]:
    """Read coordinates from a patient's external_metadata the way Streamlit does."""
    ext = ext_meta or {}
    if isinstance(ext, str):
        try:
            ext = json.loads(ext)
        except Exception:
            ext = {}
    lat = ext.get("latitude") or ext.get("lat")
    lon = ext.get("longitude") or ext.get("lon") or ext.get("lng")
    return safe_coord(lat), safe_coord(lon)


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def score_patient(
    patient: Dict[str, Any],
    config: Dict[str, Any],
    today: date,
    weekdays_set: Optional[set] = None,
    timeline_bookings: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """Compute tier rank, priority, reference date, elapsed homecare days (gap),
    SLA, priority-weighted urgency score, and overdue flag for one patient.
    Considers earlier active or unexpired draft bookings on the calendar timeline.
    """
    p = copy.deepcopy(patient)
    sla_map = {
        "Emergency": config.get("Emergency", 1),
        "Urgent": config.get("Urgent", 1),
        "High": config.get("High", 4),
        "Medium": config.get("Medium", 8),
        "Low": config.get("Low", 16),
        "New": config.get("New", 4),
    }

    p_type = p.get("type") or "existing"
    p_priority = p.get("priority") or "Medium"

    if p_type == "new":
        if p_priority in ("Emergency", "Urgent"):
            sla_days = sla_map[p_priority]
        else:
            # Ordinary new patients have no priority of their own - they get
            # their own "New" bucket and use the New SLA config.
            p_priority = "New"
            sla_days = sla_map["New"]
        reference = _parse_date(p.get("registration_date"))
    else:
        reference = _parse_date(p.get("last_visit_date"))
        sla_days = sla_map.get(p_priority, config.get("High", 4))

    reference = reference or today

    # Check timeline bookings (drafts, active, or earlier schedules)
    future_bookings = []
    earlier_bookings = []
    is_booked_on_today = False
    if timeline_bookings:
        for b in timeline_bookings:
            b_dt = b.get("schedule_date")
            if b_dt == today:
                is_booked_on_today = True
            elif b_dt < today:
                earlier_bookings.append(b)
                if reference is None or b_dt > reference:
                    reference = b_dt
                    if p_type == "new":
                        p_type = "existing"
                        p_priority = patient.get("priority") or "Medium"
                        sla_days = sla_map.get(p_priority, config.get("High", 4))
            elif b_dt > today:
                future_bookings.append(b)

    gap = count_homecare_days(reference, today, weekdays_set)

    weights_map = {
        "Emergency": config.get("weight_Emergency", 150),
        "Urgent": config.get("weight_Urgent", 125),
        "High": config.get("weight_High", 100),
        "New": config.get("weight_New", 75),
        "Medium": config.get("weight_Medium", 50),
        "Low": config.get("weight_Low", 25),
    }

    if p_priority == "Emergency":
        weight_P = weights_map["Emergency"]
    elif p_priority == "Urgent":
        weight_P = weights_map["Urgent"]
    elif p_priority == "New":
        weight_P = weights_map["New"]
    else:
        weight_P = weights_map.get(p_priority, weights_map["Medium"])

    if gap == 0:
        priority_score = 0.0
    else:
        s_days = max(1, sla_days)
        priority_score = 0.9 * weight_P + 0.1 * (gap / s_days)

    p["tier_rank"] = PRIORITY_TIERS.get(p_priority, 6)

    p["priority"] = p_priority
    p["type"] = p_type
    p["reference_date"] = reference.strftime(DATE_FMT)
    p["days_elapsed"] = gap
    p["gap_days"] = gap
    p["sla_days"] = sla_days
    p["urgency_score"] = round(priority_score, 3)
    p["overdue"] = gap > sla_days
    p["earlier_bookings"] = earlier_bookings
    p["future_bookings"] = future_bookings
    p["is_booked_on_today"] = is_booked_on_today
    return p


def urgency_sort_key(p: Dict[str, Any]):
    """Tier first, then highest urgency, then overdue, then oldest reference date."""
    return (
        p.get("tier_rank", 5),
        -p.get("urgency_score", 0.0),
        0 if p.get("overdue") else 1,
        p.get("reference_date", ""),
    )


# ---------------------------------------------------------------------------
# Auto-draft
# ---------------------------------------------------------------------------

def _pool_distance_km(
    patient: Dict[str, Any],
    vehicle: Dict[str, Any],
    pool: List[Dict[str, Any]]
) -> Optional[float]:
    """Distance (km) from a candidate patient to a vehicle's current pool of
    already-assigned patients: the nearest patient already in the pool, or
    the vehicle's depot if the pool is empty (or has no usable coordinates).

    Returns None if the candidate patient itself has no coordinates, since no
    distance comparison is possible in that case.
    """
    p_lat, p_lon = patient.get("lat"), patient.get("lon")
    if p_lat is None or p_lon is None:
        return None

    pool_coords = [
        (ep.get("lat"), ep.get("lon"))
        for ep in pool
        if ep.get("lat") is not None and ep.get("lon") is not None
    ]
    if not pool_coords:
        return _haversine_km(p_lat, p_lon, vehicle["depot_lat"], vehicle["depot_lon"])

    return min(_haversine_km(p_lat, p_lon, lat, lon) for lat, lon in pool_coords)


def calculate_draft_schedule(
    all_patients,
    all_vehicles,
    schedule_date,
    weekdays_set,
    sla_config,
    timeline_bookings: Optional[Dict[str, List[Dict[str, Any]]]] = None
):
    """Generate default route drafts in memory based on priority queues and zone eligibility.
    Filters out patients whose urgency score is 0 (gap == 0) based on timeline.

    When more than one vehicle serves a patient's zone, the conflict is resolved
    by distance: the patient goes to whichever eligible vehicle is nearest (measured
    to the closest patient already in that vehicle's pool, or to the vehicle's depot
    if its pool is still empty). Patients are processed in urgency order, so the most
    urgent patients get first pick of the nearest vehicle.
    """
    if timeline_bookings is None:
        timeline_bookings = {}

    scored_patients = [
        score_patient(
            p,
            sla_config,
            schedule_date,
            weekdays_set,
            timeline_bookings=timeline_bookings.get(str(p["id"]))
        )
        for p in all_patients
        if not p.get("is_deceased")
    ]
    # Filter out patients who are not due (urgency score == 0)
    scored_patients = [p for p in scored_patients if p.get("urgency_score", 0.0) > 0]

    scored_patients = sorted(scored_patients, key=urgency_sort_key)

    vehicle_queues = {v["id"]: [] for v in all_vehicles}

    for p_scored in scored_patients:
        p_zone = str(p_scored.get("zone", "")).strip().upper()
        eligible_vehicles = [
            v for v in all_vehicles
            if p_zone in [str(z).strip().upper() for z in v.get("zones", [])]
        ]

        if not eligible_vehicles:
            continue  # no vehicle covers this zone; patient stays unassigned

        if len(eligible_vehicles) == 1:
            chosen = eligible_vehicles[0]
        else:
            # Multiple vehicles cover this zone - resolve the duplicate by nearest distance.
            distances = [
                (v, _pool_distance_km(p_scored, v, vehicle_queues[v["id"]]))
                for v in eligible_vehicles
            ]
            # If the patient has no coordinates, distance can't be judged for any
            # candidate - fall back to the first eligible vehicle rather than guessing.
            if any(d is None for _, d in distances):
                chosen = eligible_vehicles[0]
            else:
                chosen = min(distances, key=lambda t: t[1])[0]

        vehicle_queues[chosen["id"]].append(p_scored)

    draft_slots = []
    for v in all_vehicles:
        q = vehicle_queues[v["id"]]
        if not q:
            continue

        q_sorted = sorted(q, key=urgency_sort_key)

        for idx, p_scored in enumerate(q_sorted):
            draft_slots.append({
                "patient_id": p_scored["id"],
                "id": p_scored["id"],
                "name": p_scored["name"],
                "uhid": p_scored.get("uhid"),
                "hospital_uhid": p_scored.get("hospital_uhid"),
                "zone": p_scored["zone"],
                "lat": p_scored.get("lat") or v["depot_lat"],
                "lon": p_scored.get("lon") or v["depot_lon"],
                "vehicle_id": v["id"],
                "slot_order": idx + 1,
                "status": "pending",
                "priority_at_visit": p_scored["priority"],
                "patient_type_at_visit": p_scored["type"],
                "visit_type": "initial" if p_scored["type"] == "new" else "follow_up",
                "gap_days_at_visit": p_scored["gap_days"],
                "urgency_score_at_visit": p_scored["urgency_score"],
                "drive_distance_km": None,
                "drive_duration_min": None
            })

    return draft_slots


def apply_auto_draft(
    confirmed_slots_draft: List[Dict[str, Any]],
    suggested_slots: List[Dict[str, Any]],
    all_vehicles: List[Dict[str, Any]],
    sla_config: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """The planning board's "Auto-Draft Suggestions" action: replace every
    vehicle's alive-patient assignments with the suggestion, keeping any
    bereavement visits already on the board (they stay at the top of each run).
    """
    hc_days = homecare_days_string(sla_config)
    existing_bereav_all = [
        s for s in confirmed_slots_draft if s.get("visit_type") == "bereavement"
    ]
    new_draft = []
    for v in all_vehicles:
        v_sug = [
            {
                "patient_id": s["id"],
                "vehicle_id": s["vehicle_id"],
                "slot_order": 1,
                "priority": s["priority_at_visit"],
                "type": s["patient_type_at_visit"],
                "visit_type": "initial" if s["patient_type_at_visit"] == "new" else "follow_up",
                "gap": s["gap_days_at_visit"],
                "urgency": s["urgency_score_at_visit"],
                "homecare_days": hc_days,
                "sla_days": sla_config.get(s["priority_at_visit"], 4),
            }
            for s in suggested_slots if s["vehicle_id"] == v["id"]
        ]
        v_bereav = [dict(s) for s in existing_bereav_all if s["vehicle_id"] == v["id"]]
        v_combined = v_bereav + v_sug
        for idx, s in enumerate(v_combined, start=1):
            s["slot_order"] = idx
            new_draft.append(s)
    return new_draft


# ---------------------------------------------------------------------------
# Bereavement (deceased patients)
# ---------------------------------------------------------------------------

def parse_dod(p_obj: Dict[str, Any]) -> date:
    d = p_obj.get("date_of_death")
    if not d:
        return date.max
    if isinstance(d, str):
        try:
            return datetime.strptime(d[:10], DATE_FMT).date()
        except Exception:
            return date.max
    if isinstance(d, datetime):
        return d.date()
    return d


def bereavement_status(
    p: Dict[str, Any],
    schedule_date: date,
    timeline_bookings: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Whether a deceased patient's family was already visited/scheduled, and the status badge text."""
    p_bookings = timeline_bookings or []
    earlier_bookings = [b for b in p_bookings if b["schedule_date"] < schedule_date]
    future_bookings = [b for b in p_bookings if b["schedule_date"] > schedule_date]

    has_completed_visit = bool(p.get("has_completed_bereavement_visit") or (p.get("completed_bereavement_count") or 0) > 0)
    has_prior_db_schedule = bool((p.get("prior_bereavement_schedule_count") or 0) > 0)
    has_earlier_booking = bool(len(earlier_bookings) > 0)
    has_future_booking = bool(len(future_bookings) > 0)

    is_previously_addressed = (
        has_completed_visit or
        has_prior_db_schedule or
        has_earlier_booking or
        has_future_booking
    )

    if has_completed_visit:
        last_dt = p.get("last_bereavement_visit_date")
        b_status = f"✅ Visited ({p.get('completed_bereavement_count', 1)}x)"
        if last_dt:
            b_status += f" - {last_dt}"
        if has_future_booking:
            f_date = future_bookings[0]["schedule_date"].strftime("%d %b")
            b_status += f" | Next: {f_date}"
    elif has_earlier_booking or has_prior_db_schedule:
        if earlier_bookings:
            e_date = earlier_bookings[-1]["schedule_date"].strftime("%d %b")
        else:
            raw_e = p.get("last_prior_bereavement_schedule_date")
            e_date = raw_e.strftime("%d %b") if hasattr(raw_e, "strftime") else str(raw_e)
        b_status = f"📅 Prior Scheduled: {e_date}"
        if has_future_booking:
            f_date = future_bookings[0]["schedule_date"].strftime("%d %b")
            b_status += f" | Next: {f_date}"
    elif has_future_booking:
        f_date = future_bookings[0]["schedule_date"].strftime("%d %b")
        b_status = f"📅 Scheduled: {f_date}"
    else:
        b_status = "🕊️ Pending (Not Visited)"

    return {"is_previously_addressed": is_previously_addressed, "b_status": b_status}


def bereavement_sort_key(p: Dict[str, Any], meta: Dict[str, Any]):
    """Not-yet-visited families first, each group by earliest date of death."""
    return (
        1 if meta["is_previously_addressed"] else 0,
        parse_dod(p),
        p.get("name", ""),
    )


def bereavement_assignment(p: Dict[str, Any], vehicle_id: str, schedule_date: date, sla_config: Dict[str, Any]) -> Dict[str, Any]:
    """Planning-board slot for a bereavement visit (fixed Medium priority, urgency 0, SLA 4)."""
    dod = parse_dod(p)
    return {
        "patient_id": p["id"],
        "vehicle_id": vehicle_id,
        "slot_order": 1,
        "priority": "Medium",
        "type": "existing",
        "visit_type": "bereavement",
        "gap": (schedule_date - dod).days if dod != date.max else 0,
        "urgency": 0.0,
        "homecare_days": homecare_days_string(sla_config),
        "sla_days": 4,
    }


# ---------------------------------------------------------------------------
# Live dispatch: swap replacements and extra visits
# ---------------------------------------------------------------------------

def _zone_in_vehicle(p: Dict[str, Any], vehicle: Dict[str, Any]) -> bool:
    p_zone = str(p.get("zone", "")).strip().upper()
    return any(str(z).strip().upper() == p_zone for z in vehicle.get("zones", []))


def swap_candidates(
    slot: Dict[str, Any],
    vehicle: Dict[str, Any],
    assigned_pids: set,
    all_patients: List[Dict[str, Any]],
    all_deceased_patients: List[Dict[str, Any]],
    sla_config: Dict[str, Any],
    schedule_date: date,
    weekdays_set: set,
) -> List[Dict[str, Any]]:
    """Unassigned patients in the vehicle's zones that can replace a failed or deceased stop.

    A bereavement stop is replaced by another deceased patient's family; any
    other stop by an alive patient, scored without timeline bookings.
    """
    candidates = []
    if slot.get("visit_type") == "bereavement":
        for p in all_deceased_patients:
            if p["id"] not in assigned_pids and _zone_in_vehicle(p, vehicle):
                has_vis = 1 if p.get("has_completed_bereavement_visit") else 0
                dod = p.get("date_of_death") or date.max
                candidates.append({
                    "id": p["id"],
                    "name": p["name"],
                    "uhid": p.get("uhid") or "N/A",
                    "zone": p.get("zone"),
                    "priority": "Medium",
                    "type": "existing",
                    "visit_type": "bereavement",
                    "gap": (schedule_date - dod).days if p.get("date_of_death") else 0,
                    "urgency_score": 0.0,
                    "date_of_death": p.get("date_of_death").isoformat() if hasattr(p.get("date_of_death"), "isoformat") else p.get("date_of_death"),
                    "primary_caregiver_phone": p.get("primary_caregiver_phone"),
                    "sort_key": (has_vis, dod, p.get("name", "")),
                })
    else:
        for p in all_patients:
            if p.get("is_deceased"):
                continue
            if p["id"] not in assigned_pids and _zone_in_vehicle(p, vehicle):
                scored_p = score_patient(p, sla_config, schedule_date, weekdays_set)
                candidates.append({
                    "id": scored_p["id"],
                    "name": scored_p["name"],
                    "uhid": scored_p["uhid"],
                    "zone": scored_p.get("zone"),
                    "priority": scored_p["priority"],
                    "type": scored_p["type"],
                    "visit_type": "initial" if scored_p["type"] == "new" else "follow_up",
                    "gap": scored_p["gap_days"],
                    "urgency_score": scored_p["urgency_score"],
                    "sort_key": urgency_sort_key(scored_p),
                })
    candidates = sorted(candidates, key=lambda c: c["sort_key"])
    for c in candidates:
        del c["sort_key"]
    return candidates


def extra_visit_candidates(
    vehicle: Dict[str, Any],
    assigned_pids: set,
    all_patients: List[Dict[str, Any]],
    sla_config: Dict[str, Any],
    schedule_date: date,
    weekdays_set: set,
) -> List[Dict[str, Any]]:
    """Unassigned alive patients in the vehicle's zones, most urgent first."""
    extra = []
    for p in all_patients:
        if p.get("is_deceased"):
            continue
        if p["id"] not in assigned_pids and _zone_in_vehicle(p, vehicle):
            extra.append(score_patient(p, sla_config, schedule_date, weekdays_set))
    extra = sorted(extra, key=urgency_sort_key)
    return [
        {
            "id": c["id"],
            "name": c["name"],
            "uhid": c.get("uhid"),
            "zone": c.get("zone"),
            "lat": c.get("lat"),
            "lon": c.get("lon"),
            "priority": c["priority"],
            "type": c["type"],
            "gap": c["gap_days"],
            "urgency_score": c["urgency_score"],
        }
        for c in extra
    ]


def swap_assignments(
    current_slots: List[Dict[str, Any]],
    failed_patient_id: str,
    vehicle_id: str,
    replacement: Dict[str, Any],
    sla_config: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Full assignment list for the date with the failed stop's patient replaced.

    Saved through save_schedule_slots, exactly like the Streamlit console.
    """
    hc_days = homecare_days_string(sla_config)
    new_assignments = []
    for slot in current_slots:
        if slot["id"] == failed_patient_id:
            new_assignments.append({
                "patient_id": replacement["id"],
                "vehicle_id": vehicle_id,
                "slot_order": slot["slot_order"],
                "priority": replacement["priority"],
                "type": replacement["type"],
                "visit_type": replacement["visit_type"],
                "gap": replacement["gap"],
                "urgency": replacement["urgency_score"],
                "homecare_days": hc_days,
                "sla_days": sla_config.get(replacement["priority"], 4),
            })
        else:
            new_assignments.append({
                "patient_id": slot["id"],
                "vehicle_id": slot["vehicle_id"],
                "slot_order": slot["slot_order"],
                "priority": slot["priority_at_visit"],
                "type": slot["patient_type_at_visit"],
                "visit_type": slot.get("visit_type") or ("initial" if slot.get("patient_type_at_visit") == "new" else "follow_up"),
                "gap": slot["gap_days_at_visit"],
                "urgency": slot["urgency_score_at_visit"],
                "homecare_days": slot.get("homecare_days_at_schedule") or hc_days,
                "sla_days": slot.get("sla_days_at_visit") or sla_config.get(slot.get("priority_at_visit", "Medium"), 4),
            })
    return new_assignments


# ---------------------------------------------------------------------------
# Draft reservation expiry and schedule status
# ---------------------------------------------------------------------------

def format_expiry_hours(expiry_hours: float) -> str:
    if expiry_hours < 1:
        return f"{int(expiry_hours * 60)} mins"
    if expiry_hours == 1.0:
        return "1 hr"
    if expiry_hours == int(expiry_hours):
        return f"{int(expiry_hours)} hrs"
    return f"{expiry_hours:g} hrs"


def compute_draft_state(
    schedule_date: date,
    current_slots: List[Dict[str, Any]],
    is_locked: bool,
    expiry_hours: float,
    today: date,
    now_utc: datetime,
    now_local: datetime,
) -> Dict[str, Any]:
    """Whether an unlocked draft has expired and how long its reservation has left.

    ``updated_at`` values are naive database timestamps (PostgreSQL NOW(),
    stored in UTC). The reservation is capped at midnight of the schedule date.
    """
    expiry_seconds = expiry_hours * 3600
    expiry_display = format_expiry_hours(expiry_hours)

    state = {
        "is_draft_expired": False,
        "is_date_surpassed_expired": False,
        "is_capped_by_midnight": False,
        "draft_remaining_seconds": None,
        "draft_remaining_str": expiry_display,
        "expiry_display": expiry_display,
    }
    if is_locked or not current_slots:
        return state

    if schedule_date < today:
        state["is_draft_expired"] = True
        state["is_date_surpassed_expired"] = True
        return state

    updated_times = [s["updated_at"] for s in current_slots if s.get("updated_at")]
    if not updated_times:
        return state

    latest_dt = max(updated_times)
    if latest_dt.tzinfo is None:
        latest_dt = latest_dt.replace(tzinfo=timezone.utc)
    elapsed_seconds = (now_utc - latest_dt).total_seconds()

    inactivity_remaining_seconds = max(0, expiry_seconds - elapsed_seconds)

    end_of_schedule_dt = datetime.combine(schedule_date, dt_time(23, 59, 59))
    seconds_until_date_ends = (end_of_schedule_dt - now_local).total_seconds()

    if elapsed_seconds > expiry_seconds:
        state["is_draft_expired"] = True
    elif seconds_until_date_ends <= 0:
        state["is_draft_expired"] = True
        state["is_date_surpassed_expired"] = True
    else:
        effective_remaining_seconds = min(inactivity_remaining_seconds, seconds_until_date_ends)
        remaining_mins = int(effective_remaining_seconds // 60)
        is_capped_by_midnight = seconds_until_date_ends < inactivity_remaining_seconds
        state["is_capped_by_midnight"] = is_capped_by_midnight
        state["draft_remaining_seconds"] = effective_remaining_seconds
        if is_capped_by_midnight:
            if remaining_mins >= 60:
                state["draft_remaining_str"] = f"{remaining_mins // 60}h {remaining_mins % 60}m (Date Ends at Midnight)"
            else:
                state["draft_remaining_str"] = f"{max(1, remaining_mins)} min{'s' if remaining_mins != 1 else ''} (Date Ends at Midnight)"
        else:
            if remaining_mins >= 60:
                state["draft_remaining_str"] = f"{remaining_mins // 60}h {remaining_mins % 60}m"
            else:
                state["draft_remaining_str"] = f"{max(1, remaining_mins)} min{'s' if remaining_mins != 1 else ''}"
    return state


def overview_status(schedule_date: date, active_count: int, log_count: int, today: date) -> str:
    if log_count > 0:
        return "completed"
    if schedule_date < today:
        return "closed"
    if active_count > 0:
        return "active"
    return "pending"


# ---------------------------------------------------------------------------
# Routing
# ---------------------------------------------------------------------------

def get_google_distance_matrix(
    depot: Dict[str, float],
    patients: List[Dict[str, Any]],
    api_key: str
) -> Optional[Dict[Tuple[str, str], Dict[str, float]]]:
    """Fetch driving distances (km) and durations (mins) using Google Maps API."""
    if not api_key:
        return None

    # Locations list: depot is 'DEPOT', then patients
    locations = [{"id": "DEPOT", "lat": depot["lat"], "lon": depot["lon"]}] + patients

    coords_str = "|".join(f"{loc['lat']},{loc['lon']}" for loc in locations)

    url = "https://maps.googleapis.com/maps/api/distancematrix/json"
    params = {
        "origins": coords_str,
        "destinations": coords_str,
        "key": api_key
    }

    try:
        response = requests.get(url, params=params, timeout=5)
        if response.status_code == 200:
            res_data = response.json()
            if res_data.get("status") == "OK":
                matrix = {}
                rows = res_data.get("rows", [])
                for i, row in enumerate(rows):
                    from_id = locations[i]["id"]
                    elements = row.get("elements", [])
                    for j, elem in enumerate(elements):
                        to_id = locations[j]["id"]
                        if elem.get("status") == "OK":
                            dist_km = elem["distance"]["value"] / 1000.0
                            duration_min = elem["duration"]["value"] / 60.0
                            matrix[(from_id, to_id)] = {
                                "distance": dist_km,
                                "duration": duration_min
                            }
                return matrix
    except Exception as e:
        print(f"Google Maps Distance Matrix call failed: {e}")
    return None


def nearest_neighbor_route(
    depot: Dict[str, float],
    patients: List[Dict[str, Any]],
    dist_matrix: Optional[Dict[Tuple[str, str], Dict[str, float]]] = None
) -> List[Dict[str, Any]]:
    """Build a distance-optimized sequence of stops using Nearest Neighbor."""
    remaining = list(patients)
    ordered = []

    curr_id = "DEPOT"
    curr_lat = depot["lat"]
    curr_lon = depot["lon"]

    while remaining:
        def get_dist(p):
            if dist_matrix is not None and (curr_id, p["id"]) in dist_matrix:
                return dist_matrix[(curr_id, p["id"])]["distance"]
            return _haversine_km(curr_lat, curr_lon, p["lat"], p["lon"])

        nxt = min(remaining, key=get_dist)

        if dist_matrix is not None and (curr_id, nxt["id"]) in dist_matrix:
            drive_dist = dist_matrix[(curr_id, nxt["id"])]["distance"]
            drive_duration = dist_matrix[(curr_id, nxt["id"])]["duration"]
        else:
            drive_dist = _haversine_km(curr_lat, curr_lon, nxt["lat"], nxt["lon"])
            drive_duration = (drive_dist / 40.0) * 60.0  # estimate: 40 km/h avg speed -> minutes

        nxt_copy = copy.deepcopy(nxt)
        nxt_copy["drive_distance_km"] = round(drive_dist, 2)
        nxt_copy["drive_duration_min"] = round(drive_duration, 1)

        ordered.append(nxt_copy)
        remaining.remove(nxt)

        curr_id = nxt["id"]
        curr_lat = nxt["lat"]
        curr_lon = nxt["lon"]

    return ordered


def optimize_route_with_google_routes_api(
    depot: Dict[str, float],
    patients: List[Dict[str, Any]],
    api_key: str,
    round_trip: bool = True
) -> Optional[List[Dict[str, Any]]]:
    """Optimize waypoint order and calculate driving distances/durations using Google Routes API v2."""
    if not api_key:
        return None
    if not patients:
        return []

    valid_patients = []
    for p in patients:
        p_copy = copy.deepcopy(p)
        if p_copy.get("lat") is None or p_copy.get("lon") is None:
            p_copy["lat"] = depot["lat"]
            p_copy["lon"] = depot["lon"]
        valid_patients.append(p_copy)

    origin_loc = {"latLng": {"latitude": float(depot["lat"]), "longitude": float(depot["lon"])}}

    if round_trip:
        destination_loc = origin_loc
        intermediates_list = valid_patients
    else:
        # Open Loop: the patient furthest from the depot (Haversine) is the fixed destination
        furthest_idx = 0
        max_dist = -1.0
        for i, p in enumerate(valid_patients):
            d = _haversine_km(depot["lat"], depot["lon"], p["lat"], p["lon"])
            if d > max_dist:
                max_dist = d
                furthest_idx = i

        destination_p = valid_patients[furthest_idx]
        destination_loc = {"latLng": {"latitude": float(destination_p["lat"]), "longitude": float(destination_p["lon"])}}
        intermediates_list = [p for i, p in enumerate(valid_patients) if i != furthest_idx]

    intermediates = []
    for p in intermediates_list:
        intermediates.append({
            "location": {
                "latLng": {
                    "latitude": float(p["lat"]),
                    "longitude": float(p["lon"])
                }
            }
        })

    url = "https://routes.googleapis.com/directions/v2:computeRoutes"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": "routes.optimizedIntermediateWaypointIndex,routes.legs.distanceMeters,routes.legs.duration"
    }

    body = {
        "origin": {"location": origin_loc},
        "destination": {"location": destination_loc},
        "travelMode": "DRIVE",
        "optimizeWaypointOrder": True
    }
    if intermediates:
        body["intermediates"] = intermediates

    try:
        response = requests.post(url, json=body, headers=headers, timeout=10)
        if response.status_code == 200:
            res_data = response.json()
            routes = res_data.get("routes", [])
            if routes:
                route = routes[0]
                opt_indices = route.get("optimizedIntermediateWaypointIndex", [])
                legs = route.get("legs", [])

                if not opt_indices and intermediates_list:
                    opt_indices = list(range(len(intermediates_list)))

                ordered_intermediates = []
                for idx, orig_idx in enumerate(opt_indices):
                    p_opt = copy.deepcopy(intermediates_list[orig_idx])
                    leg = legs[idx] if idx < len(legs) else {}
                    dist_m = leg.get("distanceMeters", 0.0)
                    dur_str = leg.get("duration", "0s")
                    dur_sec = float(dur_str.rstrip("s")) if dur_str.endswith("s") else float(dur_str)

                    p_opt["drive_distance_km"] = round(dist_m / 1000.0, 2)
                    p_opt["drive_duration_min"] = round(dur_sec / 60.0, 1)
                    ordered_intermediates.append(p_opt)

                if round_trip:
                    return ordered_intermediates

                dest_p_opt = copy.deepcopy(destination_p)
                last_leg_idx = len(opt_indices)
                leg = legs[last_leg_idx] if last_leg_idx < len(legs) else {}
                dist_m = leg.get("distanceMeters", 0.0)
                dur_str = leg.get("duration", "0s")
                dur_sec = float(dur_str.rstrip("s")) if dur_str.endswith("s") else float(dur_str)

                dest_p_opt["drive_distance_km"] = round(dist_m / 1000.0, 2)
                dest_p_opt["drive_duration_min"] = round(dur_sec / 60.0, 1)
                ordered_intermediates.append(dest_p_opt)
                return ordered_intermediates
            print("[RoutesAPI] No routes found in response.")
        else:
            print(f"[RoutesAPI] Call failed with status code {response.status_code}: {response.text}")
    except Exception as e:
        print(f"[RoutesAPI] Google Routes API call failed with exception: {e}")
    return None


def optimize_vehicle_route(
    depot: Dict[str, float],
    v_slots: List[Dict[str, Any]],
    api_key: str,
    round_trip: bool = True,
) -> Tuple[List[Dict[str, Any]], str]:
    """Lock-time route order for one vehicle: Google Routes API, then Distance
    Matrix + nearest neighbour, then straight-line nearest neighbour.

    Returns the ordered stops and which method produced them.
    """
    if api_key:
        try:
            optimized = optimize_route_with_google_routes_api(depot, v_slots, api_key, round_trip=round_trip)
            if optimized:
                return optimized, "routes_api"
        except Exception as e:
            print(f"[DailyDispatch] Google Routes API optimization failed: {e}")

    dist_matrix = get_google_distance_matrix(depot, v_slots, api_key) if api_key else None
    method = "distance_matrix" if dist_matrix else "haversine"
    return nearest_neighbor_route(depot, v_slots, dist_matrix), method


def google_maps_route_urls(depot_lat, depot_lon, stops_coords: List[Tuple[Any, Any]]) -> Tuple[str, str]:
    """Round-trip and one-way Google Maps direction links for a vehicle run."""
    import urllib.parse
    origin_str = f"{depot_lat},{depot_lon}"

    dest_rt = origin_str
    wp_rt = "|".join(f"{lat},{lon}" for lat, lon in stops_coords)
    url_rt = f"https://www.google.com/maps/dir/?api=1&origin={urllib.parse.quote(origin_str)}&destination={urllib.parse.quote(dest_rt)}&waypoints={urllib.parse.quote(wp_rt)}&travelmode=driving"

    if len(stops_coords) > 1:
        dest_ow = f"{stops_coords[-1][0]},{stops_coords[-1][1]}"
        wp_ow = "|".join(f"{lat},{lon}" for lat, lon in stops_coords[:-1])
        url_ow = f"https://www.google.com/maps/dir/?api=1&origin={urllib.parse.quote(origin_str)}&destination={urllib.parse.quote(dest_ow)}&waypoints={urllib.parse.quote(wp_ow)}&travelmode=driving"
    else:
        dest_ow = f"{stops_coords[0][0]},{stops_coords[0][1]}"
        url_ow = f"https://www.google.com/maps/dir/?api=1&origin={urllib.parse.quote(origin_str)}&destination={urllib.parse.quote(dest_ow)}&travelmode=driving"
    return url_rt, url_ow


def shorten_url(long_url: str) -> str:
    """Shorten a long URL via TinyURL with is.gd fallback."""
    import urllib.parse
    import urllib.request
    if not long_url:
        return ""

    try:
        api_url = f"https://tinyurl.com/api-create.php?url={urllib.parse.quote(long_url)}"
        req = urllib.request.Request(api_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=4) as resp:
            res = resp.read().decode("utf-8").strip()
            if res.startswith("http"):
                return res
    except Exception:
        pass

    try:
        api_url = f"https://is.gd/create.php?format=simple&url={urllib.parse.quote(long_url)}"
        req = urllib.request.Request(api_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=4) as resp:
            res = resp.read().decode("utf-8").strip()
            if res.startswith("http"):
                return res
    except Exception:
        pass

    return long_url


# ---------------------------------------------------------------------------
# Zone boundaries (GeoJSON), measured in UTM zone 43N metres (EPSG:32643)
# ---------------------------------------------------------------------------

GEOJSON_FILE = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "patients", "data", "gba_zones.geojson",
)
BOUNDARY_BUFFER_KM = 2.0

# WGS84 ellipsoid, UTM zone 43N — the projected CRS the Streamlit analyzer uses.
_WGS84_A = 6378137.0
_WGS84_F = 1 / 298.257223563
_UTM_K0 = 0.9996
_UTM_LON0 = radians(75.0)
_UTM_FALSE_EASTING = 500000.0


def _utm_constants():
    n = _WGS84_F / (2 - _WGS84_F)
    A = _WGS84_A / (1 + n) * (1 + n ** 2 / 4 + n ** 4 / 64)
    alpha = (
        n / 2 - 2 * n ** 2 / 3 + 5 * n ** 3 / 16,
        13 * n ** 2 / 48 - 3 * n ** 3 / 5,
        61 * n ** 3 / 240,
    )
    e = sqrt(_WGS84_F * (2 - _WGS84_F))
    return A, alpha, e


_UTM_A, _UTM_ALPHA, _UTM_E = _utm_constants()


def project_utm43n(lat: float, lon: float) -> Tuple[float, float]:
    """WGS84 lat/lon -> UTM zone 43N easting/northing in metres (Krüger series, mm accuracy)."""
    phi = radians(lat)
    lam = radians(lon) - _UTM_LON0
    t = sinh(atanh(sin(phi)) - _UTM_E * atanh(_UTM_E * sin(phi)))
    xi_p = atan2(t, cos(lam))
    eta_p = atanh(sin(lam) / sqrt(1 + t * t))
    xi = xi_p
    eta = eta_p
    for j, a in enumerate(_UTM_ALPHA, start=1):
        xi += a * sin(2 * j * xi_p) * cosh(2 * j * eta_p)
        eta += a * cos(2 * j * xi_p) * sinh(2 * j * eta_p)
    easting = _UTM_FALSE_EASTING + _UTM_K0 * _UTM_A * eta
    northing = _UTM_K0 * _UTM_A * xi
    return easting, northing


_CHUNK = 64


def _ring_chunks(ring_xy: List[Tuple[float, float]]):
    """Split a projected ring into runs of segments with their bounding boxes."""
    chunks = []
    for start in range(0, len(ring_xy) - 1, _CHUNK):
        pts = ring_xy[start:start + _CHUNK + 1]
        if len(pts) < 2:
            continue
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        chunks.append((min(xs), min(ys), max(xs), max(ys), pts))
    return chunks


def _point_segment_distance(px, py, ax, ay, bx, by) -> float:
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return sqrt((px - ax) ** 2 + (py - ay) ** 2)
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    cx, cy = ax + t * dx, ay + t * dy
    return sqrt((px - cx) ** 2 + (py - cy) ** 2)


@lru_cache(maxsize=4)
def load_boundary_data(geojson_path: str = GEOJSON_FILE):
    """Load zone polygons as projected boundary lines: [(zone_name, chunks), ...].

    Deliberate difference from the Streamlit console: there, make_valid() turns the
    invalid Central, South and West polygons into GeometryCollections with no boundary,
    so only East and North ever raise alerts. Here every zone's rings are used.
    """
    if not os.path.exists(geojson_path):
        print(f"[Boundary Analyzer] GeoJSON file not found at {geojson_path}")
        return None
    try:
        with open(geojson_path) as fh:
            data = json.load(fh)
        boundaries = []
        for feature in data.get("features", []):
            props = feature.get("properties") or {}
            zone_name = None
            for col in ["zone", "zone_name", "Zone", "ZONE", "name", "Name"]:
                if col in props:
                    zone_name = props[col]
                    break
            geom = feature.get("geometry") or {}
            if geom.get("type") == "Polygon":
                polygons = [geom["coordinates"]]
            elif geom.get("type") == "MultiPolygon":
                polygons = geom["coordinates"]
            else:
                continue
            chunks = []
            for polygon in polygons:
                for ring in polygon:  # outer ring and holes all form the boundary
                    ring_xy = [project_utm43n(pt[1], pt[0]) for pt in ring]
                    chunks.extend(_ring_chunks(ring_xy))
            boundaries.append((zone_name, tuple(chunks)))
        return tuple(boundaries)
    except Exception as e:
        print(f"[Boundary Analyzer] Error loading GeoJSON boundaries: {e}")
        return None


def _distance_to_boundary(px: float, py: float, chunks, limit: float) -> Optional[float]:
    """Distance (m) from a projected point to a zone boundary, or None if beyond ``limit``."""
    best = None
    for min_x, min_y, max_x, max_y, pts in chunks:
        if px < min_x - limit or px > max_x + limit or py < min_y - limit or py > max_y + limit:
            continue
        for i in range(len(pts) - 1):
            d = _point_segment_distance(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])
            if best is None or d < best:
                best = d
    if best is None or best > limit:
        return None
    return best


def get_patient_boundary_info(lat: float, lon: float, boundaries, actual_zone: str, buffer_km: float = BOUNDARY_BUFFER_KM):
    """Check if the patient is within buffer_km of another zone's boundary."""
    if boundaries is None or lat is None or lon is None:
        return []

    try:
        px, py = project_utm43n(float(lat), float(lon))
        buffer_meters = buffer_km * 1000.0
        candidates = []

        for boundary_zone_name, chunks in boundaries:
            # Skip checking proximity to the patient's own assigned zone
            if actual_zone and str(boundary_zone_name).strip().upper() == str(actual_zone).strip().upper():
                continue

            distance = _distance_to_boundary(px, py, chunks, buffer_meters)
            if distance is not None:
                candidates.append({
                    "nearby_zone": boundary_zone_name,
                    "distance_m": distance
                })

        unique_candidates = {}
        for c in candidates:
            z_name = c["nearby_zone"]
            if z_name not in unique_candidates or c["distance_m"] < unique_candidates[z_name]["distance_m"]:
                unique_candidates[z_name] = c

        sorted_candidates = list(unique_candidates.values())
        sorted_candidates.sort(key=lambda x: x["distance_m"])
        return sorted_candidates
    except Exception as e:
        print(f"[Boundary Analyzer] Error in get_patient_boundary_info: {e}")
        return []


def boundary_alert_text(lat, lon, boundaries, actual_zone, buffer_km) -> str:
    if boundaries is None or lat is None or lon is None:
        return "None"
    nearby = get_patient_boundary_info(float(lat), float(lon), boundaries, actual_zone, buffer_km)
    if not nearby:
        return "None"
    return ", ".join(f"Near {nb['nearby_zone']} ({nb['distance_m']:.0f}m)" for nb in nearby)


def get_reassignment_suggestions(draft_slots, all_patients, all_vehicles, boundaries, buffer_km=2.0):
    """Recommend moving boundary-candidate patients to another vehicle when that
    vehicle's current draft itinerary has a stop closer to them than their current vehicle's stops.
    """
    if boundaries is None or not draft_slots:
        return []

    patients_by_id = {p["id"]: p for p in all_patients}
    vehicles_by_id = {v["id"]: v for v in all_vehicles}

    v_itineraries = {}
    for s in draft_slots:
        v_itineraries.setdefault(s["vehicle_id"], []).append(s)

    suggestions = []

    for s in draft_slots:
        pid = s["patient_id"]
        curr_vid = s["vehicle_id"]
        p_obj = patients_by_id.get(pid)

        if not p_obj:
            continue

        lat = p_obj.get("lat")
        lon = p_obj.get("lon")
        if lat is None or lon is None:
            continue

        actual_zone = p_obj.get("zone")

        nearby_boundaries = get_patient_boundary_info(
            lat=float(lat),
            lon=float(lon),
            boundaries=boundaries,
            actual_zone=actual_zone,
            buffer_km=buffer_km
        )

        if not nearby_boundaries:
            continue

        for nb in nearby_boundaries:
            nearby_zone = nb["nearby_zone"]
            nearby_zone_upper = str(nearby_zone).strip().upper()

            candidate_vehicles = []
            for v in all_vehicles:
                if v["id"] == curr_vid:
                    continue
                v_zones = [str(z).strip().upper() for z in v.get("zones", [])]
                if nearby_zone_upper in v_zones:
                    candidate_vehicles.append(v)

            if not candidate_vehicles:
                continue

            curr_stops = v_itineraries.get(curr_vid, [])
            other_curr_stops = [st for st in curr_stops if st["patient_id"] != pid]

            min_dist_curr = None
            for stop in other_curr_stops:
                stop_p = patients_by_id.get(stop["patient_id"])
                if stop_p:
                    stop_lat = stop_p.get("lat")
                    stop_lon = stop_p.get("lon")
                    if stop_lat is not None and stop_lon is not None:
                        d = _haversine_km(float(lat), float(lon), float(stop_lat), float(stop_lon))
                        if min_dist_curr is None or d < min_dist_curr:
                            min_dist_curr = d

            # If current vehicle has no other stops, distance is effectively from its depot
            if min_dist_curr is None:
                curr_v_obj = vehicles_by_id.get(curr_vid)
                if curr_v_obj and curr_v_obj.get("depot_lat") is not None:
                    min_dist_curr = _haversine_km(float(lat), float(lon), float(curr_v_obj["depot_lat"]), float(curr_v_obj["depot_lon"]))

            for cv in candidate_vehicles:
                cv_id = cv["id"]
                cv_stops = v_itineraries.get(cv_id, [])

                min_dist_cv = None
                closest_cv_stop_p_name = None

                for stop in cv_stops:
                    stop_p = patients_by_id.get(stop["patient_id"])
                    if stop_p:
                        stop_lat = stop_p.get("lat")
                        stop_lon = stop_p.get("lon")
                        if stop_lat is not None and stop_lon is not None:
                            d = _haversine_km(float(lat), float(lon), float(stop_lat), float(stop_lon))
                            if min_dist_cv is None or d < min_dist_cv:
                                min_dist_cv = d
                                closest_cv_stop_p_name = stop_p["name"]

                if min_dist_cv is None:
                    if cv.get("depot_lat") is not None:
                        min_dist_cv = _haversine_km(float(lat), float(lon), float(cv["depot_lat"]), float(cv["depot_lon"]))
                        closest_cv_stop_p_name = "Depot"

                if min_dist_cv is not None and min_dist_curr is not None:
                    if min_dist_cv < min_dist_curr:
                        suggestions.append({
                            "patient_id": pid,
                            "patient_name": p_obj["name"],
                            "current_vehicle_id": curr_vid,
                            "current_vehicle_name": vehicles_by_id.get(curr_vid, {}).get("name", "Unknown"),
                            "suggested_vehicle_id": cv_id,
                            "suggested_vehicle_name": cv["name"],
                            "nearby_zone": nearby_zone,
                            "boundary_distance_m": nb["distance_m"],
                            "curr_min_distance_km": min_dist_curr,
                            "cand_min_distance_km": min_dist_cv,
                            "closest_cand_stop": closest_cv_stop_p_name
                        })

    return suggestions


def abnormal_distance_patients(slots_by_vehicle, vehicles, threshold_km: float = 40.0) -> List[Dict[str, Any]]:
    """Stops more than ``threshold_km`` (straight line) from their vehicle's depot."""
    abnormal_list = []
    for v_check in vehicles:
        for s in slots_by_vehicle.get(v_check["id"], []):
            s_lat = s.get("lat")
            s_lon = s.get("lon")
            if s_lat is not None and s_lon is not None:
                dist = _haversine_km(v_check["depot_lat"], v_check["depot_lon"], s_lat, s_lon)
                if dist > threshold_km:
                    abnormal_list.append({
                        "patient_id": s["id"],
                        "vehicle_name": v_check["name"],
                        "patient_name": s["name"],
                        "uhid": s.get("uhid") or "N/A",
                        "hospital_uhid": s.get("hospital_uhid") or "N/A",
                        "distance_km": round(dist, 1),
                        "threshold_km": threshold_km,
                    })
    return abnormal_list
