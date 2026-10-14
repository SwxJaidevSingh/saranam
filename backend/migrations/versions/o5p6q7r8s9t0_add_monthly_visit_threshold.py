"""add monthly_visit_threshold_days to schedule_config

Revision ID: o5p6q7r8s9t0
Revises: n4o5p6q7r8s9
Create Date: 2026-04-09 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'o5p6q7r8s9t0'
down_revision = 'n4o5p6q7r8s9'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('schedule_config', sa.Column('monthly_visit_threshold_days', sa.Integer(), nullable=False, server_default='30'))


def downgrade():
    op.drop_column('schedule_config', 'monthly_visit_threshold_days')
