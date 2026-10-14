"""The ``inventory`` schema shared with the Saranam Streamlit inventory app.

Same idempotent DDL the Streamlit app runs on startup (``utils/db.py`` ``_SCHEMA``):
tables for features the EHR has no tables for, plus the default drug categories.
The EHR's Alembic migrations manage ``public`` only, so these stay out of Alembic.
"""
import threading

from app.extensions import db

SCHEMA_SQL = """
CREATE SCHEMA IF NOT EXISTS inventory;

CREATE TABLE IF NOT EXISTS inventory.drug_categories (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            TEXT        UNIQUE NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory.medicine_meta (
    medicine_id     UUID        PRIMARY KEY REFERENCES public.medicine_master(id) ON DELETE CASCADE,
    category_id     INTEGER     REFERENCES inventory.drug_categories(id) ON DELETE SET NULL,
    in_formulary    BOOLEAN     NOT NULL DEFAULT TRUE,
    notes           TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory.stock_source_balance (
    stock_id        UUID        NOT NULL REFERENCES public.inventory_stock(id) ON DELETE CASCADE,
    source          TEXT        NOT NULL CHECK (source IN ('saranam','partner')),
    quantity        INTEGER     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    PRIMARY KEY (stock_id, source)
);
ALTER TABLE inventory.stock_source_balance
    ADD COLUMN IF NOT EXISTS reorder_level INTEGER CHECK (reorder_level >= 0);

CREATE TABLE IF NOT EXISTS inventory.partner_receipts (
    movement_id     UUID        PRIMARY KEY REFERENCES public.stock_movements(id) ON DELETE CASCADE,
    stock_id        UUID        NOT NULL REFERENCES public.inventory_stock(id) ON DELETE CASCADE,
    partner_org_id  UUID        NOT NULL REFERENCES public.organizations(id),
    quantity        INTEGER     NOT NULL CHECK (quantity > 0),
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory.partner_stock_balance (
    stock_id        UUID        NOT NULL REFERENCES public.inventory_stock(id) ON DELETE CASCADE,
    partner_org_id  UUID        NOT NULL REFERENCES public.organizations(id),
    quantity        INTEGER     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    reorder_level   INTEGER     CHECK (reorder_level >= 0),
    PRIMARY KEY (stock_id, partner_org_id)
);

CREATE TABLE IF NOT EXISTS inventory.patient_allergies (
    patient_id      UUID        PRIMARY KEY REFERENCES public.patients(id) ON DELETE CASCADE,
    allergies       TEXT,
    updated_by      TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory.returns_recalls (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type            TEXT        NOT NULL CHECK (type IN ('return','recall')),
    medicine_id     UUID        NOT NULL REFERENCES public.medicine_master(id),
    quantity        INTEGER     NOT NULL DEFAULT 0,
    reason          TEXT        NOT NULL,
    adverse_reaction TEXT,
    reported_by     TEXT        NOT NULL,
    reported_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    status          TEXT        NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','resolved','archived'))
);

CREATE TABLE IF NOT EXISTS inventory.medication_errors (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    error_type      TEXT        NOT NULL
                        CHECK (error_type IN ('wrong_drug','wrong_dose','wrong_patient',
                                               'wrong_route','near_miss','adr','other')),
    patient_id      UUID        REFERENCES public.patients(id) ON DELETE SET NULL,
    medicine_id     UUID        REFERENCES public.medicine_master(id) ON DELETE SET NULL,
    description     TEXT        NOT NULL,
    severity        TEXT        NOT NULL DEFAULT 'low'
                        CHECK (severity IN ('low','medium','high','critical')),
    reported_by     TEXT        NOT NULL,
    reported_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    status          TEXT        NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','investigating','resolved'))
);

CREATE TABLE IF NOT EXISTS inventory.emergency_meds (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    medicine_id     UUID        NOT NULL REFERENCES public.medicine_master(id) ON DELETE CASCADE,
    location        TEXT        NOT NULL,
    quantity        INTEGER     NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory.audit_log (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_email      TEXT        NOT NULL,
    action          TEXT        NOT NULL,
    entity          TEXT,
    entity_id       TEXT,
    detail          TEXT,
    ts              TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO inventory.drug_categories (name) VALUES
    ('Pain Adjuvants'), ('Antibiotics And Antifungal'), ('Consumables'), ('Pain Medication'),
    ('Antiemetic'), ('Laxatives'), ('Protein Powder'), ('Others')
ON CONFLICT (name) DO NOTHING;
"""

_lock = threading.Lock()
_done = False


def ensure_schema() -> None:
    """Create the inventory schema and its tables if missing. Runs once per server process."""
    global _done
    if _done:
        return
    with _lock:
        if _done:
            return
        try:
            db.session.connection().exec_driver_sql(SCHEMA_SQL)
            db.session.commit()
        except Exception:
            db.session.rollback()
            raise
        _done = True
