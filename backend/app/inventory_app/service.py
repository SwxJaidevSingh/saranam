"""Inventory page services: one function per screen or action of the Saranam
Streamlit inventory app, combining ``logic`` (rules) and ``repository`` (SQL)."""
import csv
import io
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID

from app.inventory_app import logic, repository as repo


def jsonable(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [jsonable(v) for v in value]
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

def dashboard() -> Dict[str, Any]:
    totals = repo.stock_totals()
    rows = repo.stock_rows()
    low = logic.low_stock_items(rows)
    return {
        "unique_meds": totals["unique_meds"],
        "total_units": totals["total_units"],
        "by_source": logic.stock_by_source(rows),
        "low_stock": [{
            "Medicine": r["medicine_name"], "Category": r["category_name"],
            "Source": logic.source_label(r["source"], r["partner_name"]), "Qty": r["available"],
            "Reorder Level": r["reorder_level"], "Location": r["location_name"],
        } for r in low],
        "open_errors": repo.open_error_count(),
        "recent_dispensing": repo.recent_dispensing(),
    }


# ---------------------------------------------------------------------------
# Medicine Catalog
# ---------------------------------------------------------------------------

def catalog(query: str = "") -> Dict[str, Any]:
    cats = repo.categories()
    meds = sorted(repo.medicines(query), key=logic.catalog_sort_key)
    return {
        "medicines": [{**m, "label": logic.generic_label(m)} for m in meds],
        "categories": cats,
        "dosage_forms": [{"value": f, "label": logic.dosage_label(f)} for f in logic.DOSAGE_FORMS],
    }


def add_medicine(user_id, email: str, data: Dict[str, Any]) -> str:
    cats = {c["id"]: c["name"] for c in repo.categories()}
    category_id = data.get("category_id")
    if category_id not in cats:
        raise ValueError("Select a drug category.")
    cat_name = cats[category_id]
    is_consumable = cat_name.lower() == "consumables"
    generic_name = (data.get("generic_name") or "")
    if not generic_name:
        raise ValueError(f"{'Item' if is_consumable else 'Generic'} name is required.")
    strength = None if is_consumable else (data.get("strength") or None)
    dosage_form = None if is_consumable else data.get("dosage_form")
    if dosage_form not in logic.DOSAGE_FORMS:
        raise ValueError("Unknown dosage form.")
    med_id, name = repo.add_medicine(
        user_id=user_id, generic_name=generic_name, strength=strength, dosage_form=dosage_form,
        manufacturer=data.get("manufacturer"), category_id=category_id,
        in_formulary=bool(data.get("in_formulary", True)), notes=data.get("notes"),
    )
    repo.log_action(email, "add_medicine", "medicine_master", med_id, f"{name} [{cat_name}]")
    return f"Added **{name}** to catalog under **{cat_name}**."


def save_medicine_meta(email: str, medicine_id: str, data: Dict[str, Any]) -> str:
    med = next((m for m in repo.medicines() if str(m["id"]) == medicine_id), None)
    if not med:
        raise LookupError("Medicine not found.")
    cats = {c["id"]: c["name"] for c in repo.categories()}
    category_id = data.get("category_id")
    if category_id is not None and category_id not in cats:
        raise ValueError("Unknown drug category.")
    formulary = bool(data.get("in_formulary", True))
    repo.save_medicine_meta(medicine_id, category_id, formulary, data.get("notes"))
    repo.log_action(email, "update_medicine_meta", "medicine_master", medicine_id,
                    f"category={cats.get(category_id, '—')} formulary={formulary}")
    return f"Updated **{med['generic_name']}**."


def add_category(email: str, name: str) -> str:
    if not name:
        raise ValueError("Enter a category name.")
    try:
        repo.add_category(name)
    except repo.DuplicateCategory:
        raise ValueError("Category already exists.")
    repo.log_action(email, "add_drug_category", "drug_categories", detail=name)
    return f"Added category **{name}**."


# ---------------------------------------------------------------------------
# Stock Management
# ---------------------------------------------------------------------------

def current_stock() -> Dict[str, Any]:
    rows = repo.stock_rows()
    partners = repo.partner_organisations()
    source_names = {"saranam": logic.INDENT_SOURCES["saranam"], **{str(o["id"]): o["name"] for o in partners}}
    return {
        "rows": [{
            "stock_id": r["stock_id"], "label": logic.stock_item_label(r),
            "Medicine": r["medicine_name"], "Category": r["category_name"], "Strength": r["strength"],
            "Qty": r["quantity"], "🟢 Saranam": r["saranam_qty"], "🟢 Reorder Lvl": r["saranam_reorder"],
            "🔵 Partner": r["partner_qty"], "🔵 By Partner (reorder lvl)": logic.partner_breakdown(r),
            "⚪ Unattributed": r["unattributed_qty"], "Location": r["location_name"],
            "Status": logic.stock_status(r),
            "saranam_qty": r["saranam_qty"], "partner_qty": r["partner_qty"], "unattributed_qty": r["unattributed_qty"],
            "levels": {"saranam": r["saranam_reorder"], **{str(p["org_id"]): p["reorder_level"] for p in r["partners"]}},
        } for r in rows],
        "source_names": source_names,
        "source_labels": logic.SOURCE_LABELS,
    }


def set_reorder_level(email: str, stock_id: str, source_key: str, level: int) -> str:
    row = next((r for r in repo.stock_rows() if str(r["stock_id"]) == stock_id), None)
    if not row:
        raise LookupError("Stock item not found.")
    source_names = {"saranam": logic.INDENT_SOURCES["saranam"],
                    **{str(o["id"]): o["name"] for o in repo.partner_organisations()}}
    if source_key not in source_names:
        raise ValueError("Unknown indent source.")
    if level < 0:
        raise ValueError("Reorder level cannot be negative.")
    repo.set_reorder_level(stock_id, source_key, level)
    repo.log_action(email, "set_reorder_level", "inventory_stock", stock_id,
                    f"{source_names[source_key]} level={level}")
    return f"{source_names[source_key]} reorder level updated."


def receive_options() -> Dict[str, Any]:
    meds = repo.medicines()
    locations = repo.receiving_locations()
    names = [loc["location_name"] for loc in locations]
    default_idx = names.index("Main Pharmacy") if "Main Pharmacy" in names else 0
    return {
        "medicines": [{"id": m["id"], "label": logic.medicine_label(m)} for m in meds],
        "locations": locations,
        "default_location_id": locations[default_idx]["id"] if locations else None,
        "partners": repo.partner_organisations(),
        "sources": logic.INDENT_SOURCES,
    }


def receive_stock(user_id, email: str, data: Dict[str, Any]) -> str:
    source = data.get("source")
    if source not in logic.INDENT_SOURCES:
        raise ValueError("Select the source.")
    meds = {str(m["id"]): logic.medicine_label(m) for m in repo.medicines()}
    med_label = meds.get(str(data.get("medicine_id")))
    if not med_label:
        raise ValueError("Select a medicine.")
    locations = {str(loc["id"]) for loc in repo.receiving_locations()}
    if str(data.get("location_id")) not in locations:
        raise ValueError("Select a storage location.")
    qty = int(data.get("quantity") or 0)
    if qty < 1:
        raise ValueError("Quantity must be at least 1.")
    reorder = int(data.get("reorder_level", 10))
    if reorder < 0:
        raise ValueError("Reorder level cannot be negative.")

    partner_id = partner_name = supplier = None
    if source == "partner":
        partners = {str(p["id"]): p["name"] for p in repo.partner_organisations()}
        partner_id = str(data.get("partner_org_id") or "")
        if partner_id not in partners:
            raise ValueError("Select the partner organisation.")
        partner_name = partners[partner_id]
    else:
        supplier = data.get("supplier") or None

    stock_id = repo.receive_stock(
        user_id=user_id, medicine_id=data["medicine_id"], location_id=data["location_id"], quantity=qty,
        source=source, partner_org_id=partner_id, partner_name=partner_name, supplier=supplier, reorder_level=reorder,
    )
    from_partner = f" from {partner_name}" if partner_name else ""
    repo.log_action(email, "receive_stock", "inventory_stock", stock_id, f"{med_label} x{qty} via {source}{from_partner}")
    return f"Received **{qty}** units of {med_label} via **{logic.source_label(source)}**{from_partner}."


# ---------------------------------------------------------------------------
# Dispense
# ---------------------------------------------------------------------------

def dispense_patients() -> List[Dict[str, Any]]:
    return [{**p, "label": logic.patient_label(p)} for p in repo.patients()]


def dispense_context(patient_id: str) -> Dict[str, Any]:
    """Stock the patient can be given (per source) with safety alerts, and the patient's eMAR."""
    patient = next((p for p in repo.patients() if str(p["id"]) == patient_id), None)
    if not patient:
        raise LookupError("Patient not found among active Saranam patients.")
    buckets = logic.source_buckets(repo.stock_rows())
    return {
        "patient": {**patient, "label": logic.patient_label(patient)},
        "buckets": [{
            "stock_id": b["stock_id"], "source": b["source"], "partner_org_id": b["partner_org_id"],
            "partner_name": b["partner_name"], "medicine_id": b["medicine_id"], "location_id": b["location_id"],
            "medicine_name": b["medicine_name"], "strength": b["strength"], "location_name": b["location_name"],
            "available": b["available"], "label": logic.bucket_label(b),
            "source_label": logic.source_label(b["source"], b["partner_name"]),
            "alerts": logic.dispense_alerts(b, patient["allergies"]),
        } for b in buckets],
        "routes": logic.ROUTES,
        "emar": repo.emar(patient["id"]),
    }


def dispense(user_id, email: str, patient_id: str, lines: List[Dict[str, Any]], acknowledged: bool) -> str:
    """Dispense the whole list in one transaction; nothing is dispensed if any line fails."""
    patient = next((p for p in repo.patients() if str(p["id"]) == patient_id), None)
    if not patient:
        raise LookupError("Patient not found among active Saranam patients.")
    if not lines:
        raise ValueError("No medications added yet.")
    rows = {str(r["stock_id"]): r for r in repo.stock_rows()}
    partners = {str(p["id"]): p["name"] for p in repo.partner_organisations()}

    resolved, flagged = [], False
    for raw in lines:
        row = rows.get(str(raw.get("stock_id")))
        if not row:
            raise ValueError("A stock item in the list no longer exists. Adjust the list and try again.")
        source = raw.get("source")
        if source not in logic.SOURCE_LABELS:
            raise ValueError("Unknown stock source.")
        qty = int(raw.get("quantity") or 0)
        if qty < 1:
            raise ValueError("Quantity to dispense must be at least 1.")
        route = raw.get("route")
        if route not in logic.ROUTES:
            raise ValueError("Select a route.")
        partner_org_id = str(raw["partner_org_id"]) if source == "partner" and raw.get("partner_org_id") else None
        if logic.dispense_alerts(row, patient["allergies"]):
            flagged = True
        resolved.append({
            "stock_id": row["stock_id"], "source": source, "partner_org_id": partner_org_id,
            "partner_name": partners.get(partner_org_id) if partner_org_id else None,
            "medicine_id": row["medicine_id"], "location_id": row["location_id"],
            "medicine_name": row["medicine_name"], "quantity": qty,
            "dosage": raw.get("dosage"), "route": route, "notes": raw.get("notes"),
        })
    if flagged and not acknowledged:
        raise ValueError("You must acknowledge the alerts before dispensing.")

    label = logic.patient_label(patient)
    try:
        record_ids = repo.dispense(user_id=user_id, patient=patient, lines=resolved)
    except ValueError as e:
        raise ValueError(f"Nothing was dispensed — {e}. Adjust the list and try again.")
    for line, record_id in zip(resolved, record_ids):
        repo.log_action(email, "dispense", "dispensing_records", record_id,
                        f"{line['medicine_name']} x{line['quantity']} to {label}")
    return f"Dispensed {len(resolved)} medication(s) to {label}."


# ---------------------------------------------------------------------------
# Returns & Recalls
# ---------------------------------------------------------------------------

def medicine_options() -> List[Dict[str, Any]]:
    return [{"id": m["id"], "label": logic.medicine_label(m)} for m in repo.medicines()]


def report_return_recall(user_id, email: str, data: Dict[str, Any]) -> str:
    rr_type = data.get("type")
    if rr_type not in logic.RETURN_TYPES:
        raise ValueError("Select return or recall.")
    meds = {str(m["id"]): logic.medicine_label(m) for m in repo.medicines()}
    med_label = meds.get(str(data.get("medicine_id")))
    if not med_label:
        raise ValueError("Select a medicine.")
    qty = int(data.get("quantity") or 0)
    if qty < 0:
        raise ValueError("Quantity cannot be negative.")
    reason = data.get("reason") or ""
    if not reason:
        raise ValueError("Reason is required.")
    repo.report_return_recall(user_id=user_id, email=email, rr_type=rr_type, medicine_id=data["medicine_id"],
                              quantity=qty, reason=reason, adverse_reaction=data.get("adverse_reaction"))
    repo.log_action(email, f"report_{rr_type}", "returns_recalls", detail=f"{med_label} x{qty}")
    return f"{rr_type.title()} report submitted."


# ---------------------------------------------------------------------------
# Medication Error Reporting
# ---------------------------------------------------------------------------

def error_form_options() -> Dict[str, Any]:
    return {
        "patients": [{"id": p["id"], "label": logic.patient_label(p)} for p in repo.patients(include_deceased=True)],
        "medicines": medicine_options(),
        "error_types": logic.ERROR_TYPES,
        "severities": logic.SEVERITIES,
        "statuses": logic.ERROR_STATUSES,
    }


def report_error(email: str, data: Dict[str, Any]) -> str:
    if data.get("error_type") not in logic.ERROR_TYPES:
        raise ValueError("Select an error type.")
    if data.get("severity") not in logic.SEVERITIES:
        raise ValueError("Select a severity.")
    description = data.get("description") or ""
    if not description:
        raise ValueError("Description is required.")
    repo.report_error(email=email, error_type=data["error_type"], severity=data["severity"],
                      patient_id=data.get("patient_id") or None, medicine_id=data.get("medicine_id") or None,
                      description=description)
    repo.log_action(email, "report_medication_error", "medication_errors", detail=data["error_type"])
    return "Error report submitted."


def update_error_status(email: str, error_id: int, status: str) -> str:
    if status not in logic.ERROR_STATUSES:
        raise ValueError("Unknown status.")
    repo.update_error_status(error_id, status)
    repo.log_action(email, "update_error_status", "medication_errors", error_id, status)
    return "Status updated."


# ---------------------------------------------------------------------------
# Reports (columns and filters as the Streamlit report tables)
# ---------------------------------------------------------------------------

REPORTS = [
    "Stock Inventory", "Low-Stock Items", "Stock by Source", "Dispensing Summary",
    "Emergency Medications by Location", "Medication Error Summary", "Audit Log",
]
REPORT_SLUGS = {
    "stock_inventory": "Stock Inventory", "low_stock": "Low-Stock Items", "stock_by_source": "Stock by Source",
    "dispensing_summary": "Dispensing Summary", "emergency_meds": "Emergency Medications by Location",
    "error_summary": "Medication Error Summary", "audit_log": "Audit Log",
}


def report_rows(slug: str, params: Dict[str, Any]) -> List[Dict[str, Any]]:
    if slug == "stock_inventory":
        rows = [{
            "medicine": r["medicine_name"], "generic_name": r["generic_name"], "strength": r["strength"],
            "category": r["category_name"], "location": r["location_name"], "quantity": r["quantity"],
            "saranam": r["saranam_qty"], "saranam_reorder_level": r["saranam_reorder"],
            "partner": r["partner_qty"], "by_partner": logic.partner_breakdown(r),
            "unattributed": r["unattributed_qty"],
        } for r in repo.stock_rows()]
        source = params.get("source") or "All"
        if source != "All":
            rows = [r for r in rows if r[source] > 0]
        category = params.get("category") or "All"
        if category != "All":
            rows = [r for r in rows if r["category"] == category]
        location = (params.get("location") or "").lower()
        if location:
            rows = [r for r in rows if location in (r["location"] or "").lower()]
        return rows
    if slug == "low_stock":
        return [{"medicine": r["medicine_name"], "source": logic.source_label(r["source"], r["partner_name"]),
                 "quantity": r["available"], "reorder_level": r["reorder_level"], "location": r["location_name"]}
                for r in logic.low_stock_items(repo.stock_rows())]
    if slug == "stock_by_source":
        return [{"source": b["source"], "partner": b["partner_name"], "medicine": b["medicine_name"],
                 "strength": b["strength"], "quantity": b["available"], "location": b["location_name"]}
                for b in logic.source_buckets(repo.stock_rows())]
    if slug == "dispensing_summary":
        today = date.today()
        start = params.get("start") or (today.fromordinal(today.toordinal() - 30)).isoformat()
        end = params.get("end") or today.isoformat()
        return repo.dispensing_summary(date.fromisoformat(start), date.fromisoformat(end))
    if slug == "emergency_meds":
        return repo.emergency_meds_report()
    if slug == "error_summary":
        return repo.error_summary()
    if slug == "audit_log":
        limit = max(10, min(200, int(params.get("limit") or 50)))
        return repo.audit_log(limit)
    raise LookupError("Unknown report.")


def to_csv(rows: List[Dict[str, Any]]) -> str:
    out = io.StringIO()
    if not rows:
        return ""
    writer = csv.writer(out)
    cols = list(rows[0].keys())
    writer.writerow(cols)
    for r in rows:
        writer.writerow(["" if r[c] is None else r[c] for c in cols])
    return out.getvalue()


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------

def save_allergies(email: str, patient_id: str, allergies: Optional[str]) -> str:
    patient = next((p for p in repo.patients() if str(p["id"]) == patient_id), None)
    if not patient:
        raise LookupError("Patient not found among living Saranam patients.")
    value = (allergies or "").strip() or None
    repo.save_allergies(patient_id, value, email)
    repo.log_action(email, "set_patient_allergies", "patients", patient_id, value or "none")
    return f"Allergies saved for **{patient['full_name']}**."


def add_emergency_med(email: str, data: Dict[str, Any]) -> str:
    meds = {str(m["id"]): logic.medicine_label(m) for m in repo.medicines()}
    med_label = meds.get(str(data.get("medicine_id")))
    if not med_label:
        raise ValueError("Select a medicine.")
    location = data.get("location") or ""
    if not location:
        raise ValueError("Location is required.")
    qty = int(data.get("quantity") or 0)
    if qty < 0:
        raise ValueError("Quantity cannot be negative.")
    repo.add_emergency_med(data["medicine_id"], location, qty)
    repo.log_action(email, "add_emergency_med", "emergency_meds", detail=f"{med_label} at {location}")
    return "Emergency med entry added."
