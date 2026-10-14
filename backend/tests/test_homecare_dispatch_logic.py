"""Unit tests for the homecare dispatch scheduling rules (pure functions, no database)."""
from datetime import date, datetime, timedelta, timezone

import pytest

from app.homecare_dispatch import logic as dl

CONFIG = {
    "Emergency": 1, "Urgent": 1, "High": 4, "Medium": 8, "Low": 16, "New": 4,
    "weight_Emergency": 150, "weight_Urgent": 125, "weight_High": 100,
    "weight_New": 75, "weight_Medium": 50, "weight_Low": 25,
    "homecare_weekdays": ["Monday", "Tuesday", "Thursday", "Friday"],
}
WEEKDAYS = {0, 1, 3, 4}
THU = date(2026, 10, 1)  # a Thursday


def patient(pid, **kw):
    base = {
        "id": pid, "name": f"Patient {pid}", "uhid": f"U-{pid}", "zone": "North",
        "priority": "Medium", "type": "existing", "registration_date": None,
        "last_visit_date": None, "lat": 13.03, "lon": 77.59, "is_deceased": False,
    }
    base.update(kw)
    return base


def vehicle(vid, zones, lat=12.9716, lon=77.5946, capacity=5):
    return {"id": vid, "name": f"Vehicle {vid}", "zones": zones,
            "depot_lat": lat, "depot_lon": lon, "capacity": capacity}


# --- homecare day counting -------------------------------------------------

def test_count_homecare_days_skips_non_operational_weekdays():
    # Mon 28 Sep -> Mon 5 Oct: Tue, Thu, Fri, Mon count; Wed, Sat, Sun do not.
    assert dl.count_homecare_days(date(2026, 9, 28), date(2026, 10, 5), WEEKDAYS) == 4


def test_count_homecare_days_is_zero_when_start_not_before_end():
    assert dl.count_homecare_days(THU, THU, WEEKDAYS) == 0
    assert dl.count_homecare_days(THU, THU - timedelta(days=3), WEEKDAYS) == 0


# --- scoring --------------------------------------------------------------

def test_score_uses_weighted_formula():
    # Last visit Mon 21 Sep -> Thu 1 Oct = 6 homecare days; High SLA 4.
    p = dl.score_patient(patient("a", priority="High", last_visit_date="2026-09-21"), CONFIG, THU, WEEKDAYS)
    assert p["gap_days"] == 6
    assert p["urgency_score"] == pytest.approx(0.9 * 100 + 0.1 * (6 / 4))
    assert p["overdue"] is True
    assert p["tier_rank"] == 3


def test_zero_gap_scores_zero():
    p = dl.score_patient(patient("a", last_visit_date=THU.isoformat()), CONFIG, THU, WEEKDAYS)
    assert p["gap_days"] == 0
    assert p["urgency_score"] == 0.0


def test_new_patient_goes_to_new_bucket_from_registration_date():
    p = dl.score_patient(patient("a", type="new", priority="High", registration_date="2026-09-28"), CONFIG, THU, WEEKDAYS)
    assert p["priority"] == "New"
    assert p["sla_days"] == 4
    assert p["reference_date"] == "2026-09-28"
    assert p["urgency_score"] == pytest.approx(0.9 * 75 + 0.1 * (dl.count_homecare_days(date(2026, 9, 28), THU, WEEKDAYS) / 4))


def test_new_emergency_patient_keeps_emergency_priority():
    p = dl.score_patient(patient("a", type="new", priority="Emergency", registration_date="2026-09-28"), CONFIG, THU, WEEKDAYS)
    assert p["priority"] == "Emergency"
    assert p["sla_days"] == 1


def test_missing_priority_defaults_to_medium():
    p = dl.score_patient(patient("a", priority=None, last_visit_date="2026-09-21"), CONFIG, THU, WEEKDAYS)
    assert p["priority"] == "Medium"
    assert p["sla_days"] == 8


def test_earlier_booking_becomes_reference_and_makes_new_patient_existing():
    bookings = [
        {"schedule_date": date(2026, 9, 29), "status": "pending"},
        {"schedule_date": THU, "status": "active"},
        {"schedule_date": date(2026, 10, 5), "status": "pending"},
    ]
    p = dl.score_patient(
        patient("a", type="new", priority="High", registration_date="2026-09-01"),
        CONFIG, THU, WEEKDAYS, timeline_bookings=bookings,
    )
    assert p["type"] == "existing"
    assert p["priority"] == "High"
    assert p["reference_date"] == "2026-09-29"
    assert p["gap_days"] == 1  # only Thursday counts after Tue 29 Sep
    assert p["is_booked_on_today"] is True
    assert [b["schedule_date"] for b in p["future_bookings"]] == [date(2026, 10, 5)]


def test_tier_outranks_overdue_in_sort_order():
    high = dl.score_patient(patient("h", priority="High", last_visit_date="2026-09-30"), CONFIG, THU, WEEKDAYS)
    low = dl.score_patient(patient("l", priority="Low", last_visit_date="2026-06-01"), CONFIG, THU, WEEKDAYS)
    assert low["overdue"] and not high["overdue"]
    assert sorted([low, high], key=dl.urgency_sort_key)[0]["id"] == "h"


# --- auto-draft -----------------------------------------------------------

def test_auto_draft_filters_and_assigns_by_zone():
    patients = [
        patient("due", last_visit_date="2026-09-21"),
        patient("not_due", last_visit_date=THU.isoformat()),
        patient("dead", last_visit_date="2026-09-21", is_deceased=True),
        patient("no_vehicle", zone="West", last_visit_date="2026-09-21"),
    ]
    slots = dl.calculate_draft_schedule(patients, [vehicle("v1", ["North"])], THU, WEEKDAYS, CONFIG)
    assert [s["patient_id"] for s in slots] == ["due"]
    assert slots[0]["status"] == "pending"
    assert slots[0]["visit_type"] == "follow_up"


def test_auto_draft_has_no_capacity_limit():
    patients = [patient(str(i), last_visit_date="2026-09-21") for i in range(8)]
    slots = dl.calculate_draft_schedule(patients, [vehicle("v1", ["North"], capacity=2)], THU, WEEKDAYS, CONFIG)
    assert len(slots) == 8
    assert [s["slot_order"] for s in slots] == list(range(1, 9))


def test_auto_draft_orders_run_by_urgency():
    patients = [
        patient("low", priority="Low", last_visit_date="2026-09-01"),
        patient("high", priority="High", last_visit_date="2026-09-29"),
        patient("new", type="new", registration_date="2026-09-21"),
    ]
    slots = dl.calculate_draft_schedule(patients, [vehicle("v1", ["North"])], THU, WEEKDAYS, CONFIG)
    assert [s["patient_id"] for s in slots] == ["high", "new", "low"]
    assert slots[1]["visit_type"] == "initial"


def test_auto_draft_shared_zone_goes_to_nearest_vehicle():
    near_a = patient("near_a", lat=13.10, lon=77.60, last_visit_date="2026-09-21")
    near_b = patient("near_b", lat=12.90, lon=77.60, last_visit_date="2026-09-21")
    vehicles = [vehicle("A", ["North"], lat=13.11, lon=77.60), vehicle("B", ["north "], lat=12.89, lon=77.60)]
    slots = dl.calculate_draft_schedule([near_a, near_b], vehicles, THU, WEEKDAYS, CONFIG)
    assert {s["patient_id"]: s["vehicle_id"] for s in slots} == {"near_a": "A", "near_b": "B"}


def test_apply_auto_draft_keeps_bereavement_visits_first():
    board = [{"patient_id": "fam", "vehicle_id": "v1", "slot_order": 3, "visit_type": "bereavement"},
             {"patient_id": "old", "vehicle_id": "v1", "slot_order": 1, "visit_type": "follow_up"}]
    suggested = dl.calculate_draft_schedule(
        [patient("due", last_visit_date="2026-09-21")], [vehicle("v1", ["North"])], THU, WEEKDAYS, CONFIG)
    draft = dl.apply_auto_draft(board, suggested, [vehicle("v1", ["North"])], CONFIG)
    assert [(s["patient_id"], s["slot_order"]) for s in draft] == [("fam", 1), ("due", 2)]
    assert draft[1]["homecare_days"] == "Monday, Tuesday, Thursday, Friday"
    assert draft[1]["sla_days"] == 8


# --- bereavement ------------------------------------------------------------

def test_bereavement_status_and_sort():
    unvisited = {"id": "u", "name": "U", "date_of_death": date(2026, 9, 20)}
    visited = {"id": "v", "name": "V", "date_of_death": date(2026, 9, 1),
               "has_completed_bereavement_visit": True, "completed_bereavement_count": 1,
               "last_bereavement_visit_date": date(2026, 9, 10)}
    m_u = dl.bereavement_status(unvisited, THU, [])
    m_v = dl.bereavement_status(visited, THU, [])
    assert m_u == {"is_previously_addressed": False, "b_status": "🕊️ Pending (Not Visited)"}
    assert m_v["is_previously_addressed"] and m_v["b_status"].startswith("✅ Visited (1x)")
    ordered = sorted([(visited, m_v), (unvisited, m_u)], key=lambda t: dl.bereavement_sort_key(*t))
    assert ordered[0][0]["id"] == "u"


def test_bereavement_assignment_fields():
    a = dl.bereavement_assignment({"id": "d", "date_of_death": date(2026, 9, 21)}, "v1", THU, CONFIG)
    assert a["visit_type"] == "bereavement"
    assert (a["priority"], a["type"], a["urgency"], a["sla_days"], a["gap"]) == ("Medium", "existing", 0.0, 4, 10)


# --- live dispatch ----------------------------------------------------------

def test_swap_candidates_for_alive_stop_are_scored_and_zone_limited():
    alive = [
        patient("assigned", last_visit_date="2026-09-01"),
        patient("other_zone", zone="South", last_visit_date="2026-09-01"),
        patient("low", priority="Low", last_visit_date="2026-09-01"),
        patient("high", priority="High", last_visit_date="2026-09-29"),
    ]
    cands = dl.swap_candidates({"visit_type": "follow_up"}, vehicle("v1", ["North"]), {"assigned"},
                               alive, [], CONFIG, THU, WEEKDAYS)
    assert [c["id"] for c in cands] == ["high", "low"]
    assert cands[0]["visit_type"] == "follow_up"


def test_swap_candidates_for_bereavement_stop_are_deceased_families():
    deceased = [
        {"id": "visited", "name": "B", "zone": "North", "date_of_death": date(2026, 9, 1), "has_completed_bereavement_visit": True},
        {"id": "pending", "name": "A", "zone": "North", "date_of_death": date(2026, 9, 25)},
    ]
    cands = dl.swap_candidates({"visit_type": "bereavement"}, vehicle("v1", ["North"]), set(),
                               [], deceased, CONFIG, THU, WEEKDAYS)
    assert [c["id"] for c in cands] == ["pending", "visited"]
    assert cands[0]["gap"] == 6 and cands[0]["visit_type"] == "bereavement"


def test_swap_assignments_replace_only_the_failed_patient():
    current = [
        {"id": "p1", "vehicle_id": "v1", "slot_order": 1, "priority_at_visit": "High", "patient_type_at_visit": "existing",
         "visit_type": "follow_up", "gap_days_at_visit": 5, "urgency_score_at_visit": 90.1,
         "homecare_days_at_schedule": "Monday", "sla_days_at_visit": 4},
        {"id": "p2", "vehicle_id": "v1", "slot_order": 2, "priority_at_visit": "Low", "patient_type_at_visit": "existing",
         "visit_type": "follow_up", "gap_days_at_visit": 20, "urgency_score_at_visit": 22.6,
         "homecare_days_at_schedule": None, "sla_days_at_visit": None},
    ]
    rep = {"id": "p9", "priority": "Medium", "type": "new", "visit_type": "initial", "gap": 3, "urgency_score": 45.3}
    out = dl.swap_assignments(current, "p2", "v1", rep, CONFIG)
    assert [a["patient_id"] for a in out] == ["p1", "p9"]
    assert out[1]["slot_order"] == 2 and out[1]["sla_days"] == 8
    assert out[0]["homecare_days"] == "Monday"


# --- draft expiry and status ------------------------------------------------

def _state(updated_at, now_utc, now_local, schedule_date=THU, today=THU, locked=False, hours=1.0):
    slots = [{"updated_at": updated_at}]
    return dl.compute_draft_state(schedule_date, slots, locked, hours, today, now_utc, now_local)


def test_draft_expires_after_inactivity():
    now = datetime(2026, 10, 1, 6, 0, tzinfo=timezone.utc)
    s = _state(datetime(2026, 10, 1, 4, 30), now, datetime(2026, 10, 1, 11, 30))
    assert s["is_draft_expired"] and not s["is_date_surpassed_expired"]


def test_draft_remaining_time_capped_at_midnight():
    now = datetime(2026, 10, 1, 18, 10, tzinfo=timezone.utc)
    s = _state(datetime(2026, 10, 1, 18, 0), now, datetime(2026, 10, 1, 23, 40), hours=2.0)
    assert not s["is_draft_expired"]
    assert s["is_capped_by_midnight"]
    assert s["draft_remaining_str"] == "19 mins (Date Ends at Midnight)"


def test_draft_for_past_date_is_expired_and_locked_is_not():
    now = datetime(2026, 10, 2, 6, 0, tzinfo=timezone.utc)
    past = _state(datetime(2026, 10, 1, 4, 0), now, datetime(2026, 10, 2, 11, 30), today=date(2026, 10, 2))
    assert past["is_date_surpassed_expired"]
    locked = _state(datetime(2026, 10, 1, 4, 0), now, datetime(2026, 10, 2, 11, 30), today=date(2026, 10, 2), locked=True)
    assert not locked["is_draft_expired"]


def test_overview_status():
    assert dl.overview_status(THU, 0, 1, THU) == "completed"
    assert dl.overview_status(THU - timedelta(days=1), 3, 0, THU) == "closed"
    assert dl.overview_status(THU, 2, 0, THU) == "active"
    assert dl.overview_status(THU, 0, 0, THU) == "pending"


# --- routing ----------------------------------------------------------------

def test_nearest_neighbor_route_uses_40kmh_estimate():
    depot = {"lat": 12.9716, "lon": 77.5946}
    stops = [{"id": "far", "lat": 13.05, "lon": 77.59}, {"id": "near", "lat": 12.98, "lon": 77.59}]
    route = dl.nearest_neighbor_route(depot, stops)
    assert [s["id"] for s in route] == ["near", "far"]
    first = route[0]
    assert first["drive_duration_min"] == pytest.approx(round(first["drive_distance_km"] / 40.0 * 60.0, 1), abs=0.11)


def test_optimize_vehicle_route_without_api_key_is_straight_line():
    route, method = dl.optimize_vehicle_route({"lat": 12.97, "lon": 77.59}, [{"id": "a", "lat": 12.98, "lon": 77.6}], "")
    assert method == "haversine" and route[0]["id"] == "a"


def test_abnormal_distance_patients():
    slots = {"v1": [{"id": "far", "name": "Far", "lat": 13.5, "lon": 77.59}, {"id": "ok", "name": "Ok", "lat": 12.98, "lon": 77.6}]}
    out = dl.abnormal_distance_patients(slots, [vehicle("v1", ["North"])], 40.0)
    assert [a["patient_id"] for a in out] == ["far"]


# --- zone boundaries ----------------------------------------------------------

def test_utm_projection_matches_pyproj():
    e, n = dl.project_utm43n(12.9716, 77.5946)
    assert e == pytest.approx(781481.0202947541, abs=0.001)
    assert n == pytest.approx(1435426.4069104537, abs=0.001)


def test_boundary_info_lists_nearby_zones_except_own():
    boundaries = dl.load_boundary_data()
    info = dl.get_patient_boundary_info(12.906158216777502, 77.66180772192081, boundaries, "North", 2.0)
    assert [c["nearby_zone"] for c in info][-1] == "East"
    assert {c["nearby_zone"] for c in info} == {"Central", "South", "East"}
    assert info[-1]["distance_m"] == pytest.approx(1593.31, abs=0.1)
    assert all("North" != c["nearby_zone"] for c in info)


def test_reassignment_suggests_vehicle_with_closer_stop():
    boundaries = dl.load_boundary_data()
    patients = [
        patient("edge", zone="North", lat=12.906158216777502, lon=77.66180772192081),
        patient("east_stop", zone="East", lat=12.91, lon=77.665),
        patient("north_stop", zone="North", lat=13.05, lon=77.59),
    ]
    vehicles = [vehicle("vn", ["North"]), vehicle("ve", ["East"])]
    draft = [{"patient_id": "edge", "vehicle_id": "vn"}, {"patient_id": "north_stop", "vehicle_id": "vn"},
             {"patient_id": "east_stop", "vehicle_id": "ve"}]
    sugs = dl.get_reassignment_suggestions(draft, patients, vehicles, boundaries, 2.0)
    assert [(s["patient_id"], s["suggested_vehicle_id"], s["closest_cand_stop"]) for s in sugs] == [("edge", "ve", "Patient east_stop")]
