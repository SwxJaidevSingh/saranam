"""default patients.organization_id to the internal CVRAMAN org

Phase 1 made patients.organization_id NOT NULL but with NO default, relying on
every create path to set it. The org-aware create_patient fix only lives on the
Hospital Portal branch — so any code that still inserts a patient WITHOUT an
organization_id (the live main app, bulk imports, the submission processor)
would hit a not-null violation once the prior migration is applied.

This migration sets a DB-level default = the CVRAMAN internal org id, so any
insert that omits organization_id is auto-owned by CVRAMAN. The portal continues
to set organization_id explicitly per tenant (overriding the default). Keeps the
NOT NULL constraint intact.

Revision ID: d1e2f3a4b5c6
Revises: c4d5e6f7a8b9
Create Date: 2026-06-10 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'd1e2f3a4b5c6'
down_revision = 'c4d5e6f7a8b9'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    cvraman_id = bind.execute(sa.text(
        "SELECT id FROM organizations WHERE code = 'CVRAMAN'"
    )).scalar()
    if cvraman_id is None:
        raise RuntimeError(
            "CVRAMAN org not found — the multi-tenant foundation migration "
            "(c4d5e6f7a8b9) must run first.")
    # DDL defaults cannot be a subquery, so embed the resolved (DB-sourced) UUID.
    op.execute(sa.text(
        f"ALTER TABLE patients "
        f"ALTER COLUMN organization_id SET DEFAULT '{cvraman_id}'::uuid"
    ))


def downgrade():
    op.execute("ALTER TABLE patients ALTER COLUMN organization_id DROP DEFAULT")
