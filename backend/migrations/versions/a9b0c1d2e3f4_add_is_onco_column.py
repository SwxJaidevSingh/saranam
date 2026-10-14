"""add is_onco column to patients and patient_scheduling_meta

Revision ID: a9b0c1d2e3f4
Revises: 788adf543a80
Create Date: 2026-03-30 19:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'a9b0c1d2e3f4'
down_revision = '788adf543a80'
branch_labels = None
depends_on = None


def upgrade():
    # Add is_onco to patients table (default True — existing patients from Kidwai are onco)
    op.add_column('patients',
                  sa.Column('is_onco', sa.Boolean(), server_default='true', nullable=False))

    # Add is_onco to patient_scheduling_meta table
    op.add_column('patient_scheduling_meta',
                  sa.Column('is_onco', sa.Boolean(), server_default='true', nullable=False))


def downgrade():
    op.drop_column('patient_scheduling_meta', 'is_onco')
    op.drop_column('patients', 'is_onco')
