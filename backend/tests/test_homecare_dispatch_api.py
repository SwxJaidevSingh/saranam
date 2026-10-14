"""Route tests for the homecare dispatch API: auth, error mapping and downloads.

Service calls are stubbed; no database is touched.
"""
from datetime import date
from types import SimpleNamespace

import pytest
from flask_jwt_extended import create_access_token

from app import create_app
from app.common.models import User
from app.homecare_dispatch import routes, service

BASE = "/api/homecare-dispatch"


@pytest.fixture(scope="module")
def app():
    return create_app("development")


@pytest.fixture(autouse=True)
def platform_user(monkeypatch):
    # The main-app gate looks the user up on every tokened request.
    monkeypatch.setattr(User, "query", SimpleNamespace(get=lambda _uid: SimpleNamespace(is_platform_admin=True)))


@pytest.fixture
def client(app):
    return app.test_client()


def auth(app, role):
    with app.app_context():
        token = create_access_token(identity="00000000-0000-0000-0000-000000000001", additional_claims={"role": role})
    return {"Authorization": f"Bearer {token}"}


def test_requires_login(client):
    assert client.get(f"{BASE}/settings").status_code == 401


def test_viewer_can_read_but_not_change(app, client, monkeypatch):
    monkeypatch.setattr(routes, "load_settings", lambda: {"High": 4})
    assert client.get(f"{BASE}/settings", headers=auth(app, "viewer")).get_json() == {"settings": {"High": 4}}
    assert client.put(f"{BASE}/settings", json={}, headers=auth(app, "viewer")).status_code == 403
    assert client.post(f"{BASE}/schedules/2026-10-01/lock", json={}, headers=auth(app, "viewer")).status_code == 403


def test_invalid_date_is_400(app, client):
    res = client.get(f"{BASE}/schedules/01-10-2026", headers=auth(app, "nurse"))
    assert res.status_code == 400 and "Invalid date" in res.get_json()["error"]


def test_concurrent_save_is_409(app, client, monkeypatch):
    def boom(*_a, **_k):
        raise service.ConcurrentScheduleEdit(7)
    monkeypatch.setattr(service, "save_draft", boom)
    res = client.put(f"{BASE}/schedules/2026-10-01/draft", json={"slots": []}, headers=auth(app, "nurse"))
    assert res.status_code == 409
    assert res.get_json() == {"error": "A schedule already exists for this date with 7 patient(s).",
                              "code": "concurrent_edit", "db_count": 7}


def test_save_passes_force_and_loaded_state(app, client, monkeypatch):
    seen = {}
    monkeypatch.setattr(service, "save_draft", lambda d, slots, count, updated, force=False: seen.update(
        d=d, slots=slots, count=count, updated=updated, force=force))
    body = {"slots": [{"patient_id": "p", "vehicle_id": "v"}], "loaded_slot_count": 3,
            "loaded_max_updated": "2026-10-01T04:00:00", "force": True}
    assert client.put(f"{BASE}/schedules/2026-10-01/draft", json=body, headers=auth(app, "admin")).status_code == 200
    assert seen == {"d": date(2026, 10, 1), "slots": body["slots"], "count": 3,
                    "updated": "2026-10-01T04:00:00", "force": True}


def test_service_errors_map_to_status_codes(app, client, monkeypatch):
    def missing(*_a):
        raise LookupError("Visit slot not found for this date.")
    monkeypatch.setattr(service, "set_visit_status", missing)
    res = client.post(f"{BASE}/schedules/2026-10-01/slots/x/status", json={"status": "completed"}, headers=auth(app, "nurse"))
    assert res.status_code == 404
    res = client.post(f"{BASE}/schedules/2026-10-01/slots/x/swap", json={}, headers=auth(app, "nurse"))
    assert res.status_code == 400 and "replacement_patient_id" in res.get_json()["error"]


def test_report_csv_download(app, client, monkeypatch):
    monkeypatch.setattr(service, "report_rows_and_metrics", lambda d: ([], {}, {}))
    res = client.get(f"{BASE}/reports/2026-10-01/csv", headers=auth(app, "viewer"))
    assert res.status_code == 200 and res.mimetype == "text/csv"
    assert res.headers["Content-Disposition"] == "attachment; filename=saranam_dispatch_report_2026-10-01.csv"
    assert res.get_data(as_text=True).startswith("Date,Vehicle Name")
