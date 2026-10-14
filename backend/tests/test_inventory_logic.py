"""Unit tests for the inventory rules (pure functions, no database)."""
import random

from app.inventory_app import logic


def stock_row(stock_id="s1", quantity=10, saranam=0, saranam_reorder=None, **extra):
    row = {
        "stock_id": stock_id, "medicine_id": "m1", "location_id": "l1", "medicine_code": "MED100001",
        "medicine_name": "Paracetamol 500mg", "generic_name": "Paracetamol", "strength": "500mg",
        "category_name": "Pain Medication", "in_formulary": True, "location_name": "Main Pharmacy",
        "quantity": quantity, "saranam_balance": saranam, "saranam_reorder": saranam_reorder,
    }
    row.update(extra)
    return row


def partner(stock_id, org_id, name, qty, level=None):
    return {"stock_id": stock_id, "partner_org_id": org_id, "partner_name": name, "quantity": qty, "reorder_level": level}


# --- stock split ----------------------------------------------------------------

def test_split_saranam_then_partners_by_name_then_unattributed():
    [r] = logic.split_stock_rows([stock_row(quantity=30, saranam=10)],
                                 [partner("s1", "a", "AIIMS", 12), partner("s1", "k", "KIMS", 5)])
    assert (r["saranam_qty"], r["partner_qty"], r["unattributed_qty"]) == (10, 17, 3)
    assert [(p["name"], p["qty"]) for p in r["partners"]] == [("AIIMS", 12), ("KIMS", 5)]
    assert "saranam_balance" not in r


def test_split_clamps_when_balances_exceed_current_stock():
    [r] = logic.split_stock_rows([stock_row(quantity=8, saranam=6)],
                                 [partner("s1", "a", "AIIMS", 5), partner("s1", "k", "KIMS", 4)])
    assert (r["saranam_qty"], [p["qty"] for p in r["partners"]], r["unattributed_qty"]) == (6, [2, 0], 0)
    assert r["saranam_qty"] + r["partner_qty"] + r["unattributed_qty"] == r["quantity"]


def test_split_ignores_other_stock_rows_partners():
    [r] = logic.split_stock_rows([stock_row(quantity=5)], [partner("other", "a", "AIIMS", 5)])
    assert r["partners"] == [] and r["unattributed_qty"] == 5


def test_partner_breakdown_text():
    [r] = logic.split_stock_rows([stock_row(quantity=20)],
                                 [partner("s1", "a", "AIIMS", 15, 10), partner("s1", "k", "KIMS", 3)])
    assert logic.partner_breakdown(r) == "AIIMS: 15 (reorder 10); KIMS: 3 (reorder not set)"
    [empty] = logic.split_stock_rows([stock_row()], [])
    assert logic.partner_breakdown(empty) is None


# --- low stock, buckets, totals, status -------------------------------------------

def _rows():
    return logic.split_stock_rows(
        [stock_row("s1", quantity=12, saranam=4, saranam_reorder=5),
         stock_row("s2", quantity=0, saranam=0, saranam_reorder=None, medicine_name="Ondansetron 4mg"),
         stock_row("s3", quantity=30, saranam=20, saranam_reorder=5, medicine_name="Lactulose")],
        [partner("s1", "k", "KIMS", 8, 8), partner("s3", "k", "KIMS", 2, None)],
    )


def test_low_stock_per_source_sorted_by_available():
    low = logic.low_stock_items(_rows())
    assert [(e["stock_id"], e["source"], e["available"], e["reorder_level"]) for e in low] == [
        ("s1", "saranam", 4, 5), ("s1", "partner", 8, 8)]
    assert low[1]["partner_name"] == "KIMS"


def test_source_buckets_only_sources_with_units():
    buckets = logic.source_buckets(_rows())
    assert [(b["stock_id"], b["source"], b["available"]) for b in buckets] == [
        ("s1", "saranam", 4), ("s1", "partner", 8), ("s3", "saranam", 20), ("s3", "partner", 2), ("s3", "unattributed", 8)]


def test_stock_by_source_totals():
    assert logic.stock_by_source(_rows()) == {"saranam": 24, "partner": 10, "unattributed": 8}


def test_stock_status():
    s1, s2, s3 = _rows()
    assert logic.stock_status(s1) == "🟡 Low: Saranam Procurement, KIMS"
    assert logic.stock_status(s2) == "🔴 Out of Stock"
    assert logic.stock_status(s3) == "✅"


# --- labels, names, codes -----------------------------------------------------------

def test_labels_and_names():
    m = {"medicine_name": "Morphine 10mg", "generic_name": "Morphine", "strength": None, "medicine_code": "MED123456"}
    assert logic.medicine_label(m) == "Morphine 10mg (N/A) · MED123456"
    assert logic.generic_label(m) == "Morphine (N/A) · MED123456"
    assert logic.patient_label({"full_name": "A B", "uhid": "U1"}) == "A B (U1)"
    assert logic.source_label("partner", "KIMS") == "🔵 Partner Indent (KIMS)"
    assert logic.source_label("saranam", "KIMS") == "🟢 Saranam Procurement"
    assert logic.derive_medicine_name("Gauze", None) == "Gauze"
    assert logic.derive_medicine_name("Paracetamol", "500mg") == "Paracetamol 500mg"
    assert logic.dosage_label(None) == "Other" and logic.dosage_label("TABLET") == "Tablet"


def test_random_medicine_code_format():
    code = logic.random_medicine_code(random.Random(1))
    assert code.startswith("MED") and len(code) == 9 and code[3:].isdigit()


# --- dispensing safety ----------------------------------------------------------------

def test_allergy_substring_match():
    med = {"medicine_name": "Amoxicillin 500mg", "generic_name": "Amoxicillin"}
    assert logic.check_allergy("Penicillin, amoxi", med)
    assert not logic.check_allergy("Penicillin, Aspirin", med)
    assert not logic.check_allergy(None, med) and not logic.check_allergy(" , ", med)


def test_dispense_alerts_and_remaining():
    bucket = {"stock_id": "s1", "source": "partner", "partner_org_id": "k", "available": 8,
              "in_formulary": False, "medicine_name": "Tramadol 50mg", "generic_name": "Tramadol"}
    assert logic.dispense_alerts(bucket, "tramadol") == [logic.NON_FORMULARY_ALERT, logic.ALLERGY_ALERT]
    cart = [{"stock_id": "s1", "source": "partner", "partner_org_id": "k", "quantity": 3},
            {"stock_id": "s1", "source": "saranam", "partner_org_id": None, "quantity": 5}]
    assert logic.remaining_for_bucket(bucket, cart) == 5
