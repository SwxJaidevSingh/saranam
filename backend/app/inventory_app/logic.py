"""Inventory rules as pure functions (no database access).

A 1:1 port of the Saranam Streamlit inventory app (``utils/helpers.py`` and the
rules in ``pages/*.py``). Stock is one ``inventory_stock`` row per medicine +
location; its ``current_stock`` is split into Saranam stock, stock from each
partner organisation, and unattributed units. There are no batches, no expiry
dates and no FEFO.
"""
import random
from collections import defaultdict
from typing import Any, Dict, Iterable, List, Optional

SOURCE_LABELS = {
    "saranam": "🟢 Saranam Procurement",
    "partner": "🔵 Partner Indent",
    "unattributed": "⚪ Unattributed",
}
INDENT_SOURCES = {"saranam": "Saranam Procurement", "partner": "Partner Indent"}

# EHR dosageform enum values; None = other / unspecified
DOSAGE_FORMS = ["TABLET", "CAPSULE", "SYRUP", "SUSPENSION", "INJECTION", "CREAM",
                "OINTMENT", "DROPS", "INHALER", "PATCH", None]
ROUTES = ["Oral", "Intravenous", "Intramuscular", "Subcutaneous", "Topical", "Rectal", "Sublingual", "Other"]
ERROR_TYPES = ["wrong_drug", "wrong_dose", "wrong_patient", "wrong_route", "near_miss", "adr", "other"]
SEVERITIES = ["low", "medium", "high", "critical"]
ERROR_STATUSES = ["open", "investigating", "resolved"]
RETURN_TYPES = ["return", "recall"]

NON_FORMULARY_ALERT = "❌ **Non-Formulary Drug** — This medication is not in the formulary. Justification may be required."
ALLERGY_ALERT = "🚨 **ALLERGY ALERT** — Patient has a documented allergy to this medication or its class!"


def source_label(source: str, partner_name: Optional[str] = None) -> str:
    """Display label for a source; Partner Indent names the partner organisation when given."""
    label = SOURCE_LABELS.get(source, source)
    return f"{label} ({partner_name})" if source == "partner" and partner_name else label


def dosage_label(form: Optional[str]) -> str:
    return "Other" if form is None else form.title()


# ---------------------------------------------------------------------------
# Stock source split
# ---------------------------------------------------------------------------

def split_stock_rows(rows: List[Dict[str, Any]], partner_rows: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Split each stock row's quantity into Saranam, per-partner and unattributed units.

    ``rows`` carry ``quantity`` (current_stock as int), ``saranam_balance`` and
    ``saranam_reorder``; ``partner_rows`` carry stock_id, partner_org_id,
    partner_name, quantity, reorder_level ordered by partner name.

    Balances are clamped in order (Saranam, then partners by name) so the parts
    always add up to current_stock, even if the EHR reduced current_stock without
    touching the balances. Adds saranam_qty, partners, partner_qty, unattributed_qty.
    """
    partners_by_stock = defaultdict(list)
    for p in partner_rows:
        partners_by_stock[p["stock_id"]].append(p)

    out = []
    for row in rows:
        r = dict(row)
        left = r["quantity"]
        r["saranam_qty"] = min(r.pop("saranam_balance"), left)
        left -= r["saranam_qty"]
        r["partners"] = []
        for p in partners_by_stock[r["stock_id"]]:
            qty = min(p["quantity"], left)
            left -= qty
            r["partners"].append({"org_id": p["partner_org_id"], "name": p["partner_name"],
                                  "qty": qty, "reorder_level": p["reorder_level"]})
        r["partner_qty"] = sum(p["qty"] for p in r["partners"])
        r["unattributed_qty"] = left
        out.append(r)
    return out


def partner_breakdown(r: Dict[str, Any]) -> Optional[str]:
    """Per-partner stock and reorder levels of a stock row, e.g. 'KIMS: 15 (reorder 10); …'."""
    return "; ".join(
        f"{p['name']}: {p['qty']} (reorder {'not set' if p['reorder_level'] is None else p['reorder_level']})"
        for p in r["partners"]
    ) or None


def _source_entry(r, source: str, available: int, partner=None, **extra):
    return {**r, "source": source, "available": available,
            "partner_org_id": partner["org_id"] if partner else None,
            "partner_name": partner["name"] if partner else None, **extra}


def low_stock_items(stock_rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """One entry per stock row + source of indent at or below its own reorder level.
    'available' is that source's quantity; sources with no level are never flagged."""
    low = []
    for r in stock_rows:
        if r["saranam_reorder"] is not None and r["saranam_qty"] <= r["saranam_reorder"]:
            low.append(_source_entry(r, "saranam", r["saranam_qty"], reorder_level=r["saranam_reorder"]))
        for p in r["partners"]:
            if p["reorder_level"] is not None and p["qty"] <= p["reorder_level"]:
                low.append(_source_entry(r, "partner", p["qty"], p, reorder_level=p["reorder_level"]))
    return sorted(low, key=lambda e: e["available"])


def source_buckets(stock_rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """One entry per stock row + source holding units: Saranam, each partner, unattributed."""
    buckets = []
    for r in stock_rows:
        if r["saranam_qty"] > 0:
            buckets.append(_source_entry(r, "saranam", r["saranam_qty"]))
        buckets += [_source_entry(r, "partner", p["qty"], p) for p in r["partners"] if p["qty"] > 0]
        if r["unattributed_qty"] > 0:
            buckets.append(_source_entry(r, "unattributed", r["unattributed_qty"]))
    return buckets


def stock_by_source(stock_rows: List[Dict[str, Any]]) -> Dict[str, int]:
    """Total units per source (saranam, partner, unattributed)."""
    return {src: sum(r[f"{src}_qty"] for r in stock_rows) for src in SOURCE_LABELS}


def stock_status(r: Dict[str, Any]) -> str:
    """Current Stock status: out of stock, low for the listed sources, or ✅."""
    low = [INDENT_SOURCES["saranam"]] if (
        r["saranam_reorder"] is not None and r["saranam_qty"] <= r["saranam_reorder"]) else []
    low += [p["name"] for p in r["partners"]
            if p["reorder_level"] is not None and p["qty"] <= p["reorder_level"]]
    if r["quantity"] <= 0:
        return "🔴 Out of Stock"
    if low:
        return f"🟡 Low: {', '.join(low)}"
    return "✅"


# ---------------------------------------------------------------------------
# Labels, names and codes
# ---------------------------------------------------------------------------

def medicine_label(m: Dict[str, Any]) -> str:
    """Includes the code because the EHR has duplicate medicine names."""
    return f"{m['medicine_name']} ({m['strength'] or 'N/A'}) · {m['medicine_code']}"


def generic_label(m: Dict[str, Any]) -> str:
    return f"{m['generic_name']} ({m['strength'] or 'N/A'}) · {m['medicine_code']}"


def stock_item_label(r: Dict[str, Any]) -> str:
    return f"{r['medicine_name']} [{r['location_name']}] · {r['medicine_code']}"


def bucket_label(s: Dict[str, Any]) -> str:
    return (f"{s['medicine_name']} {s['strength'] or ''} — {source_label(s['source'], s['partner_name'])} "
            f"({s['available']} avail) [{s['location_name']}] · {s['medicine_code']}")


def patient_label(p: Dict[str, Any]) -> str:
    return f"{p['full_name']} ({p['uhid']})"


def catalog_sort_key(m: Dict[str, Any]):
    return (m["generic_name"].lower(), m["strength"] or "")


def derive_medicine_name(generic_name: str, strength: Optional[str]) -> str:
    """medicine_master.medicine_name is NOT NULL: generic name + strength."""
    return " ".join(filter(None, [generic_name, strength]))


def random_medicine_code(rng=random) -> str:
    """EHR-style medicine code: MED + 6 digits."""
    return f"MED{rng.randint(100000, 999999)}"


# ---------------------------------------------------------------------------
# Dispensing safety checks
# ---------------------------------------------------------------------------

def check_allergy(allergies: Optional[str], medicine: Dict[str, Any]) -> bool:
    """True if any comma-separated allergy appears in the medicine's name or generic name."""
    if not allergies:
        return False
    names = f"{medicine['medicine_name']} {medicine['generic_name'] or ''}".lower()
    return any(a.strip().lower() in names for a in allergies.split(",") if a.strip())


def dispense_alerts(bucket: Dict[str, Any], allergies: Optional[str]) -> List[str]:
    """Non-formulary and allergy alerts for a stock item and patient."""
    alerts = []
    if not bucket["in_formulary"]:
        alerts.append(NON_FORMULARY_ALERT)
    if check_allergy(allergies, bucket):
        alerts.append(ALLERGY_ALERT)
    return alerts


def remaining_for_bucket(bucket: Dict[str, Any], cart: List[Dict[str, Any]]) -> int:
    """Units of this stock + source not already in the dispense list."""
    in_list = sum(line["quantity"] for line in cart
                  if line["stock_id"] == bucket["stock_id"] and line["source"] == bucket["source"]
                  and line["partner_org_id"] == bucket["partner_org_id"])
    return bucket["available"] - in_list
