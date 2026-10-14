"""Route tests for the inventory API: auth, admin gating, error mapping, CSV.

Service and repository calls are stubbed; no database is touched.
"""
from types import SimpleNamespace

import pytest
from flask_jwt_extended import create_access_token

from app import create_app
from app.common.models import User
from app.inventory_app import repository as repo, routes, service

BASE = "/api/inventory"


@pytest.fixture(scope="module")
def app():
    return create_app("development")


@pytest.fixture(autouse=True)
def isolate(monkeypatch):
    monkeypatch.setattr(routes, "ensure_schema", lambda: None)
    # The main-app gate looks the user up on every tokened request.
    monkeypatch.setattr(User, "query", SimpleNamespace(get=lambda _uid: SimpleNamespace(is_platform_admin=True)))
    monkeypatch.setattr(repo, "user_email", lambda uid: "nurse@saranam.in")


@pytest.fixture
def client(app):
    return app.test_client()


def auth(app, role):
    with app.app_context():
        token = create_access_token(identity="00000000-0000-0000-0000-000000000001", additional_claims={"role": role})
    return {"Authorization": f"Bearer {token}"}


def test_requires_login(client):
    assert client.get(f"{BASE}/dashboard").status_code == 401


def test_any_role_can_search_medicines(app, client, monkeypatch):
    monkeypatch.setattr(repo, "search_medicines_for_prescriptions",
                        lambda q, limit: [{"id": "m1", "medicine_name": q, "dosage_form": "tablet"}])
    res = client.get(f"{BASE}/medicines/search?q=para", headers=auth(app, "doctor"))
    assert res.status_code == 200 and res.get_json() == [{"id": "m1", "medicine_name": "para", "dosage_form": "tablet"}]


def test_admin_pages_need_admin(app, client, monkeypatch):
    monkeypatch.setattr(repo, "users", lambda: [{"email": "a@x"}])
    assert client.get(f"{BASE}/admin/users", headers=auth(app, "nurse")).status_code == 403
    assert client.get(f"{BASE}/admin/users", headers=auth(app, "admin")).get_json() == {"users": [{"email": "a@x"}]}


def test_responses_keep_key_order(app, client, monkeypatch):
    # Table columns and source lists are shown in the order they were built, not alphabetically.
    monkeypatch.setattr(repo, "users", lambda: [{"full_name": "A", "email": "a@x", "role": "nurse"}])
    body = client.get(f"{BASE}/admin/users", headers=auth(app, "admin")).get_data(as_text=True)
    assert body.index('"full_name"') < body.index('"email"') < body.index('"role"')


def test_dispense_errors_map_to_400(app, client, monkeypatch):
    def boom(*a):
        raise ValueError("You must acknowledge the alerts before dispensing.")
    monkeypatch.setattr(service, "dispense", boom)
    res = client.post(f"{BASE}/dispense", json={"patient_id": "p1", "lines": []}, headers=auth(app, "nurse"))
    assert res.status_code == 400 and "acknowledge" in res.get_json()["error"]


def test_dispense_passes_user_and_body(app, client, monkeypatch):
    seen = {}
    monkeypatch.setattr(service, "dispense", lambda uid, email, pid, lines, ack: seen.update(
        uid=uid, email=email, pid=pid, lines=lines, ack=ack) or "Dispensed 1 medication(s) to A (U1).")
    body = {"patient_id": "p1", "lines": [{"stock_id": "s1"}], "acknowledged": True}
    res = client.post(f"{BASE}/dispense", json=body, headers=auth(app, "viewer"))
    assert res.status_code == 201
    assert seen == {"uid": "00000000-0000-0000-0000-000000000001", "email": "nurse@saranam.in",
                    "pid": "p1", "lines": [{"stock_id": "s1"}], "ack": True}


def test_unknown_report_is_404(app, client):
    assert client.get(f"{BASE}/reports/nope", headers=auth(app, "nurse")).status_code == 404
    assert client.get(f"{BASE}/reports/error_summary/csv", headers=auth(app, "nurse")).status_code == 404


def test_report_csv_download(app, client, monkeypatch):
    monkeypatch.setattr(service, "report_rows", lambda slug, params: [{"medicine": "X", "quantity": 3}])
    res = client.get(f"{BASE}/reports/low_stock/csv", headers=auth(app, "nurse"))
    assert res.status_code == 200 and res.mimetype == "text/csv"
    assert res.headers["Content-Disposition"].startswith("attachment; filename=low_stock_")
    assert res.get_data(as_text=True).splitlines() == ["medicine,quantity", "X,3"]
