"""Add Bangalore zone clustering and BSC status to patients

Revision ID: a1b2c3d4e5f6
Revises: aae60e76fcb3
Create Date: 2026-03-24 06:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'aae60e76fcb3'
branch_labels = None
depends_on = None


def upgrade():
    # Only add is_bangalore_resident — other columns (geographic_cluster, bsc_status,
    # clinical_complexity) were already added by a previous migration (ec8f57118a55)
    op.add_column('patients',
                  sa.Column('is_bangalore_resident', sa.Boolean, server_default='false', nullable=False))


def downgrade():
    op.drop_column('patients', 'is_bangalore_resident')
