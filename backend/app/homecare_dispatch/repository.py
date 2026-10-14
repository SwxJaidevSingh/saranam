"""Homecare dispatch data layer: the Saranam Streamlit console's SQL.

Both apps read and write the same tables (``daily_vehicle_schedules``,
``vehicles``, ``vehicle_logs``, ``daily_vehicle_routes``), so the queries mirror
the Streamlit ``data.py`` modules statement for statement.
"""
import json
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import text

from app.extensions import db
from app.patients.models import Patient
from app.saranam.models.daily_vehicle_route import DailyVehicleRoute
from app.saranam.models.daily_vehicle_schedule import DailyVehicleSchedule
from app.saranam.models.vehicle_log import VehicleLog
from app.homecare_dispatch import logic

# Depot used when a vehicle's base hospital has no coordinates in hospital_options.
FALLBACK_DEPOT = (12.9716, 77.5946)
FALLBACK_HOSPITAL_CODES = ["KMIO", "KCGH", "CENTRAL"]
DEFAULT_ZONES = ["North", "South", "East", "West", "Central"]


def ensure_tables() -> None:
    """Create the dispatch tables on a fresh database (no migration exists for them)."""
    try:
        for model in (DailyVehicleSchedule, VehicleLog, DailyVehicleRoute):
            model.__table__.create(db.engine, checkfirst=True)
    except Exception:
        db.session.rollback()


def _decrypted_contacts(patient_ids) -> Dict[str, Dict[str, str]]:
    """Phone and address per patient id, decrypted through the Patient model."""
    out: Dict[str, Dict[str, str]] = {}
    ids = list(patient_ids)
    if not ids:
        return out
    for p_obj in Patient.query.filter(Patient.id.in_(ids)).all():
        try:
            phone = p_obj.get_phone() or ""
        except Exception:
            phone = ""
        try:
            address = p_obj.get_address() or ""
        except Exception:
            address = ""
        out[str(p_obj.id)] = {"phone": phone, "address": address}
    return out


# ---------------------------------------------------------------------------
# Hospitals and vehicles
# ---------------------------------------------------------------------------

def fetch_hospital_coordinates() -> Dict[str, tuple]:
    """Depot coordinates per hospital code, from system_settings.hospital_options."""
    try:
        row = db.session.execute(
            text("SELECT value FROM system_settings WHERE key = 'hospital_options'")
        ).fetchone()
        hospitals = {}
        if row and row[0]:
            data = row[0]
            if isinstance(data, str):
                try:
                    data = json.loads(data)
                except Exception:
                    data = []
            for h in data:
                code = h.get("code")
                lat = h.get("lat") or h.get("latitude")
                lng = h.get("lng") or h.get("longitude") or h.get("lon")
                if code and lat is not None and lng is not None:
                    hospitals[code] = (float(lat), float(lng))
        return hospitals
    except Exception as e:
        db.session.rollback()
        print(f"Error fetching hospital options: {e}")
        return {
            "KMIO": (12.9436, 77.5978),
            "KCGH": (12.9718, 77.5946),
        }


def fetch_vehicles() -> List[Dict[str, Any]]:
    """All vehicles (active and inactive) with depot coordinates."""
    hospitals = fetch_hospital_coordinates()
    rows = db.session.execute(text("""
        SELECT id, name, registration_number, vehicle_type, capacity, is_active, notes, base_hospital, zones
        FROM vehicles
        ORDER BY name ASC
    """)).mappings().all()

    vehicles = []
    for row in rows:
        zones = row.get("zones") or []
        if isinstance(zones, str):
            try:
                zones = json.loads(zones)
            except Exception:
                zones = []
        hosp_code = row.get("base_hospital")
        depot_coords = hospitals.get(hosp_code) or FALLBACK_DEPOT
        vehicles.append({
            "id": str(row["id"]),
            "name": row["name"],
            "registration_number": row.get("registration_number"),
            "vehicle_type": row.get("vehicle_type"),
            "capacity": row.get("capacity") or 5,
            "is_active": bool(row.get("is_active")),
            "notes": row.get("notes"),
            "base_hospital": hosp_code,
            "zones": zones,
            "depot_lat": depot_coords[0],
            "depot_lon": depot_coords[1],
        })
    return vehicles


def fetch_active_vehicles() -> List[Dict[str, Any]]:
    return [v for v in fetch_vehicles() if v["is_active"]]


def create_vehicle(data: Dict[str, Any]) -> str:
    try:
        vehicle_id = db.session.execute(text("""
            INSERT INTO vehicles (id, name, registration_number, vehicle_type, capacity, is_active, notes, base_hospital, zones, created_at, updated_at)
            VALUES (gen_random_uuid(), :name, :reg, :vtype, :capacity, :active, :notes, :base, CAST(:zones AS JSONB), NOW(), NOW())
            RETURNING id;
        """), {
            "name": data["name"],
            "reg": data.get("registration_number"),
            "vtype": data.get("vehicle_type"),
            "capacity": data.get("capacity", 5),
            "active": data.get("is_active", True),
            "notes": data.get("notes"),
            "base": data.get("base_hospital") or "KMIO",
            "zones": json.dumps(data.get("zones") or []),
        }).scalar()
        db.session.commit()
        return str(vehicle_id)
    except Exception:
        db.session.rollback()
        raise


def update_vehicle(vehicle_id: str, data: Dict[str, Any]) -> None:
    try:
        db.session.execute(text("""
            UPDATE vehicles
            SET name = :name,
                registration_number = :reg,
                vehicle_type = :vtype,
                capacity = :capacity,
                is_active = :active,
                notes = :notes,
                base_hospital = :base,
                zones = CAST(:zones AS JSONB),
                updated_at = NOW()
            WHERE id = :id;
        """), {
            "id": vehicle_id,
            "name": data["name"],
            "reg": data.get("registration_number"),
            "vtype": data.get("vehicle_type"),
            "capacity": data.get("capacity", 5),
            "active": data.get("is_active", True),
            "notes": data.get("notes"),
            "base": data.get("base_hospital") or "KMIO",
            "zones": json.dumps(data.get("zones") or []),
        })
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise


def delete_vehicle(vehicle_id: str) -> None:
    try:
        db.session.execute(text("DELETE FROM vehicles WHERE id = :id"), {"id": vehicle_id})
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise


# ---------------------------------------------------------------------------
# Patients
# ---------------------------------------------------------------------------

def fetch_patients(only_eligible_for_scheduling: bool = False, as_of_date: Optional[date] = None,
                   patient_category: str = "alive") -> List[Dict[str, Any]]:
    """Patients with visit history strictly before as_of_date.

    patient_category: 'alive' (active, living), 'deceased' (bereavement), or 'all'.
    A visit is any patient_visits row or a completed daily_vehicle_schedules row.
    """
    query = """
        SELECT
            p.id,
            p.full_name,
            p.uhid,
            p.hospital_uhid,
            p.registration_date,
            p.patient_priority,
            p.geographic_cluster,
            p.external_metadata,
            p.alternative_phone,
            p.primary_caregiver_phone,
            p.primary_caregiver_name,
            p.decision_maker_phone,
            p.decision_maker_name,
            p.is_deceased,
            p.date_of_death,
            p.place_of_death,
            GREATEST(
                (
                    SELECT MAX(visit_date)
                    FROM patient_visits
                    WHERE patient_id = p.id
                      AND (CAST(:as_of_date AS DATE) IS NULL OR visit_date < :as_of_date)
                ),
                (
                    SELECT MAX(schedule_date)
                    FROM daily_vehicle_schedules
                    WHERE patient_id = p.id AND status = 'completed'
                      AND (CAST(:as_of_date AS DATE) IS NULL OR schedule_date < :as_of_date)
                )
            ) as last_completed_visit_date,
            (
                SELECT COUNT(*) FROM (
                    SELECT 1
                    FROM patient_visits
                    WHERE patient_id = p.id
                      AND (CAST(:as_of_date AS DATE) IS NULL OR visit_date < :as_of_date)
                    UNION ALL
                    SELECT 1
                    FROM daily_vehicle_schedules
                    WHERE patient_id = p.id AND status = 'completed'
                      AND (CAST(:as_of_date AS DATE) IS NULL OR schedule_date < :as_of_date)
                ) sub
            ) as completed_visit_count,
            (
                SELECT COUNT(*)
                FROM daily_vehicle_schedules
                WHERE patient_id = p.id AND status = 'completed' AND visit_type = 'bereavement'
                  AND (CAST(:as_of_date AS DATE) IS NULL OR schedule_date < :as_of_date)
            ) as completed_bereavement_count,
            (
                SELECT MAX(schedule_date)
                FROM daily_vehicle_schedules
                WHERE patient_id = p.id AND status = 'completed' AND visit_type = 'bereavement'
                  AND (CAST(:as_of_date AS DATE) IS NULL OR schedule_date < :as_of_date)
            ) as last_bereavement_visit_date,
            (
                SELECT COUNT(*)
                FROM daily_vehicle_schedules
                WHERE patient_id = p.id AND visit_type = 'bereavement'
                  AND (CAST(:as_of_date AS DATE) IS NULL OR schedule_date < :as_of_date)
            ) as prior_bereavement_schedule_count,
            (
                SELECT MAX(schedule_date)
                FROM daily_vehicle_schedules
                WHERE patient_id = p.id AND visit_type = 'bereavement'
                  AND (CAST(:as_of_date AS DATE) IS NULL OR schedule_date < :as_of_date)
            ) as last_prior_bereavement_schedule_date
        FROM patients p
    """

    if patient_category == "alive":
        query += """
            WHERE p.care_status = 'active'
              AND p.is_active = True
              AND (p.is_deceased IS FALSE OR p.is_deceased IS NULL)
        """
    elif patient_category == "deceased":
        query += """
            WHERE p.is_deceased IS TRUE
        """
    else:
        query += """
            WHERE p.is_active = True
        """

    if only_eligible_for_scheduling:
        query += """
            AND p.geographic_cluster IS NOT NULL AND TRIM(p.geographic_cluster) <> ''
            AND TRIM(COALESCE(p.external_metadata->>'latitude', p.external_metadata->>'lat', '')) NOT IN ('', '0', '0.0', 'null', 'None')
            AND TRIM(COALESCE(p.external_metadata->>'longitude', p.external_metadata->>'lon', p.external_metadata->>'lng', '')) NOT IN ('', '0', '0.0', 'null', 'None')
        """

    query += " ORDER BY p.full_name ASC;"

    rows = db.session.execute(text(query), {"as_of_date": as_of_date}).mappings().all()
    contacts = _decrypted_contacts(row["id"] for row in rows)

    patients = []
    for row in rows:
        parsed_lat, parsed_lon = logic.extract_lat_lon(row.get("external_metadata"))

        # Extra guard: exclude patients without valid coordinates from candidate pool
        if only_eligible_for_scheduling and (parsed_lat is None or parsed_lon is None):
            continue

        visit_count = row.get("completed_visit_count") or 0
        pid = str(row["id"])
        c = contacts.get(pid, {})
        patients.append({
            "id": pid,
            "name": row["full_name"],
            "uhid": row.get("uhid"),
            "hospital_uhid": row.get("hospital_uhid"),
            "registration_date": row["registration_date"],
            "last_visit_date": row.get("last_completed_visit_date"),
            "priority": row["patient_priority"] or "Medium",
            "zone": row["geographic_cluster"],
            "lat": parsed_lat,
            "lon": parsed_lon,
            "type": "new" if visit_count == 0 else "existing",
            "phone": c.get("phone", ""),
            "address": c.get("address", ""),
            "alternative_phone": row.get("alternative_phone"),
            "primary_caregiver_phone": row.get("primary_caregiver_phone"),
            "primary_caregiver_name": row.get("primary_caregiver_name"),
            "decision_maker_phone": row.get("decision_maker_phone"),
            "decision_maker_name": row.get("decision_maker_name"),
            "is_deceased": bool(row.get("is_deceased")) if row.get("is_deceased") is not None else False,
            "date_of_death": row.get("date_of_death"),
            "place_of_death": row.get("place_of_death"),
            "completed_bereavement_count": int(row.get("completed_bereavement_count") or 0),
            "has_completed_bereavement_visit": bool((row.get("completed_bereavement_count") or 0) > 0),
            "last_bereavement_visit_date": row.get("last_bereavement_visit_date"),
            "prior_bereavement_schedule_count": int(row.get("prior_bereavement_schedule_count") or 0),
            "last_prior_bereavement_schedule_date": row.get("last_prior_bereavement_schedule_date"),
        })
    return patients


def fetch_patient_zones() -> List[str]:
    """Zones in use by active patients (the vehicle form's zone choices)."""
    rows = db.session.execute(text("""
        SELECT DISTINCT geographic_cluster FROM patients
        WHERE care_status = 'active' AND is_active = True
          AND (is_deceased IS FALSE OR is_deceased IS NULL)
          AND geographic_cluster IS NOT NULL AND TRIM(geographic_cluster) <> ''
    """)).fetchall()
    return sorted({r[0] for r in rows}) or list(DEFAULT_ZONES)


# ---------------------------------------------------------------------------
# Draft reservations and timeline bookings
# ---------------------------------------------------------------------------

def cleanup_expired_draft_schedules(expiry_hours: float) -> int:
    """Delete unfinalized draft slots (status = 'pending') that have expired:
    1. updated_at older than expiry_hours (inactivity timeout), OR
    2. schedule_date < today (the schedule date has passed).
    Releases patients back to the candidate list.
    """
    try:
        result = db.session.execute(text("""
            DELETE FROM daily_vehicle_schedules
            WHERE status = 'pending'
              AND (
                  updated_at < NOW() - (:expiry_hours * INTERVAL '1 hour')
                  OR schedule_date < :today
              );
        """), {"expiry_hours": expiry_hours, "today": date.today()})
        db.session.commit()
        return result.rowcount
    except Exception as e:
        db.session.rollback()
        print(f"Error cleaning up expired drafts: {e}")
        return 0


def fetch_active_timeline_bookings(expiry_hours: float, exclude_date: Optional[date] = None) -> Dict[str, List[Dict[str, Any]]]:
    """All bookings on the calendar keyed by patient id, sorted by date:
    unexpired drafts and locked runs from today on, plus every completed visit.
    """
    cleanup_expired_draft_schedules(expiry_hours)
    query = """
        SELECT patient_id, schedule_date, status, created_at, updated_at
        FROM daily_vehicle_schedules
        WHERE (
            (status = 'pending' AND updated_at >= NOW() - (:expiry_hours * INTERVAL '1 hour') AND schedule_date >= :today)
            OR (status = 'active' AND schedule_date >= :today)
            OR (status = 'completed')
        )
    """
    params: Dict[str, Any] = {"expiry_hours": expiry_hours, "today": date.today()}
    if exclude_date:
        query += " AND schedule_date <> :exclude_date"
        params["exclude_date"] = exclude_date
    query += " ORDER BY schedule_date ASC;"

    bookings: Dict[str, List[Dict[str, Any]]] = {}
    for r in db.session.execute(text(query), params).mappings().all():
        dt = r["schedule_date"]
        if isinstance(dt, str):
            dt = datetime.strptime(dt[:10], "%Y-%m-%d").date()
        bookings.setdefault(str(r["patient_id"]), []).append({
            "schedule_date": dt,
            "status": r["status"],
            "created_at": r.get("created_at"),
            "updated_at": r.get("updated_at"),
        })
    return bookings


def delete_draft_schedule(schedule_date: date) -> int:
    """Delete an unfinalized draft for a date. Locked or finished visits cannot be deleted."""
    if schedule_date < date.today():
        raise ValueError(f"Schedule date {schedule_date} has already passed and cannot be modified.")
    try:
        non_pending = db.session.execute(text("""
            SELECT COUNT(*) FROM daily_vehicle_schedules
            WHERE schedule_date = :d AND status != 'pending'
        """), {"d": schedule_date}).scalar()
        if non_pending > 0:
            raise ValueError("Cannot delete draft: this schedule contains locked/active visits.")
        deleted = db.session.execute(text(
            "DELETE FROM daily_vehicle_schedules WHERE schedule_date = :d AND status = 'pending'"
        ), {"d": schedule_date}).rowcount
        db.session.execute(text("DELETE FROM daily_vehicle_routes WHERE schedule_date = :d"), {"d": schedule_date})
        db.session.commit()
        return deleted
    except Exception:
        db.session.rollback()
        raise


# ---------------------------------------------------------------------------
# Schedules
# ---------------------------------------------------------------------------

def has_vehicle_log_for_date(schedule_date: date) -> bool:
    count = db.session.execute(
        text("SELECT COUNT(*) FROM vehicle_logs WHERE date = :d"), {"d": schedule_date}
    ).scalar()
    return bool(count and count > 0)


def fetch_schedule_overview(start_date: date, end_date: date, expiry_hours: float) -> List[Dict[str, Any]]:
    """Per-date summaries: Completed (vehicle log recorded), Closed (past), Active (locked), Pending (draft)."""
    cleanup_expired_draft_schedules(expiry_hours)
    rows = db.session.execute(text("""
        SELECT
            dvs.schedule_date,
            COUNT(*) as assigned_count,
            SUM(CASE WHEN dvs.status = 'pending' THEN 0 ELSE 1 END) as active_count,
            (SELECT COUNT(*) FROM vehicle_logs vl WHERE vl.date = dvs.schedule_date) as log_count
        FROM daily_vehicle_schedules dvs
        WHERE dvs.schedule_date BETWEEN :start AND :end
        GROUP BY dvs.schedule_date
        ORDER BY dvs.schedule_date ASC;
    """), {"start": start_date, "end": end_date}).mappings().all()

    today_val = date.today()
    records = []
    for r in rows:
        dt = logic._parse_date(r["schedule_date"])
        records.append({
            "date": dt.isoformat(),
            "status": logic.overview_status(dt, r["active_count"] or 0, r.get("log_count") or 0, today_val),
            "patients_count": r["assigned_count"],
        })
    return records


def fetch_schedule_slots(schedule_date: date, expiry_hours: float) -> List[Dict[str, Any]]:
    """Slots for a date joined with patient info. ``id`` is the patient id and
    ``slot_id`` the schedule row id, as in the Streamlit console."""
    cleanup_expired_draft_schedules(expiry_hours)
    rows = db.session.execute(text("""
        SELECT
            s.id as slot_id,
            s.patient_id,
            s.vehicle_id,
            s.slot_order,
            s.status as slot_status,
            s.priority_at_visit,
            s.patient_type_at_visit,
            s.gap_days_at_visit,
            s.urgency_score_at_visit,
            s.homecare_days_at_schedule,
            s.sla_days_at_visit,
            s.drive_distance_km,
            s.drive_duration_min,
            COALESCE(s.visit_type, CASE WHEN s.patient_type_at_visit = 'new' THEN 'initial' ELSE 'follow_up' END) as visit_type,
            s.created_at as slot_created_at,
            s.updated_at as slot_updated_at,
            p.full_name,
            p.uhid,
            p.hospital_uhid,
            p.geographic_cluster,
            p.external_metadata,
            p.alternative_phone,
            p.primary_caregiver_phone,
            p.primary_caregiver_name,
            p.decision_maker_phone,
            p.decision_maker_name,
            p.is_deceased,
            p.date_of_death
        FROM daily_vehicle_schedules s
        JOIN patients p ON s.patient_id = p.id
        WHERE s.schedule_date = :d
        ORDER BY s.slot_order ASC;
    """), {"d": schedule_date}).mappings().all()

    contacts = _decrypted_contacts({r["patient_id"] for r in rows})
    slots = []
    for r in rows:
        lat, lon = logic.extract_lat_lon(r.get("external_metadata"))
        pid = str(r["patient_id"])
        c = contacts.get(pid, {})
        slots.append({
            "id": pid,
            "name": r["full_name"],
            "uhid": r.get("uhid"),
            "hospital_uhid": r.get("hospital_uhid"),
            "phone": c.get("phone", ""),
            "address": c.get("address", ""),
            "alternative_phone": r.get("alternative_phone"),
            "primary_caregiver_phone": r.get("primary_caregiver_phone"),
            "primary_caregiver_name": r.get("primary_caregiver_name"),
            "decision_maker_phone": r.get("decision_maker_phone"),
            "decision_maker_name": r.get("decision_maker_name"),
            "is_deceased": bool(r.get("is_deceased")) if r.get("is_deceased") is not None else False,
            "date_of_death": r.get("date_of_death"),
            "zone": r["geographic_cluster"],
            "lat": lat,
            "lon": lon,
            "slot_id": str(r["slot_id"]),
            "vehicle_id": str(r["vehicle_id"]) if r["vehicle_id"] else None,
            "slot_order": r["slot_order"],
            "status": r["slot_status"],
            "visit_type": r.get("visit_type") or ("initial" if r.get("patient_type_at_visit") == "new" else "follow_up"),
            "priority_at_visit": r["priority_at_visit"],
            "patient_type_at_visit": r["patient_type_at_visit"],
            "gap_days_at_visit": r["gap_days_at_visit"],
            "urgency_score_at_visit": float(r["urgency_score_at_visit"]) if r["urgency_score_at_visit"] is not None else None,
            "homecare_days_at_schedule": r.get("homecare_days_at_schedule"),
            "sla_days_at_visit": r.get("sla_days_at_visit"),
            "drive_distance_km": float(r["drive_distance_km"]) if r["drive_distance_km"] is not None else None,
            "drive_duration_min": float(r["drive_duration_min"]) if r["drive_duration_min"] is not None else None,
            "created_at": r.get("slot_created_at"),
            "updated_at": r.get("slot_updated_at"),
        })
    return slots


def save_schedule_slots(schedule_date: date, assignments: List[Dict[str, Any]], expiry_hours: float,
                        fallback_config: Dict[str, Any]) -> None:
    """Save a date's assignments: rows for patients no longer listed are deleted,
    listed patients are updated in place (status kept) or inserted as 'pending'.

    Assignments use the planning-board keys: patient_id, vehicle_id, slot_order,
    priority, type, visit_type, gap, urgency, homecare_days, sla_days.
    """
    if schedule_date < date.today():
        cleanup_expired_draft_schedules(expiry_hours)
        raise ValueError(f"Schedule date {schedule_date} has already passed. The schedule date has surpassed and draft changes cannot be saved.")

    cleanup_expired_draft_schedules(expiry_hours)
    try:
        existing_map = {
            str(row[0]): str(row[1])
            for row in db.session.execute(
                text("SELECT patient_id, id FROM daily_vehicle_schedules WHERE schedule_date = :d"),
                {"d": schedule_date},
            ).fetchall()
        }
        assigned_ids = [str(a["patient_id"]) for a in assignments]

        for pid, slot_id in existing_map.items():
            if pid not in assigned_ids:
                db.session.execute(text("DELETE FROM daily_vehicle_schedules WHERE id = :id"), {"id": slot_id})

        fallback_weekdays = logic.homecare_days_string(fallback_config)

        for a in assignments:
            pid = str(a["patient_id"])
            hc_days = a.get("homecare_days_at_schedule") or a.get("homecare_days")
            if hc_days is None:
                hc_days = fallback_weekdays
            elif isinstance(hc_days, list):
                hc_days = ", ".join(hc_days)

            sla_val = a.get("sla_days_at_visit") or a.get("sla_days")
            if sla_val is None and fallback_config:
                sla_val = fallback_config.get(a.get("priority", "Medium"), 4)

            v_type = a.get("visit_type") or ("initial" if str(a.get("type", "")).lower() == "new" else "follow_up")

            params = {
                "vid": str(a["vehicle_id"]),
                "slot_order": a.get("slot_order", 1),
                "priority": a.get("priority"),
                "type": a.get("type"),
                "gap": a.get("gap"),
                "urgency": a.get("urgency"),
                "hc_days": hc_days,
                "sla": sla_val,
                "v_type": v_type,
            }
            if pid in existing_map:
                db.session.execute(text("""
                    UPDATE daily_vehicle_schedules
                    SET vehicle_id = :vid,
                        slot_order = :slot_order,
                        priority_at_visit = :priority,
                        patient_type_at_visit = :type,
                        gap_days_at_visit = :gap,
                        urgency_score_at_visit = :urgency,
                        homecare_days_at_schedule = COALESCE(:hc_days, homecare_days_at_schedule),
                        sla_days_at_visit = COALESCE(:sla, sla_days_at_visit),
                        visit_type = COALESCE(:v_type, visit_type),
                        updated_at = NOW()
                    WHERE id = :slot_id;
                """), {**params, "slot_id": existing_map[pid]})
            else:
                db.session.execute(text("""
                    INSERT INTO daily_vehicle_schedules (
                        id, schedule_date, patient_id, vehicle_id, slot_order, status,
                        priority_at_visit, patient_type_at_visit, gap_days_at_visit, urgency_score_at_visit,
                        homecare_days_at_schedule, sla_days_at_visit, visit_type,
                        created_at, updated_at
                    ) VALUES (gen_random_uuid(), :d, :pid, :vid, :slot_order, 'pending', :priority, :type, :gap, :urgency, :hc_days, :sla, :v_type, NOW(), NOW());
                """), {**params, "d": schedule_date, "pid": pid})
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise


def lock_and_optimize_schedule(schedule_date: date, optimized_slots: List[Dict[str, Any]], expiry_hours: float) -> None:
    """Save finalized route order and driving metrics and mark the slots 'active'."""
    if schedule_date < date.today():
        cleanup_expired_draft_schedules(expiry_hours)
        raise ValueError(f"Schedule date {schedule_date} has already passed. The schedule date has surpassed and cannot be locked.")
    cleanup_expired_draft_schedules(expiry_hours)
    try:
        for slot in optimized_slots:
            db.session.execute(text("""
                UPDATE daily_vehicle_schedules
                SET slot_order = :slot_order,
                    status = 'active',
                    drive_distance_km = :dist,
                    drive_duration_min = :dur,
                    updated_at = NOW()
                WHERE schedule_date = :d AND patient_id = :pid;
            """), {
                "slot_order": slot["slot_order"],
                "dist": slot.get("drive_distance_km"),
                "dur": slot.get("drive_duration_min"),
                "d": schedule_date,
                "pid": str(slot["patient_id"]),
            })
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise


def log_visit_completion(schedule_date: date, patient_id: str, status: str) -> None:
    """Record a visit outcome ('completed' or 'failed') for a patient's slot on a date."""
    if schedule_date < date.today():
        raise ValueError(f"Schedule for {schedule_date} has ended and is closed. Visit outcome modifications are no longer accepted.")
    try:
        db.session.execute(text("""
            UPDATE daily_vehicle_schedules
            SET status = :status, updated_at = NOW()
            WHERE schedule_date = :d AND patient_id = :pid;
        """), {"status": status, "d": schedule_date, "pid": str(patient_id)})
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise


def add_extra_active_visit(schedule_date: date, patient_id: str, vehicle_id: str, slot_order: int,
                           priority: str, p_type: str, gap: int, urgency: float,
                           dist_km: Optional[float], dur_min: Optional[float],
                           homecare_days: str, sla_days: int, visit_type: str) -> None:
    """Append a patient visit to a locked vehicle run as an 'active' slot."""
    try:
        db.session.execute(text("""
            INSERT INTO daily_vehicle_schedules (
                id, schedule_date, patient_id, vehicle_id, slot_order, status,
                priority_at_visit, patient_type_at_visit, gap_days_at_visit, urgency_score_at_visit,
                homecare_days_at_schedule, sla_days_at_visit, visit_type,
                drive_distance_km, drive_duration_min, created_at, updated_at
            ) VALUES (gen_random_uuid(), :d, :pid, :vid, :slot_order, 'active', :priority, :type, :gap, :urgency,
                      :hc_days, :sla, :v_type, :dist, :dur, NOW(), NOW());
        """), {
            "d": schedule_date, "pid": str(patient_id), "vid": str(vehicle_id), "slot_order": slot_order,
            "priority": priority, "type": p_type, "gap": gap, "urgency": urgency,
            "hc_days": homecare_days, "sla": sla_days, "v_type": visit_type,
            "dist": dist_km, "dur": dur_min,
        })
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise


# ---------------------------------------------------------------------------
# Vehicle logs and route links
# ---------------------------------------------------------------------------

def fetch_vehicle_log(vehicle_id: str, log_date: date) -> Optional[Dict[str, Any]]:
    row = db.session.execute(text(
        "SELECT * FROM vehicle_logs WHERE vehicle_id = :vid AND date = :d LIMIT 1"
    ), {"vid": str(vehicle_id), "d": log_date}).mappings().first()
    if not row:
        return None
    out = {}
    for k, v in dict(row).items():
        if hasattr(v, "isoformat"):
            v = v.isoformat()
        elif k in ("opening_kms", "closing_kms", "number_of_kms", "fuel_liters", "mileage") and v is not None:
            v = float(v)
        elif k in ("id", "vehicle_id", "schedule_day_id") and v is not None:
            v = str(v)
        out[k] = v
    return out


def fetch_last_closing_kms(vehicle_id: str) -> float:
    row = db.session.execute(text(
        "SELECT closing_kms FROM vehicle_logs WHERE vehicle_id = :vid ORDER BY date DESC, created_at DESC LIMIT 1"
    ), {"vid": str(vehicle_id)}).fetchone()
    return float(row[0]) if row and row[0] is not None else 0.0


def create_vehicle_log(log_data: Dict[str, Any]) -> None:
    try:
        db.session.execute(text("""
            INSERT INTO vehicle_logs (
                id, vehicle_id, date, driver_name, opening_kms, closing_kms,
                number_of_kms, start_point, destination_point, fuel_liters, mileage,
                created_at, updated_at
            ) VALUES (gen_random_uuid(), :vehicle_id, :date, :driver_name, :opening_kms, :closing_kms,
                      :number_of_kms, :start_point, :destination_point, :fuel_liters, :mileage, NOW(), NOW())
        """), {k: log_data.get(k) for k in (
            "vehicle_id", "date", "driver_name", "opening_kms", "closing_kms",
            "number_of_kms", "start_point", "destination_point", "fuel_liters", "mileage",
        )})
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise


def save_daily_vehicle_route(schedule_date: date, vehicle_id: str, round_trip_url: str, one_way_url: str,
                             round_trip_short_url: Optional[str] = None, one_way_short_url: Optional[str] = None) -> None:
    try:
        db.session.execute(text("""
            INSERT INTO daily_vehicle_routes (
                id, schedule_date, vehicle_id, round_trip_url, one_way_url,
                round_trip_short_url, one_way_short_url, created_at, updated_at
            ) VALUES (gen_random_uuid(), :d, :vid, :rt, :ow, :rt_short, :ow_short, NOW(), NOW())
            ON CONFLICT (vehicle_id, schedule_date) DO UPDATE SET
                round_trip_url = EXCLUDED.round_trip_url,
                one_way_url = EXCLUDED.one_way_url,
                round_trip_short_url = EXCLUDED.round_trip_short_url,
                one_way_short_url = EXCLUDED.one_way_short_url,
                updated_at = NOW();
        """), {
            "d": schedule_date, "vid": str(vehicle_id), "rt": round_trip_url, "ow": one_way_url,
            "rt_short": round_trip_short_url, "ow_short": one_way_short_url,
        })
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"Error saving daily_vehicle_routes to DB: {e}")


def fetch_daily_vehicle_routes(schedule_date: date) -> Dict[str, Dict[str, Any]]:
    rows = db.session.execute(text("""
        SELECT vehicle_id, round_trip_url, one_way_url, round_trip_short_url, one_way_short_url
        FROM daily_vehicle_routes
        WHERE schedule_date = :d;
    """), {"d": schedule_date}).mappings().all()
    return {str(r["vehicle_id"]): {**dict(r), "vehicle_id": str(r["vehicle_id"])} for r in rows}


# ---------------------------------------------------------------------------
# Completion report
# ---------------------------------------------------------------------------

def fetch_report_dates() -> List[date]:
    rows = db.session.execute(text(
        "SELECT DISTINCT schedule_date FROM daily_vehicle_schedules ORDER BY schedule_date DESC;"
    )).fetchall()
    return [r[0] for r in rows]


def fetch_completion_report(selected_date: date) -> List[Dict[str, Any]]:
    """A date's slots with patient, vehicle and stored route links, ordered by vehicle then stop."""
    rows = db.session.execute(text("""
        SELECT
            s.id,
            s.schedule_date,
            s.slot_order,
            s.status,
            s.priority_at_visit,
            s.patient_type_at_visit,
            s.gap_days_at_visit,
            s.urgency_score_at_visit,
            s.drive_distance_km,
            s.drive_duration_min,
            COALESCE(s.visit_type, CASE WHEN s.patient_type_at_visit = 'new' THEN 'initial' ELSE 'follow_up' END) as visit_type,
            p.full_name as patient_name,
            p.uhid as patient_uhid,
            p.geographic_cluster as patient_zone,
            p.external_metadata as patient_external_metadata,
            v.id as vehicle_id,
            v.name as vehicle_name,
            v.registration_number as vehicle_reg_number,
            v.base_hospital,
            r.round_trip_url,
            r.one_way_url,
            r.round_trip_short_url,
            r.one_way_short_url
        FROM daily_vehicle_schedules s
        JOIN patients p ON s.patient_id = p.id
        JOIN vehicles v ON s.vehicle_id = v.id
        LEFT JOIN daily_vehicle_routes r
            ON r.vehicle_id = s.vehicle_id AND r.schedule_date = s.schedule_date
        WHERE s.schedule_date = :d
        ORDER BY v.name ASC, s.slot_order ASC;
    """), {"d": selected_date}).mappings().all()

    out = []
    for r in rows:
        row = dict(r)
        ext_meta = row.pop("patient_external_metadata", None) or {}
        if isinstance(ext_meta, str):
            try:
                ext_meta = json.loads(ext_meta)
            except Exception:
                ext_meta = {}
        lat = ext_meta.get("latitude") or ext_meta.get("lat")
        lon = ext_meta.get("longitude") or ext_meta.get("lon") or ext_meta.get("lng")
        row["lat"] = float(lat) if lat is not None else None
        row["lon"] = float(lon) if lon is not None else None
        row["id"] = str(row["id"])
        row["vehicle_id"] = str(row["vehicle_id"])
        for k in ("drive_distance_km", "drive_duration_min", "urgency_score_at_visit"):
            if row.get(k) is not None:
                row[k] = float(row[k])
        out.append(row)
    return out
