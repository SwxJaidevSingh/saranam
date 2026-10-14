"""add vehicle_id to schedule_slots for multi-vehicle per day

Revision ID: g6h7i8j9k0l1
Revises: f5a6b7c8d9e0
Create Date: 2026-04-01 05:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'g6h7i8j9k0l1'
down_revision = 'f5a6b7c8d9e0'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('schedule_slots',
                  sa.Column('vehicle_id', postgresql.UUID(), nullable=True))
    op.create_foreign_key('fk_schedule_slots_vehicle_id', 'schedule_slots', 'vehicles', ['vehicle_id'], ['id'])
    op.create_index('ix_schedule_slots_vehicle_id', 'schedule_slots', ['vehicle_id'])


def downgrade():
    op.drop_index('ix_schedule_slots_vehicle_id', table_name='schedule_slots')
    op.drop_constraint('fk_schedule_slots_vehicle_id', 'schedule_slots', type_='foreignkey')
    op.drop_column('schedule_slots', 'vehicle_id')
