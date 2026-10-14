"""Unit tests for homecare dispatch settings, vehicle validation and the completion report."""
from datetime import date

import pytest

from app.homecare_dispatch import report, service
from app.homecare_dispatch.settings import DEFAULT_SETTINGS, SettingsValidationError, validate_settings


# --- settings ---------------------------------------------------------------

def test_default_settings_are_valid_and_match_streamlit():
    clean = validate_settings(DEFAULT_SETTINGS)
    assert clean["High"] == 4 and clean["weight_Emergency"] == 150
    assert clean["homecare_weekdays"] == ["Monday", "Tuesday", "Thursday", "Friday"]
    assert clean["draft_expiry_hours"] == 1.0 and clean["locked_expiry_hours"] == 24.0


@pytest.mark.parametrize("field,value", [
    ("Emergency", 0), ("Low", 181), ("weight_High", 501), ("boundary_buffer_km", 0.4),
    ("draft_expiry_hours", 0.2), ("locked_expiry_hours", 169), ("Medium", "abc"),
])
def test_settings_out_of_range_rejected(field, value):
    with pytest.raises(SettingsValidationError):
        validate_settings({**DEFAULT_SETTINGS, field: value})


def test_settings_require_a_weekday_and_keep_week_order():
    with pytest.raises(SettingsValidationError, match="at least one active weekday"):
        validate_settings({**DEFAULT_SETTINGS, "homecare_weekdays": []})
    clean = validate_settings({**DEFAULT_SETTINGS, "homecare_weekdays": ["Friday", "Monday"]})
    assert clean["homecare_weekdays"] == ["Monday", "Friday"]
    with pytest.raises(SettingsValidationError, match="Unknown weekday"):
        validate_settings({**DEFAULT_SETTINGS, "homecare_weekdays": ["Funday"]})


# --- vehicles ---------------------------------------------------------------

def test_validate_vehicle_normalises_payload():
    v = service.validate_vehicle({"name": "  Ambulance 3 ", "zones": ["North"], "capacity": "6",
                                  "registration_number": " ", "notes": ""})
    assert v == {"name": "Ambulance 3", "registration_number": None, "vehicle_type": "ambulance",
                 "capacity": 6, "is_active": True, "base_hospital": "KMIO", "zones": ["North"], "notes": None}


@pytest.mark.parametrize("payload,msg", [
    ({"zones": ["North"]}, "Vehicle Name is required"),
    ({"name": "A", "zones": []}, "At least one Service Zone"),
    ({"name": "A", "zones": ["North"], "capacity": 21}, "between 1 and 20"),
    ({"name": "A", "zones": ["North"], "vehicle_type": "bus"}, "Vehicle Type"),
])
def test_validate_vehicle_rejects(payload, msg):
    with pytest.raises(ValueError, match=msg):
        service.validate_vehicle(payload)


# --- completion report --------------------------------------------------------

def _row(vehicle, status, visit_type="follow_up", ptype="existing", order=1, lat=12.98, **extra):
    base = {
        "schedule_date": date(2026, 10, 1), "vehicle_name": vehicle, "vehicle_reg_number": f"KA-{vehicle}",
        "vehicle_id": f"id-{vehicle}", "base_hospital": "KMIO", "status": status, "visit_type": visit_type,
        "patient_type_at_visit": ptype, "slot_order": order, "patient_name": f"P{order}", "patient_uhid": f"U{order}",
        "patient_zone": "North", "priority_at_visit": "Medium", "urgency_score_at_visit": 45.3,
        "drive_distance_km": 2.345, "drive_duration_min": 7.2, "lat": lat, "lon": 77.6,
        "round_trip_url": None, "one_way_url": None, "round_trip_short_url": None, "one_way_short_url": None,
    }
    base.update(extra)
    return base


def test_report_metrics_counts_and_route_links():
    rows = [
        _row("A", "completed", order=1),
        _row("A", "failed", visit_type="initial", ptype="new", order=2),
        _row("A", "active", visit_type="bereavement", order=3),
        _row("B", "completed", order=1, round_trip_url="https://stored/rt", one_way_url="https://stored/ow"),
    ]
    saved = []
    metrics, vehicles = report.compile_report_metrics(
        rows, hospitals={}, shorten=lambda u: "short:" + u[-6:], save_route=lambda *a: saved.append(a))
    assert (metrics["total_patients"], metrics["completed"], metrics["failed"], metrics["pending"]) == (4, 2, 1, 1)
    assert metrics["completion_rate"] == pytest.approx(200 / 3)
    assert (metrics["initial_count"], metrics["followup_count"], metrics["bereavement_count"]) == (1, 2, 1)
    assert (metrics["completed_followup"], metrics["failed_initial"]) == (2, 1)
    assert vehicles["A"]["completed"] == 1 and vehicles["A"]["pending"] == 1
    # Vehicle A had no stored links: built from the fallback depot, shortened, saved once.
    assert vehicles["A"]["round_trip_url"].startswith("https://www.google.com/maps/dir/?api=1&origin=12.9716%2C77.5946")
    assert vehicles["A"]["round_trip_short_url"].startswith("short:")
    assert len(saved) == 1 and saved[0][1] == "id-A"
    # Vehicle B keeps its stored links.
    assert vehicles["B"]["round_trip_url"] == "https://stored/rt"


def test_report_csv_rows():
    rows = [_row("A", "completed", order=1, round_trip_short_url="https://s/rt", one_way_short_url="https://s/ow"),
            _row("A", "failed", visit_type="bereavement", order=2, drive_distance_km=None, drive_duration_min=None)]
    lines = report.generate_csv_data(rows).strip().splitlines()
    assert lines[0].startswith("Date,Vehicle Name,Vehicle Reg,Stop Order")
    assert lines[1].split(",")[6:9] == ["Follow-up Visit", "North", "Completed"]
    assert lines[1].endswith("2.35,7.2,https://s/rt,https://s/ow")
    assert ",Bereavement Visit," in lines[2] and ",0.00,0.0," in lines[2]


def test_report_pdf_is_generated():
    rows = [_row("A", "completed"), _row("A", "pending", order=2, drive_distance_km=None)]
    metrics, vehicles = report.compile_report_metrics(rows, hospitals={}, shorten=lambda u: u)
    pdf = report.generate_pdf_report(date(2026, 10, 1), metrics, vehicles)
    assert pdf.startswith(b"%PDF") and len(pdf) > 1500
