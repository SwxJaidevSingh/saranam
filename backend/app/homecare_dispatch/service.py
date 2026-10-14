"""Homecare dispatch page services: one function per screen or action,
combining the scheduling rules (``logic``) with the data layer (``repository``).
"""
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from app.homecare_dispatch import logic, repository as repo
from app.homecare_dispatch.settings import load_settings

VEHICLE_TYPES = ["ambulance", "car", "van"]


class ConcurrentScheduleEdit(Exception):
    """Another session saved this date's schedule after it was loaded."""

    def __init__(self, db_count: int):
        super().__init__(f"A schedule already exists for this date with {db_count} patient(s).")
        self.db_count = db_count


def _expiry_hours(config: Dict[str, Any]) -> float:
    try:
        return float(config.get("draft_expiry_hours", 1.0))
    except (TypeError, ValueError):
        return 1.0


def _jsonable(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def _api_slot(s: Dict[str, Any], vehicles_by_id: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    """Slot for the API: ``id`` is the schedule row id, ``patient_id`` the patient."""
    out = _jsonable(dict(s))
    out["id"] = s["slot_id"]
    out["patient_id"] = s["id"]
    out["patient_name"] = s["name"]
    v = vehicles_by_id.get(s.get("vehicle_id"))
    if v:
        out["vehicle_name"] = v.get("name")
        out["registration_number"] = v.get("registration_number")
    return out


# ---------------------------------------------------------------------------
# Patients Directory
# ---------------------------------------------------------------------------

def patients_directory() -> Dict[str, Any]:
    """Active patients with homecare days since their reference visit against their SLA."""
    config = load_settings()
    today = date.today()
    weekdays_set = logic.weekdays_set_from_config(config)

    rows = []
    for p in repo.fetch_patients():
        priority = p["priority"] or "Medium"
        sla_val = config.get(priority, 8)
        ref_raw = p["registration_date"] if p["type"] == "new" else p["last_visit_date"]
        ref_date = logic._parse_date(ref_raw) or today
        gap_days = logic.count_homecare_days(ref_date, today, weekdays_set)
        rows.append({
            "id": p["id"],
            "name": p["name"],
            "uhid": p["uhid"] or "N/A",
            "hospital_uhid": p["hospital_uhid"] or "N/A",
            "registration_date": p["registration_date"].isoformat() if p["registration_date"] else "N/A",
            "last_visit_date": p["last_visit_date"].isoformat() if isinstance(p["last_visit_date"], date) else str(p["last_visit_date"] or "N/A"),
            "priority": priority,
            "zone": p["zone"] or "N/A",
            "gap_days": gap_days,
            "status": "New" if p["type"] == "new" else "Old",
            "sla_days": sla_val,
            "sla_status": "Overdue" if gap_days > sla_val else "On Track",
            "phone": p.get("phone") or "N/A",
            "alternative_phone": p.get("alternative_phone") or "N/A",
            "caregiver_phone": p.get("primary_caregiver_phone") or "N/A",
            "decision_maker_phone": p.get("decision_maker_phone") or "N/A",
        })
    new_count = sum(1 for r in rows if r["status"] == "New")
    return {
        "patients": rows,
        "summary": {"total": len(rows), "new": new_count, "old": len(rows) - new_count},
        "as_of": today.isoformat(),
    }


# ---------------------------------------------------------------------------
# Vehicles
# ---------------------------------------------------------------------------

def vehicle_form_options() -> Dict[str, Any]:
    hospitals = list(repo.fetch_hospital_coordinates().keys()) or list(repo.FALLBACK_HOSPITAL_CODES)
    return {"hospitals": hospitals, "zones": repo.fetch_patient_zones(), "vehicle_types": VEHICLE_TYPES}


def validate_vehicle(data: Dict[str, Any]) -> Dict[str, Any]:
    name = str(data.get("name") or "").strip()
    if not name:
        raise ValueError("Vehicle Name is required.")
    zones = data.get("zones") or []
    if not isinstance(zones, list) or not zones:
        raise ValueError("At least one Service Zone must be selected.")
    try:
        capacity = int(data.get("capacity", 5))
    except (TypeError, ValueError):
        raise ValueError("Capacity must be a whole number.")
    if not 1 <= capacity <= 20:
        raise ValueError("Capacity must be between 1 and 20 patients per day.")
    v_type = data.get("vehicle_type") or "ambulance"
    if v_type not in VEHICLE_TYPES:
        raise ValueError(f"Vehicle Type must be one of: {', '.join(VEHICLE_TYPES)}.")
    reg = str(data.get("registration_number") or "").strip()
    notes = str(data.get("notes") or "").strip()
    return {
        "name": name,
        "registration_number": reg or None,
        "vehicle_type": v_type,
        "capacity": capacity,
        "is_active": bool(data.get("is_active", True)),
        "base_hospital": data.get("base_hospital") or "KMIO",
        "zones": [str(z) for z in zones],
        "notes": notes or None,
    }


# ---------------------------------------------------------------------------
# Scheduling Board: overview and date detail
# ---------------------------------------------------------------------------

def overview(start_date: date, end_date: date) -> List[Dict[str, Any]]:
    repo.ensure_tables()
    return repo.fetch_schedule_overview(start_date, end_date, _expiry_hours(load_settings()))


def schedule_exists(schedule_date: date) -> bool:
    return bool(repo.fetch_schedule_slots(schedule_date, _expiry_hours(load_settings())))


def schedule_detail(schedule_date: date) -> Dict[str, Any]:
    """Everything the date page needs, including draft-expiry state."""
    repo.ensure_tables()
    config = load_settings()
    expiry_hours = _expiry_hours(config)
    vehicles = repo.fetch_active_vehicles()
    vehicles_by_id = {v["id"]: v for v in vehicles}
    current_slots = repo.fetch_schedule_slots(schedule_date, expiry_hours)

    today = date.today()
    is_past_date = schedule_date < today
    is_locked = any(s["status"] in ("active", "completed", "failed") for s in current_slots)
    has_vehicle_log = repo.has_vehicle_log_for_date(schedule_date)
    is_closed_or_completed = is_past_date or has_vehicle_log

    draft = logic.compute_draft_state(
        schedule_date, current_slots, is_locked, expiry_hours,
        today=today, now_utc=datetime.now(timezone.utc), now_local=datetime.now(),
    )
    if draft["is_draft_expired"]:
        repo.cleanup_expired_draft_schedules(expiry_hours)

    if has_vehicle_log:
        status_label = "Completed (Vehicle Log Recorded)"
    elif draft["is_date_surpassed_expired"]:
        status_label = "Expired Draft (Schedule Date Surpassed)"
    elif draft["is_draft_expired"]:
        status_label = "Expired Draft (Released)"
    elif is_past_date:
        status_label = "Closed (Schedule Date Surpassed)" if is_locked else "Closed (Past Date)"
    elif is_locked:
        status_label = "Locked (Active)"
    elif current_slots:
        status_label = f"Pending Draft (Expires in ~{draft['draft_remaining_str']} if not locked)"
    else:
        status_label = "Open (No Patients Scheduled)"

    locked_hours = float(config.get("locked_expiry_hours", 24.0))
    loaded_max_updated = max((s["updated_at"] for s in current_slots if s.get("updated_at")), default=None)

    return {
        "date": schedule_date.isoformat(),
        "slots": [_api_slot(s, vehicles_by_id) for s in current_slots],
        "vehicles": vehicles,
        "is_locked": is_locked,
        "is_past_date": is_past_date,
        "has_vehicle_log": has_vehicle_log,
        "is_disabled": is_closed_or_completed or draft["is_draft_expired"],
        "status_label": status_label,
        "draft": draft,
        "locked_expiry_display": f"{int(locked_hours)} hrs" if locked_hours == int(locked_hours) else f"{locked_hours:g} hrs",
        "loaded_slot_count": len(current_slots),
        "loaded_max_updated": loaded_max_updated.isoformat() if loaded_max_updated else None,
        "vehicle_logs": {v["id"]: log for v in vehicles if (log := repo.fetch_vehicle_log(v["id"], schedule_date))},
        "routes": repo.fetch_daily_vehicle_routes(schedule_date),
        "config": {
            "homecare_weekdays": config.get("homecare_weekdays"),
            "draft_expiry_hours": expiry_hours,
            "boundary_buffer_km": float(config.get("boundary_buffer_km", 2.0)),
            "sla_days": {k: config.get(k) for k in ("Emergency", "Urgent", "High", "Medium", "Low", "New")},
        },
    }


# ---------------------------------------------------------------------------
# Planning Board
# ---------------------------------------------------------------------------

def _booking_json(b: Dict[str, Any]) -> Dict[str, Any]:
    return {"schedule_date": b["schedule_date"].isoformat(), "status": b["status"]}


def planning_candidates(schedule_date: date) -> Dict[str, Any]:
    """Alive patients scored against the calendar timeline (most urgent first), and
    deceased patients for bereavement visits (unvisited first, by date of death).

    The board filters these per vehicle (zone, other-vehicle assignment, zero urgency).
    """
    config = load_settings()
    expiry_hours = _expiry_hours(config)
    weekdays_set = logic.weekdays_set_from_config(config)
    buffer_km = float(config.get("boundary_buffer_km", 2.0))
    boundaries = logic.load_boundary_data()

    all_patients = repo.fetch_patients(True, schedule_date, "alive")
    all_deceased = repo.fetch_patients(True, schedule_date, "deceased")
    timeline = repo.fetch_active_timeline_bookings(expiry_hours, exclude_date=schedule_date)

    alive = []
    for p in all_patients:
        if p.get("is_deceased"):
            continue
        scored = logic.score_patient(p, config, schedule_date, weekdays_set,
                                     timeline_bookings=timeline.get(str(p["id"]), []))
        earlier, future = scored["earlier_bookings"], scored["future_bookings"]
        if earlier and future:
            e_str = max(b["schedule_date"] for b in earlier).strftime("%d %b")
            f_str = ", ".join(b["schedule_date"].strftime("%d %b") for b in future)
            timeline_note = f"Prior: {e_str} | Next: {f_str}"
        elif earlier:
            timeline_note = f"📅 Prior: {max(b['schedule_date'] for b in earlier).strftime('%d %b')}"
        elif future:
            timeline_note = f"⚠️ Next: {', '.join(b['schedule_date'].strftime('%d %b') for b in future)}"
        else:
            timeline_note = "Normal"
        latest_earlier = max((b["schedule_date"] for b in earlier), default=None)
        alive.append(_jsonable({
            **scored,
            "earlier_bookings": [_booking_json(b) for b in earlier],
            "future_bookings": [_booking_json(b) for b in future],
            "latest_earlier_booking": latest_earlier,
            "timeline_note": timeline_note,
            "boundary_alert": logic.boundary_alert_text(p.get("lat"), p.get("lon"), boundaries, p.get("zone"), buffer_km),
        }))
    alive.sort(key=logic.urgency_sort_key)

    deceased = []
    for p in all_deceased:
        meta = logic.bereavement_status(p, schedule_date, timeline.get(str(p["id"]), []))
        dod = logic.parse_dod(p)
        deceased.append((p, meta, _jsonable({
            **p,
            "bereavement_status": meta["b_status"],
            "is_previously_addressed": meta["is_previously_addressed"],
            "days_since_death": (schedule_date - dod).days if dod != date.max else None,
            "boundary_alert": logic.boundary_alert_text(p.get("lat"), p.get("lon"), boundaries, p.get("zone"), buffer_km),
        })))
    deceased.sort(key=lambda t: logic.bereavement_sort_key(t[0], t[1]))

    return {"patients": alive, "deceased_patients": [t[2] for t in deceased]}


def normalize_assignment(a: Dict[str, Any]) -> Dict[str, Any]:
    """Accept planning-board keys (priority/type/gap/urgency) or slot-row keys."""
    def first(*keys):
        for k in keys:
            if a.get(k) is not None:
                return a.get(k)
        return None

    return {
        "patient_id": str(a["patient_id"]),
        "vehicle_id": str(a["vehicle_id"]),
        "slot_order": first("slot_order") or 1,
        "priority": first("priority", "priority_at_visit"),
        "type": first("type", "patient_type_at_visit"),
        "visit_type": first("visit_type"),
        "gap": first("gap", "gap_days_at_visit"),
        "urgency": first("urgency", "urgency_score_at_visit"),
        "homecare_days": first("homecare_days", "homecare_days_at_schedule"),
        "sla_days": first("sla_days", "sla_days_at_visit"),
    }


def auto_draft(schedule_date: date, board: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Auto-Draft Suggestions: every vehicle's alive stops replaced by the
    suggestion; bereavement stops already on the board are kept first."""
    config = load_settings()
    vehicles = repo.fetch_active_vehicles()
    suggested = logic.calculate_draft_schedule(
        repo.fetch_patients(True, schedule_date, "alive"), vehicles, schedule_date,
        logic.weekdays_set_from_config(config), config,
        timeline_bookings=repo.fetch_active_timeline_bookings(_expiry_hours(config), exclude_date=schedule_date),
    )
    return logic.apply_auto_draft([normalize_assignment(a) for a in board], suggested, vehicles, config)


def save_draft(schedule_date: date, assignments: List[Dict[str, Any]], loaded_count: int,
               loaded_max_updated: Optional[str], force: bool = False) -> None:
    """Save the board, asking for confirmation (ConcurrentScheduleEdit) when another
    session created or changed this date since it was loaded."""
    config = load_settings()
    expiry_hours = _expiry_hours(config)
    if not force:
        db_now = repo.fetch_schedule_slots(schedule_date, expiry_hours)
        now_count = len(db_now)
        now_updated = max((s["updated_at"] for s in db_now if s.get("updated_at")), default=None)
        loaded_updated = None
        if loaded_max_updated:
            try:
                loaded_updated = datetime.fromisoformat(loaded_max_updated)
            except ValueError:
                loaded_updated = None
        if (loaded_count == 0 and now_count > 0) or (loaded_updated and now_updated and now_updated > loaded_updated):
            raise ConcurrentScheduleEdit(now_count)
    repo.save_schedule_slots(schedule_date, [normalize_assignment(a) for a in assignments], expiry_hours, config)


def delete_draft(schedule_date: date) -> int:
    return repo.delete_draft_schedule(schedule_date)


def boundary_suggestions(schedule_date: date, draft: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Reshuffle recommendations for the board's (possibly unsaved) draft."""
    config = load_settings()
    return logic.get_reassignment_suggestions(
        [{"patient_id": str(s["patient_id"]), "vehicle_id": str(s["vehicle_id"])} for s in draft],
        repo.fetch_patients(True, schedule_date, "alive"),
        repo.fetch_active_vehicles(),
        logic.load_boundary_data(),
        float(config.get("boundary_buffer_km", 2.0)),
    )


# ---------------------------------------------------------------------------
# Lock & Optimize
# ---------------------------------------------------------------------------

ABNORMAL_DISTANCE_KM = 40.0


def _slots_by_vehicle(schedule_date: date, expiry_hours: float) -> Dict[str, List[Dict[str, Any]]]:
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for s in repo.fetch_schedule_slots(schedule_date, expiry_hours):
        grouped.setdefault(s["vehicle_id"], []).append(s)
    return grouped


def abnormal_distance_check(schedule_date: date) -> List[Dict[str, Any]]:
    """Saved stops more than 40 km (straight line) from their vehicle's depot."""
    grouped = _slots_by_vehicle(schedule_date, _expiry_hours(load_settings()))
    return logic.abnormal_distance_patients(grouped, repo.fetch_active_vehicles(), ABNORMAL_DISTANCE_KM)


def lock_schedule(schedule_date: date, round_trip: bool, api_key: str) -> Dict[str, str]:
    """Sequence each vehicle's saved stops, save route links, and lock the date.

    Returns the routing method used per vehicle id.
    """
    config = load_settings()
    expiry_hours = _expiry_hours(config)
    if schedule_date < date.today():
        repo.cleanup_expired_draft_schedules(expiry_hours)
        raise ValueError(f"Schedule date {schedule_date} has already passed. The schedule date has surpassed and cannot be locked.")

    grouped = _slots_by_vehicle(schedule_date, expiry_hours)
    optimized_slots: List[Dict[str, Any]] = []
    methods: Dict[str, str] = {}
    for v in repo.fetch_active_vehicles():
        v_slots = grouped.get(v["id"], [])
        if not v_slots:
            continue
        route, method = logic.optimize_vehicle_route({"lat": v["depot_lat"], "lon": v["depot_lon"]}, v_slots, api_key, round_trip)
        methods[v["id"]] = method
        for idx, stop in enumerate(route):
            optimized_slots.append({
                "patient_id": stop["id"],
                "slot_order": idx + 1,
                "drive_distance_km": stop.get("drive_distance_km"),
                "drive_duration_min": stop.get("drive_duration_min"),
            })
        stops_coords = [(s["lat"], s["lon"]) for s in route if s.get("lat") is not None and s.get("lon") is not None]
        if stops_coords:
            url_rt, url_ow = logic.google_maps_route_urls(v["depot_lat"], v["depot_lon"], stops_coords)
            repo.save_daily_vehicle_route(schedule_date, v["id"], url_rt, url_ow,
                                          logic.shorten_url(url_rt), logic.shorten_url(url_ow))

    repo.lock_and_optimize_schedule(schedule_date, optimized_slots, expiry_hours)
    return methods


# ---------------------------------------------------------------------------
# Dispatch Console
# ---------------------------------------------------------------------------

def _slot_context(schedule_date: date, slot_id: str):
    config = load_settings()
    current_slots = repo.fetch_schedule_slots(schedule_date, _expiry_hours(config))
    slot = next((s for s in current_slots if s["slot_id"] == str(slot_id)), None)
    if not slot:
        raise LookupError("Visit slot not found for this date.")
    return config, current_slots, slot


def set_visit_status(schedule_date: date, slot_id: str, status: str) -> Dict[str, Any]:
    if status not in ("completed", "failed"):
        raise ValueError("Status must be 'completed' or 'failed'.")
    _, _, slot = _slot_context(schedule_date, slot_id)
    repo.log_visit_completion(schedule_date, slot["id"], status)
    return {"patient_name": slot["name"], "status": status}


def replacement_candidates(schedule_date: date, slot_id: str) -> List[Dict[str, Any]]:
    """Patients that can replace a failed or deceased stop, most suitable first."""
    config, current_slots, slot = _slot_context(schedule_date, slot_id)
    vehicle = next((v for v in repo.fetch_active_vehicles() if v["id"] == slot["vehicle_id"]), None)
    if not vehicle:
        return []
    is_bereav = slot.get("visit_type") == "bereavement"
    return _jsonable(logic.swap_candidates(
        slot, vehicle, {s["id"] for s in current_slots},
        [] if is_bereav else repo.fetch_patients(True, schedule_date, "alive"),
        repo.fetch_patients(True, schedule_date, "deceased") if is_bereav else [],
        config, schedule_date, logic.weekdays_set_from_config(config),
    ))


def swap_patient(schedule_date: date, slot_id: str, replacement_patient_id: str) -> str:
    """Replace a stop's patient and save the date's assignments. Returns the new patient's name."""
    config, current_slots, slot = _slot_context(schedule_date, slot_id)
    if repo.fetch_vehicle_log(slot["vehicle_id"], schedule_date):
        raise ValueError("Swapping is disabled for this completed/closed run.")
    rep_p = next((c for c in replacement_candidates(schedule_date, slot_id)
                  if str(c["id"]) == str(replacement_patient_id)), None)
    if not rep_p:
        raise ValueError("Replacement patient is not an eligible unassigned candidate for this vehicle.")
    assignments = logic.swap_assignments(current_slots, slot["id"], slot["vehicle_id"], rep_p, config)
    repo.save_schedule_slots(schedule_date, assignments, _expiry_hours(config), config)
    return rep_p["name"]


def extra_visit_candidates(schedule_date: date, vehicle_id: str) -> List[Dict[str, Any]]:
    config = load_settings()
    vehicle = next((v for v in repo.fetch_active_vehicles() if v["id"] == str(vehicle_id)), None)
    if not vehicle:
        return []
    current_slots = repo.fetch_schedule_slots(schedule_date, _expiry_hours(config))
    return _jsonable(logic.extra_visit_candidates(
        vehicle, {s["id"] for s in current_slots},
        repo.fetch_patients(True, schedule_date, "alive"),
        config, schedule_date, logic.weekdays_set_from_config(config),
    ))


def add_extra_visit(schedule_date: date, vehicle_id: str, patient_id: str) -> str:
    """Append an unassigned patient to a locked run. Returns the patient's name."""
    config = load_settings()
    if repo.fetch_vehicle_log(str(vehicle_id), schedule_date) or schedule_date < date.today():
        raise ValueError("Adding extra visits is disabled for this run (schedule is completed, closed, or expired).")
    vehicle = next((v for v in repo.fetch_active_vehicles() if v["id"] == str(vehicle_id)), None)
    if not vehicle:
        raise ValueError("Vehicle not found.")
    rep_p = next((c for c in extra_visit_candidates(schedule_date, vehicle_id) if c["id"] == str(patient_id)), None)
    if not rep_p:
        raise ValueError("Patient is not an eligible unassigned candidate for this vehicle.")

    current_slots = repo.fetch_schedule_slots(schedule_date, _expiry_hours(config))
    v_slots = sorted([s for s in current_slots if s["vehicle_id"] == str(vehicle_id)], key=lambda s: s["slot_order"])
    if v_slots:
        last_lat, last_lon = v_slots[-1]["lat"], v_slots[-1]["lon"]
    else:
        last_lat, last_lon = vehicle["depot_lat"], vehicle["depot_lon"]
    new_lat = float(rep_p["lat"]) if rep_p.get("lat") is not None else last_lat
    new_lon = float(rep_p["lon"]) if rep_p.get("lon") is not None else last_lon
    dist_km = logic._haversine_km(last_lat, last_lon, new_lat, new_lon)

    repo.add_extra_active_visit(
        schedule_date, rep_p["id"], vehicle_id, len(v_slots) + 1,
        rep_p["priority"], rep_p["type"], rep_p["gap"], rep_p["urgency_score"],
        round(dist_km, 2), round((dist_km / 40.0) * 60.0, 1),
        logic.homecare_days_string(config), config.get(rep_p["priority"], 4),
        "initial" if rep_p["type"] == "new" else "follow_up",
    )
    return rep_p["name"]


def submit_vehicle_log(schedule_date: date, vehicle_id: str, data: Dict[str, Any]) -> None:
    """Close a vehicle run: driver, odometer, start/end points; fuel = km / mileage."""
    driver_name = str(data.get("driver_name") or "").strip()
    if not driver_name:
        raise ValueError("Driver Name is required.")
    try:
        opening = float(data.get("opening_kms"))
        closing = float(data.get("closing_kms"))
        mileage = float(data.get("mileage", 10.0))
    except (TypeError, ValueError):
        raise ValueError("Odometer readings and mileage must be numbers.")
    if opening < 0 or mileage < 0:
        raise ValueError("Odometer readings and mileage cannot be negative.")
    if closing < opening:
        raise ValueError("Closing Odometer must be greater than or equal to Opening Odometer.")
    if repo.fetch_vehicle_log(vehicle_id, schedule_date):
        raise ValueError("Daily vehicle log for this run has already been recorded.")

    num_kms = closing - opening
    repo.create_vehicle_log({
        "vehicle_id": str(vehicle_id),
        "date": schedule_date,
        "driver_name": driver_name,
        "opening_kms": opening,
        "closing_kms": closing,
        "number_of_kms": num_kms,
        "start_point": str(data.get("start_point") or "").strip() or None,
        "destination_point": str(data.get("destination_point") or "").strip() or None,
        "fuel_liters": num_kms / mileage if mileage > 0 else 0.0,
        "mileage": mileage,
    })


# ---------------------------------------------------------------------------
# Completion Report
# ---------------------------------------------------------------------------

def report_rows_and_metrics(selected_date: date):
    from app.homecare_dispatch.report import compile_report_metrics
    rows = repo.fetch_completion_report(selected_date)
    metrics, vehicles = compile_report_metrics(
        rows, hospitals=repo.fetch_hospital_coordinates(), save_route=repo.save_daily_vehicle_route,
    )
    return rows, metrics, vehicles
