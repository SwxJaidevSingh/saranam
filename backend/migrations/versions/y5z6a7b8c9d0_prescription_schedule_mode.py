"""add schedule_mode + custom_timings to opd_prescription_items

Revision ID: y5z6a7b8c9d0
Revises: x4y5z6a7b8c9
Create Date: 2026-04-18 13:00:00.000000

Meeting §5.2 (2026-04-14): prescription timing was hardcoded to the opioid
preset (6/10/2/6/10). Non-opioid medicines commonly follow morning/afternoon/
night dosing or completely custom schedules.

Per-medicine `schedule_mode` selects which timing columns are meaningful:
  - 'opioid' (default) → dosage_6am/10am/2pm/6pm/10pm (5 fixed slots)
  - 'tds'              → dosage_morning/afternoon/night (legacy 3-slot columns, reused)
  - 'custom'           → custom_timings JSONB: [{"time": "HH:MM"|"morning"|..., "dose": "1"|"½"|...}]

All existing rows are opioid by default — no behavior change for current data.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'y5z6a7b8c9d0'
down_revision = 'x4y5z6a7b8c9'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()

    def col_exists(name):
        return bind.execute(sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name='opd_prescription_items' AND column_name=:n"
        ), {'n': name}).scalar()

    if not col_exists('schedule_mode'):
        op.add_column(
            'opd_prescription_items',
            sa.Column('schedule_mode', sa.String(20), nullable=False, server_default='opioid'),
        )

    if not col_exists('custom_timings'):
        op.add_column(
            'opd_prescription_items',
            sa.Column('custom_timings', postgresql.JSONB, nullable=True),
        )


def downgrade():
    op.drop_column('opd_prescription_items', 'custom_timings')
    op.drop_column('opd_prescription_items', 'schedule_mode')
