"""make bsc_status, is_onco, clinical_complexity nullable

Revision ID: b1c2d3e4f5a6
Revises: a9b0c1d2e3f4
Create Date: 2026-03-30 21:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'b1c2d3e4f5a6'
down_revision = 'a9b0c1d2e3f4'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('patients', 'bsc_status', nullable=True, server_default=None)
    op.alter_column('patients', 'is_onco', nullable=True, server_default=None)
    op.alter_column('patients', 'clinical_complexity', nullable=True, server_default=None)


def downgrade():
    op.execute("UPDATE patients SET bsc_status = false WHERE bsc_status IS NULL")
    op.execute("UPDATE patients SET is_onco = true WHERE is_onco IS NULL")
    op.execute("UPDATE patients SET clinical_complexity = 'medium' WHERE clinical_complexity IS NULL")
    op.alter_column('patients', 'bsc_status', nullable=False, server_default='false')
    op.alter_column('patients', 'is_onco', nullable=False, server_default='true')
    op.alter_column('patients', 'clinical_complexity', nullable=True, server_default='medium')
