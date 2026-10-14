"""add service_radius_km to schedule_config

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-03-31 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'd3e4f5a6b7c8'
down_revision = 'c2d3e4f5a6b7'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('schedule_config',
                  sa.Column('service_radius_km', sa.Integer(), server_default='15', nullable=False))


def downgrade():
    op.drop_column('schedule_config', 'service_radius_km')
