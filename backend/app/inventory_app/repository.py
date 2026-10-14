"""Inventory data layer: the Saranam Streamlit inventory app's SQL.

EHR tables live in ``public`` (medicine_master, inventory_locations, inventory_stock,
stock_movements, dispensing_records, organizations, patients, users); app-only tables
live in the ``inventory`` schema (see ``schema.py``). Each public function that writes
is one transaction, like one ``with get_conn()`` block in the Streamlit app.
"""
import os
from datetime import date
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.inventory_app import logic

SARANAM_ORG_CODE = os.environ.get("SARANAM_ORG_CODE", "CVRAMAN")


class DuplicateCategory(Exception):
    pass


def _all(sql: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    return [dict(r) for r in db.session.execute(text(sql), params or {}).mappings().all()]


def _one(sql: str, params: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    row = db.session.execute(text(sql), params or {}).mappings().first()
    return dict(row) if row else None


def _transaction(fn):
    """Run fn() as one transaction: commit on success, roll back on any error."""
    try:
        result = fn()
        db.session.commit()
        return result
    except Exception:
        db.session.rollback()
        raise


# ---------------------------------------------------------------------------
# Organisations, patients, users, locations
# ---------------------------------------------------------------------------

_saranam_org_id = None


def saranam_org_id():
    """Id of the Saranam organisation (org code CVRAMAN by default), cached per process."""
    global _saranam_org_id
    if _saranam_org_id is None:
        row = _one("SELECT id FROM public.organizations WHERE code = :code", {"code": SARANAM_ORG_CODE})
        if not row:
            raise RuntimeError(f"No organization with code {SARANAM_ORG_CODE!r} in the database.")
        _saranam_org_id = row["id"]
    return _saranam_org_id


def partner_organisations() -> List[Dict[str, Any]]:
    """Active EHR organisations other than Saranam, which supply Partner Indent stock."""
    return _all("""
        SELECT id, name FROM public.organizations
        WHERE is_active AND status = 'active' AND id <> :org
        ORDER BY name
    """, {"org": saranam_org_id()})


def patients(include_deceased: bool = False) -> List[Dict[str, Any]]:
    """Active Saranam patients from the EHR, with their recorded allergies."""
    sql = """
        SELECT p.id, COALESCE(p.uhid, p.hospital_uhid, left(p.id::text, 8)) AS uhid,
               p.full_name, p.gender, date_part('year', age(p.date_of_birth))::int AS age,
               p.care_status, p.is_deceased, pa.allergies
        FROM public.patients p
        LEFT JOIN inventory.patient_allergies pa ON pa.patient_id = p.id
        WHERE p.organization_id = :org AND p.is_active
    """
    if not include_deceased:
        sql += " AND NOT p.is_deceased"
    return _all(sql + " ORDER BY p.full_name", {"org": saranam_org_id()})


def users() -> List[Dict[str, Any]]:
    return _all("""
        SELECT email, full_name, role::text AS role, is_active, is_approved, created_at
        FROM public.users ORDER BY email
    """)


def user_email(user_id) -> str:
    row = _one("SELECT email FROM public.users WHERE id = :id", {"id": str(user_id)})
    return row["email"] if row else "system"


def receiving_locations() -> List[Dict[str, Any]]:
    return _all("""
        SELECT id, location_name FROM public.inventory_locations
        WHERE COALESCE(is_active, TRUE) AND COALESCE(can_receive_stock, TRUE)
        ORDER BY location_name
    """)


# ---------------------------------------------------------------------------
# Stock
# ---------------------------------------------------------------------------

def stock_rows() -> List[Dict[str, Any]]:
    """All stock rows (one per medicine + location) split into sources."""
    rows = _all("""
        SELECT s.id AS stock_id, s.medicine_id, s.location_id,
               m.medicine_code, m.medicine_name, m.generic_name, m.strength,
               COALESCE(dc.name, '—') AS category_name,
               COALESCE(mm.in_formulary, TRUE) AS in_formulary,
               l.location_name,
               s.current_stock::int AS quantity,
               COALESCE(sb.quantity, 0) AS saranam_balance,
               sb.reorder_level AS saranam_reorder
        FROM public.inventory_stock s
        JOIN public.medicine_master m ON m.id = s.medicine_id
        JOIN public.inventory_locations l ON l.id = s.location_id
        LEFT JOIN inventory.medicine_meta mm ON mm.medicine_id = m.id
        LEFT JOIN inventory.drug_categories dc ON dc.id = mm.category_id
        LEFT JOIN inventory.stock_source_balance sb ON sb.stock_id = s.id AND sb.source = 'saranam'
        ORDER BY m.medicine_name, l.location_name
    """)
    partner_rows = _all("""
        SELECT pb.stock_id, pb.partner_org_id, o.name AS partner_name, pb.quantity, pb.reorder_level
        FROM inventory.partner_stock_balance pb
        JOIN public.organizations o ON o.id = pb.partner_org_id
        ORDER BY o.name
    """)
    return logic.split_stock_rows(rows, partner_rows)


def stock_totals() -> Dict[str, Any]:
    """Unique medicines and total units."""
    return _one("""
        SELECT COUNT(DISTINCT medicine_id) AS unique_meds,
               COALESCE(SUM(current_stock), 0)::bigint AS total_units
        FROM public.inventory_stock
    """)


def change_stock(stock_id, delta: int) -> Tuple[int, int]:
    """Add delta to inventory_stock.current_stock under a row lock. Returns (before, after)."""
    before = _one(
        "SELECT current_stock::int AS q FROM public.inventory_stock WHERE id = :id FOR UPDATE",
        {"id": str(stock_id)},
    )["q"]
    after = before + delta
    if after < 0:
        raise ValueError(f"only {before} unit(s) left in stock")
    db.session.execute(text(
        "UPDATE public.inventory_stock SET current_stock = :after, updated_at = timezone('utc', now()) WHERE id = :id"
    ), {"after": after, "id": str(stock_id)})
    return before, after


def change_source_balance(stock_id, source: str, delta: int, partner_org_id=None) -> None:
    """Adjust the Saranam or one partner's share of a stock row. 'unattributed' has no balance row."""
    if source == "saranam":
        db.session.execute(text("""
            INSERT INTO inventory.stock_source_balance (stock_id, source, quantity)
            VALUES (:sid, 'saranam', GREATEST(:delta, 0))
            ON CONFLICT (stock_id, source)
            DO UPDATE SET quantity = GREATEST(inventory.stock_source_balance.quantity + :delta, 0)
        """), {"sid": str(stock_id), "delta": delta})
    elif source == "partner":
        db.session.execute(text("""
            INSERT INTO inventory.partner_stock_balance (stock_id, partner_org_id, quantity)
            VALUES (:sid, :pid, GREATEST(:delta, 0))
            ON CONFLICT (stock_id, partner_org_id)
            DO UPDATE SET quantity = GREATEST(inventory.partner_stock_balance.quantity + :delta, 0)
        """), {"sid": str(stock_id), "pid": str(partner_org_id), "delta": delta})


def set_source_reorder_level(stock_id, source: str, level: int, partner_org_id=None,
                             only_if_unset: bool = False) -> None:
    """Set the reorder level for Saranam stock, or one partner's stock, on a stock row."""
    if source == "saranam":
        sql = """INSERT INTO inventory.stock_source_balance AS b (stock_id, source, quantity, reorder_level)
                 VALUES (:sid, 'saranam', 0, :level)
                 ON CONFLICT (stock_id, source) DO UPDATE SET reorder_level = EXCLUDED.reorder_level"""
        params = {"sid": str(stock_id), "level": level}
    else:
        sql = """INSERT INTO inventory.partner_stock_balance AS b (stock_id, partner_org_id, quantity, reorder_level)
                 VALUES (:sid, :pid, 0, :level)
                 ON CONFLICT (stock_id, partner_org_id) DO UPDATE SET reorder_level = EXCLUDED.reorder_level"""
        params = {"sid": str(stock_id), "pid": str(partner_org_id), "level": level}
    if only_if_unset:
        sql += " WHERE b.reorder_level IS NULL"
    db.session.execute(text(sql), params)


def record_movement(*, performed_by, movement_type: str, direction: str, medicine_id, quantity: int,
                    stock_before: int, stock_after: int, from_location_id=None, to_location_id=None,
                    patient_id=None, reference_type=None, reference_id=None, reason=None, notes=None):
    """Append to the EHR's stock_movements ledger; returns the movement id.
    movement_type: PURCHASE | ISSUE | RETURN | TRANSFER | ADJUSTMENT | DISPOSAL; direction: IN | OUT."""
    s = lambda v: None if v is None else str(v)  # noqa: E731
    return db.session.execute(text("""
        INSERT INTO public.stock_movements
           (id, movement_type, movement_direction, medicine_id, from_location_id, to_location_id,
            quantity, stock_before, stock_after, reference_type, reference_id, patient_id,
            reason, notes, performed_by, performed_at, created_at, updated_at)
        VALUES (gen_random_uuid(), CAST(:mtype AS movementtype), :direction, :medicine_id, :from_loc, :to_loc,
                :quantity, :before, :after, :ref_type, :ref_id, :patient_id,
                :reason, :notes, :performed_by, timezone('utc', now()), timezone('utc', now()), timezone('utc', now()))
        RETURNING id
    """), {
        "mtype": movement_type, "direction": direction, "medicine_id": s(medicine_id),
        "from_loc": s(from_location_id), "to_loc": s(to_location_id), "quantity": quantity,
        "before": stock_before, "after": stock_after, "ref_type": reference_type, "ref_id": s(reference_id),
        "patient_id": s(patient_id), "reason": reason, "notes": notes, "performed_by": s(performed_by),
    }).scalar()


def set_reorder_level(stock_id, source_key: str, level: int) -> None:
    """source_key is 'saranam' or a partner organisation id."""
    def run():
        if source_key == "saranam":
            set_source_reorder_level(stock_id, "saranam", level)
        else:
            set_source_reorder_level(stock_id, "partner", level, partner_org_id=source_key)
    _transaction(run)


def receive_stock(*, user_id, medicine_id, location_id, quantity: int, source: str,
                  partner_org_id=None, partner_name=None, supplier=None, reorder_level: int = 10):
    """Receive units into a medicine + location stock row for a source. Returns the stock id."""
    def run():
        existing = _one("""
            SELECT id FROM public.inventory_stock
            WHERE medicine_id = :mid AND location_id = :lid
            ORDER BY created_at LIMIT 1 FOR UPDATE
        """, {"mid": str(medicine_id), "lid": str(location_id)})
        if existing:
            stock_id = existing["id"]
        else:
            stock_id = db.session.execute(text("""
                INSERT INTO public.inventory_stock
                   (id, medicine_id, location_id, current_stock, allocated_stock,
                    stock_status, created_at, updated_at)
                VALUES (gen_random_uuid(), :mid, :lid, 0, 0,
                        'OPTIMAL', timezone('utc', now()), timezone('utc', now()))
                RETURNING id
            """), {"mid": str(medicine_id), "lid": str(location_id)}).scalar()
        before, after = change_stock(stock_id, quantity)
        change_source_balance(stock_id, source, quantity, partner_org_id=partner_org_id)
        set_source_reorder_level(stock_id, source, reorder_level, partner_org_id=partner_org_id, only_if_unset=True)
        movement_id = record_movement(
            performed_by=user_id, movement_type="PURCHASE", direction="IN", medicine_id=medicine_id,
            quantity=quantity, stock_before=before, stock_after=after, to_location_id=location_id,
            reference_type="inventory_app_receipt",
            reason="Saranam procurement" if source == "saranam" else "Partner indent",
            notes=partner_name or supplier or None,
        )
        if partner_org_id:
            db.session.execute(text("""
                INSERT INTO inventory.partner_receipts (movement_id, stock_id, partner_org_id, quantity)
                VALUES (:mv, :sid, :pid, :qty)
            """), {"mv": str(movement_id), "sid": str(stock_id), "pid": str(partner_org_id), "qty": quantity})
        return stock_id
    return _transaction(run)


def movement_log(limit: int = 50) -> List[Dict[str, Any]]:
    return _all("""
        SELECT sm.performed_at, sm.movement_type::text AS movement_type,
               sm.movement_direction AS direction, sm.quantity::int AS quantity,
               m.medicine_name AS medicine,
               COALESCE(lt.location_name, lf.location_name) AS location,
               sm.reason, o.name AS partner, sm.notes, u.email AS performed_by
        FROM public.stock_movements sm
        JOIN public.medicine_master m ON sm.medicine_id = m.id
        LEFT JOIN public.inventory_locations lf ON sm.from_location_id = lf.id
        LEFT JOIN public.inventory_locations lt ON sm.to_location_id = lt.id
        LEFT JOIN public.users u ON sm.performed_by = u.id
        LEFT JOIN inventory.partner_receipts pr ON pr.movement_id = sm.id
        LEFT JOIN public.organizations o ON o.id = pr.partner_org_id
        ORDER BY sm.performed_at DESC
        LIMIT :limit
    """, {"limit": limit})


# ---------------------------------------------------------------------------
# Catalog
# ---------------------------------------------------------------------------

def categories() -> List[Dict[str, Any]]:
    return _all("SELECT id, name FROM inventory.drug_categories ORDER BY name")


def medicines(query: str = "") -> List[Dict[str, Any]]:
    """Active EHR medicines with inventory category/formulary; optional name search."""
    sql = """
        SELECT m.id, m.medicine_code, m.medicine_name, m.generic_name, m.brand_name, m.strength,
               m.dosage_form_enum::text AS dosage_form, m.manufacturer,
               mm.category_id, COALESCE(dc.name, '—') AS category_name,
               COALESCE(mm.in_formulary, TRUE) AS in_formulary, mm.notes
        FROM public.medicine_master m
        LEFT JOIN inventory.medicine_meta mm ON mm.medicine_id = m.id
        LEFT JOIN inventory.drug_categories dc ON dc.id = mm.category_id
        WHERE COALESCE(m.is_active, TRUE) AND NOT COALESCE(m.discontinued, FALSE)
    """
    params: Dict[str, Any] = {}
    if query:
        sql += " AND (m.medicine_name ILIKE :q OR m.generic_name ILIKE :q OR m.brand_name ILIKE :q)"
        params["q"] = f"%{query}%"
    return _all(sql + " ORDER BY m.medicine_name, m.strength", params)


def new_medicine_code() -> str:
    """EHR-style medicine code (MED + 6 digits) not already in use."""
    while True:
        code = logic.random_medicine_code()
        if not _one("SELECT 1 AS x FROM public.medicine_master WHERE medicine_code = :c", {"c": code}):
            return code


def add_medicine(*, user_id, generic_name: str, strength, dosage_form, manufacturer,
                 category_id, in_formulary: bool, notes) -> Tuple[Any, str]:
    """Insert into medicine_master and inventory.medicine_meta. Returns (id, medicine_name)."""
    name = logic.derive_medicine_name(generic_name, strength)

    def run():
        med_id = db.session.execute(text("""
            INSERT INTO public.medicine_master
               (id, medicine_code, medicine_name, generic_name, strength, dosage_form_enum, manufacturer,
                controlled_substance, narcotic, is_active, discontinued,
                created_by, updated_by, created_at, updated_at)
            VALUES (gen_random_uuid(), :code, :name, :generic, :strength, CAST(:form AS dosageform), :manufacturer,
                    FALSE, FALSE, TRUE, FALSE,
                    :uid, :uid, timezone('utc', now()), timezone('utc', now()))
            RETURNING id
        """), {
            "code": new_medicine_code(), "name": name, "generic": generic_name, "strength": strength or None,
            "form": dosage_form, "manufacturer": manufacturer or None, "uid": str(user_id),
        }).scalar()
        db.session.execute(text("""
            INSERT INTO inventory.medicine_meta (medicine_id, category_id, in_formulary, notes)
            VALUES (:mid, :cid, :formulary, :notes)
        """), {"mid": str(med_id), "cid": category_id, "formulary": in_formulary, "notes": notes or None})
        return med_id
    return _transaction(run), name


def save_medicine_meta(medicine_id, category_id, in_formulary: bool, notes) -> None:
    _transaction(lambda: db.session.execute(text("""
        INSERT INTO inventory.medicine_meta (medicine_id, category_id, in_formulary, notes)
        VALUES (:mid, :cid, :formulary, :notes)
        ON CONFLICT (medicine_id) DO UPDATE
        SET category_id = EXCLUDED.category_id, in_formulary = EXCLUDED.in_formulary,
            notes = EXCLUDED.notes, updated_at = now()
    """), {"mid": str(medicine_id), "cid": category_id, "formulary": in_formulary, "notes": notes or None}))


def add_category(name: str) -> None:
    try:
        _transaction(lambda: db.session.execute(
            text("INSERT INTO inventory.drug_categories (name) VALUES (:name)"), {"name": name.strip()}))
    except IntegrityError as e:
        raise DuplicateCategory() from e


def search_medicines_for_prescriptions(query: str, limit: int) -> List[Dict[str, Any]]:
    """Medicine lookup for prescription forms (active medicines, name/generic/brand match)."""
    rows = _all("""
        SELECT id, medicine_code, medicine_name, generic_name, brand_name, manufacturer,
               lower(dosage_form_enum::text) AS dosage_form, strength, strength_components,
               strength_per_value, strength_per_unit, is_active, discontinued
        FROM public.medicine_master
        WHERE is_active = TRUE
          AND (medicine_name ILIKE :q OR generic_name ILIKE :q OR brand_name ILIKE :q)
        LIMIT :limit
    """, {"q": f"%{query}%", "limit": limit})
    for r in rows:
        r["id"] = str(r["id"])
        if r.get("strength_per_value") is not None:
            r["strength_per_value"] = str(r["strength_per_value"])
    return rows


# ---------------------------------------------------------------------------
# Dispensing
# ---------------------------------------------------------------------------

def dispense(*, user_id, patient: Dict[str, Any], lines: List[Dict[str, Any]]) -> List[Any]:
    """Dispense every line in one transaction; any failure dispenses nothing.

    Each line: stock_id, source, partner_org_id, partner_name, medicine_id, location_id,
    medicine_name, quantity, dosage, route, notes. Returns dispensing record ids.
    """
    def dispense_line(line):
        record_id = db.session.execute(text("""
            INSERT INTO public.dispensing_records
               (id, patient_id, medicine_id, dispensed_quantity, dosage, route, special_instructions,
                dispensed_from_location, dispensed_by, dispensed_at, status, created_at, updated_at)
            VALUES (gen_random_uuid(), :pid, :mid, :qty, :dosage, :route, :notes, :loc, :uid,
                    timezone('utc', now()), 'DISPENSED', timezone('utc', now()), timezone('utc', now()))
            RETURNING id
        """), {
            "pid": str(patient["id"]), "mid": str(line["medicine_id"]), "qty": line["quantity"],
            "dosage": line["dosage"] or None, "route": line["route"], "notes": line["notes"] or None,
            "loc": str(line["location_id"]), "uid": str(user_id),
        }).scalar()
        try:
            before, after = change_stock(line["stock_id"], -line["quantity"])
        except ValueError as e:  # stock changed since the line was added
            raise ValueError(f"{line['medicine_name']}: {e}") from e
        change_source_balance(line["stock_id"], line["source"], -line["quantity"],
                              partner_org_id=line["partner_org_id"])
        record_movement(
            performed_by=user_id, movement_type="ISSUE", direction="OUT", medicine_id=line["medicine_id"],
            quantity=line["quantity"], stock_before=before, stock_after=after,
            from_location_id=line["location_id"], patient_id=patient["id"],
            reference_type="dispensing_record", reference_id=record_id,
            reason=f"Dispensed to {patient['uhid']}",
            notes=logic.source_label(line["source"], line["partner_name"]),
        )
        return record_id

    return _transaction(lambda: [dispense_line(line) for line in lines])


def recent_dispensing(limit: int = 10) -> List[Dict[str, Any]]:
    return _all("""
        SELECT d.dispensed_at, p.full_name AS patient, m.medicine_name AS medicine,
               d.dispensed_quantity::int AS quantity, d.dosage, d.route, u.email AS dispensed_by
        FROM public.dispensing_records d
        JOIN public.patients p ON d.patient_id = p.id
        JOIN public.medicine_master m ON d.medicine_id = m.id
        LEFT JOIN public.users u ON d.dispensed_by = u.id
        WHERE p.organization_id = :org
        ORDER BY d.dispensed_at DESC NULLS LAST
        LIMIT :limit
    """, {"org": saranam_org_id(), "limit": limit})


def emar(patient_id, limit: int = 20) -> List[Dict[str, Any]]:
    return _all("""
        SELECT d.dispensed_at, m.medicine_name AS medicine, d.dosage, d.route,
               d.dispensed_quantity::int AS quantity, u.email AS dispensed_by,
               d.special_instructions AS notes
        FROM public.dispensing_records d
        JOIN public.medicine_master m ON d.medicine_id = m.id
        LEFT JOIN public.users u ON d.dispensed_by = u.id
        WHERE d.patient_id = :pid
        ORDER BY d.dispensed_at DESC NULLS LAST
        LIMIT :limit
    """, {"pid": str(patient_id), "limit": limit})


def dispensing_summary(start: date, end: date) -> List[Dict[str, Any]]:
    return _all("""
        SELECT d.dispensed_at, p.full_name AS patient, m.medicine_name AS medicine,
               d.dispensed_quantity::int AS quantity, d.dosage, d.route, u.email AS dispensed_by
        FROM public.dispensing_records d
        JOIN public.patients p ON d.patient_id = p.id
        JOIN public.medicine_master m ON d.medicine_id = m.id
        LEFT JOIN public.users u ON d.dispensed_by = u.id
        WHERE p.organization_id = :org AND d.dispensed_at::date BETWEEN :start AND :end
        ORDER BY d.dispensed_at DESC
    """, {"org": saranam_org_id(), "start": start, "end": end})


# ---------------------------------------------------------------------------
# Returns & recalls, medication errors
# ---------------------------------------------------------------------------

def returns_log(type_filter: str = "All") -> List[Dict[str, Any]]:
    sql = """
        SELECT rr.id, rr.type, m.medicine_name, rr.quantity, rr.reason, rr.adverse_reaction,
               rr.reported_by, rr.reported_at, rr.status
        FROM inventory.returns_recalls rr
        JOIN public.medicine_master m ON rr.medicine_id = m.id
    """
    if type_filter == "All":
        return _all(sql + " ORDER BY rr.reported_at DESC")
    return _all(sql + " WHERE rr.type = :t ORDER BY rr.reported_at DESC", {"t": type_filter})


def report_return_recall(*, user_id, email: str, rr_type: str, medicine_id, quantity: int,
                         reason: str, adverse_reaction) -> None:
    """Log a return or recall. A return with quantity puts units back on the medicine's first
    stock row; the source is unknown, so they count as unattributed. Recalls don't change stock."""
    def run():
        db.session.execute(text("""
            INSERT INTO inventory.returns_recalls
               (type, medicine_id, quantity, reason, adverse_reaction, reported_by)
            VALUES (:t, :mid, :qty, :reason, :adverse, :by)
        """), {"t": rr_type, "mid": str(medicine_id), "qty": quantity, "reason": reason,
               "adverse": adverse_reaction or None, "by": email})
        if rr_type == "return" and quantity > 0:
            existing = _one(
                "SELECT id, location_id FROM public.inventory_stock WHERE medicine_id = :mid ORDER BY created_at LIMIT 1",
                {"mid": str(medicine_id)},
            )
            if existing:
                before, after = change_stock(existing["id"], quantity)
                record_movement(
                    performed_by=user_id, movement_type="RETURN", direction="IN", medicine_id=medicine_id,
                    quantity=quantity, stock_before=before, stock_after=after,
                    to_location_id=existing["location_id"], reference_type="inventory_app_return", reason=reason,
                )
    _transaction(run)


def errors_log(status_filter: str = "All") -> List[Dict[str, Any]]:
    sql = """
        SELECT me.id, me.error_type, me.severity, me.status,
               m.medicine_name, p.full_name AS patient_name,
               me.description, me.reported_by, me.reported_at
        FROM inventory.medication_errors me
        LEFT JOIN public.medicine_master m ON me.medicine_id = m.id
        LEFT JOIN public.patients p ON me.patient_id = p.id
    """
    if status_filter != "All":
        return _all(sql + " WHERE me.status = :s ORDER BY me.reported_at DESC", {"s": status_filter})
    return _all(sql + " ORDER BY me.reported_at DESC")


def open_error_count() -> int:
    return _one("SELECT COUNT(*) AS c FROM inventory.medication_errors WHERE status = 'open'")["c"]


def update_error_status(error_id: int, status: str) -> None:
    _transaction(lambda: db.session.execute(
        text("UPDATE inventory.medication_errors SET status = :s WHERE id = :id"), {"s": status, "id": error_id}))


def report_error(*, email: str, error_type: str, severity: str, patient_id, medicine_id, description: str) -> None:
    _transaction(lambda: db.session.execute(text("""
        INSERT INTO inventory.medication_errors
           (error_type, patient_id, medicine_id, description, severity, reported_by)
        VALUES (:et, :pid, :mid, :description, :severity, :by)
    """), {"et": error_type, "pid": None if patient_id is None else str(patient_id),
           "mid": None if medicine_id is None else str(medicine_id),
           "description": description, "severity": severity, "by": email}))


def error_summary() -> List[Dict[str, Any]]:
    return _all("""
        SELECT error_type, severity, status, COUNT(*) AS count
        FROM inventory.medication_errors
        GROUP BY error_type, severity, status
        ORDER BY count DESC
    """)


# ---------------------------------------------------------------------------
# Admin: allergies, emergency meds, audit log
# ---------------------------------------------------------------------------

def save_allergies(patient_id, allergies: Optional[str], email: str) -> None:
    _transaction(lambda: db.session.execute(text("""
        INSERT INTO inventory.patient_allergies (patient_id, allergies, updated_by)
        VALUES (:pid, :allergies, :by)
        ON CONFLICT (patient_id) DO UPDATE
        SET allergies = EXCLUDED.allergies, updated_by = EXCLUDED.updated_by, updated_at = now()
    """), {"pid": str(patient_id), "allergies": allergies, "by": email}))


def emergency_meds_admin() -> List[Dict[str, Any]]:
    return _all("""
        SELECT em.id, m.medicine_name AS name, m.strength, em.location, em.quantity
        FROM inventory.emergency_meds em
        JOIN public.medicine_master m ON em.medicine_id = m.id
        ORDER BY em.location, m.medicine_name
    """)


def emergency_meds_report() -> List[Dict[str, Any]]:
    return _all("""
        SELECT em.location, m.medicine_name AS name, m.strength, em.quantity, em.updated_at
        FROM inventory.emergency_meds em
        JOIN public.medicine_master m ON em.medicine_id = m.id
        ORDER BY em.location, m.medicine_name
    """)


def add_emergency_med(medicine_id, location: str, quantity: int) -> None:
    _transaction(lambda: db.session.execute(text(
        "INSERT INTO inventory.emergency_meds (medicine_id, location, quantity) VALUES (:mid, :loc, :qty)"
    ), {"mid": str(medicine_id), "loc": location, "qty": quantity}))


def log_action(email: str, action: str, entity: str = None, entity_id=None, detail: str = None) -> None:
    """One audit row, written in its own transaction after the action (as in the Streamlit app)."""
    _transaction(lambda: db.session.execute(text("""
        INSERT INTO inventory.audit_log (user_email, action, entity, entity_id, detail)
        VALUES (:email, :action, :entity, :eid, :detail)
    """), {"email": email or "system", "action": action, "entity": entity,
           "eid": None if entity_id is None else str(entity_id), "detail": detail}))


def audit_log(limit: int) -> List[Dict[str, Any]]:
    return _all(
        "SELECT ts, user_email, action, entity, entity_id, detail FROM inventory.audit_log ORDER BY ts DESC LIMIT :limit",
        {"limit": limit},
    )
