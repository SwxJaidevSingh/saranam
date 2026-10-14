"""add scheduled_time and visit_duration_minutes to schedule_slots

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-03-30 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'e4f5a6b7c8d9'
down_revision = 'd3e4f5a6b7c8'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('schedule_slots',
                  sa.Column('scheduled_time', sa.Time(), nullable=True))
    op.add_column('schedule_slots',
                  sa.Column('visit_duration_minutes', sa.Integer(), nullable=True, server_default='30'))


def downgrade():
    op.drop_column('schedule_slots', 'visit_duration_minutes')
    op.drop_column('schedule_slots', 'scheduled_time')
