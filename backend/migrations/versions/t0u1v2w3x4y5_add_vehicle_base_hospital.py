"""add base_hospital to vehicles (per-vehicle route origin)

Revision ID: t0u1v2w3x4y5
Revises: s9t0u1v2w3x4
Create Date: 2026-04-11 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 't0u1v2w3x4y5'
down_revision = 's9t0u1v2w3x4'
branch_labels = None
depends_on = None


def upgrade():
    # NOT NULL + default 'KMIO' safely backfills every existing vehicle to
    # Kidwai, which matches current reality (single-base fleet). Admins can
    # change it per vehicle in Schedule Settings afterward.
    op.add_column(
        'vehicles',
        sa.Column(
            'base_hospital',
            sa.String(10),
            nullable=False,
            server_default='KMIO',
        ),
    )


def downgrade():
    op.drop_column('vehicles', 'base_hospital')
