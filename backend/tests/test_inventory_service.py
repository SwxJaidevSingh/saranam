"""Inventory page services with the data layer stubbed (no database)."""
import pytest

from app.inventory_app import logic, service
from app.inventory_app import repository as repo

PATIENT = {"id": "p1", "uhid": "U1", "full_name": "Asha K", "allergies": "tramadol", "is_deceased": False}


def _stock():
    return logic.split_stock_rows([
        {"stock_id": "s1", "medicine_id": "m1", "location_id": "l1", "medicine_code": "MED1",
         "medicine_name": "Tramadol 50mg", "generic_name": "Tramadol", "strength": "50mg",
         "category_name": "Pain Medication", "in_formulary": True, "location_name": "Main Pharmacy",
         "quantity": 10, "saranam_balance": 10, "saranam_reorder": 5},
    ], [])


@pytest.fixture
def stubs(monkeypatch):
    calls = {"log": [], "dispense": None, "medicine": None}
    monkeypatch.setattr(repo, "patients", lambda include_deceased=False: [PATIENT])
    monkeypatch.setattr(repo, "stock_rows", _stock)
    monkeypatch.setattr(repo, "partner_organisations", lambda: [{"id": "k", "name": "KIMS"}])
    monkeypatch.setattr(repo, "categories", lambda: [{"id": 1, "name": "Consumables"}, {"id": 2, "name": "Pain Medication"}])
    monkeypatch.setattr(repo, "log_action", lambda *a, **k: calls["log"].append(a))

    def fake_dispense(**kw):
        calls["dispense"] = kw
        return ["r1"]
    monkeypatch.setattr(repo, "dispense", fake_dispense)

    def fake_add(**kw):
        calls["medicine"] = kw
        return "new-id", logic.derive_medicine_name(kw["generic_name"], kw["strength"])
    monkeypatch.setattr(repo, "add_medicine", fake_add)
    return calls


LINE = {"stock_id": "s1", "source": "saranam", "partner_org_id": None, "quantity": 2, "dosage": "", "route": "Oral"}


def test_dispense_requires_acknowledgement_when_alerts(stubs):
    with pytest.raises(ValueError, match="acknowledge the alerts"):
        service.dispense("u1", "nurse@x", "p1", [LINE], acknowledged=False)
    assert stubs["dispense"] is None


def test_dispense_resolves_lines_and_audits(stubs):
    msg = service.dispense("u1", "nurse@x", "p1", [LINE], acknowledged=True)
    assert msg == "Dispensed 1 medication(s) to Asha K (U1)."
    line = stubs["dispense"]["lines"][0]
    assert (line["medicine_id"], line["location_id"], line["quantity"], line["partner_name"]) == ("m1", "l1", 2, None)
    assert stubs["log"] == [("nurse@x", "dispense", "dispensing_records", "r1", "Tramadol 50mg x2 to Asha K (U1)")]


def test_dispense_failure_message(stubs, monkeypatch):
    def boom(**kw):
        raise ValueError("Tramadol 50mg: only 1 unit(s) left in stock")
    monkeypatch.setattr(repo, "dispense", boom)
    with pytest.raises(ValueError, match="Nothing was dispensed — Tramadol 50mg: only 1 unit"):
        service.dispense("u1", "nurse@x", "p1", [LINE], acknowledged=True)


def test_dispense_unknown_patient(stubs):
    with pytest.raises(LookupError):
        service.dispense("u1", "nurse@x", "nope", [LINE], acknowledged=True)


def test_dispense_context_alerts(stubs, monkeypatch):
    monkeypatch.setattr(repo, "emar", lambda pid: [])
    ctx = service.dispense_context("p1")
    [b] = ctx["buckets"]
    assert b["alerts"] == [logic.ALLERGY_ALERT] and b["available"] == 10
    assert b["label"] == "Tramadol 50mg 50mg — 🟢 Saranam Procurement (10 avail) [Main Pharmacy] · MED1"


def test_add_medicine_consumable_drops_strength_and_form(stubs):
    msg = service.add_medicine("u1", "a@x", {"category_id": 1, "generic_name": "Gauze roll",
                                              "strength": "10cm", "dosage_form": "TABLET"})
    assert stubs["medicine"]["strength"] is None and stubs["medicine"]["dosage_form"] is None
    assert msg == "Added **Gauze roll** to catalog under **Consumables**."


def test_add_medicine_name_required(stubs):
    with pytest.raises(ValueError, match="Item name is required"):
        service.add_medicine("u1", "a@x", {"category_id": 1, "generic_name": ""})
    with pytest.raises(ValueError, match="Generic name is required"):
        service.add_medicine("u1", "a@x", {"category_id": 2, "generic_name": ""})


def test_stock_inventory_report_filters(stubs):
    rows = service.report_rows("stock_inventory", {"source": "saranam", "category": "Pain Medication", "location": "main"})
    assert [r["medicine"] for r in rows] == ["Tramadol 50mg"]
    assert service.report_rows("stock_inventory", {"source": "partner"}) == []
    assert service.report_rows("stock_inventory", {"location": "ward"}) == []


def test_to_csv():
    assert service.to_csv([]) == ""
    text = service.to_csv([{"a": 1, "b": None}, {"a": "x,y", "b": 2}])
    assert text.splitlines() == ["a,b", "1,", '"x,y",2']


def test_receive_requires_partner_for_partner_source(stubs, monkeypatch):
    monkeypatch.setattr(repo, "medicines", lambda query="": [{"id": "m1", "medicine_name": "X", "strength": None, "medicine_code": "MED1"}])
    monkeypatch.setattr(repo, "receiving_locations", lambda: [{"id": "l1", "location_name": "Main Pharmacy"}])
    with pytest.raises(ValueError, match="Select the partner organisation"):
        service.receive_stock("u1", "a@x", {"source": "partner", "medicine_id": "m1", "location_id": "l1", "quantity": 5})
