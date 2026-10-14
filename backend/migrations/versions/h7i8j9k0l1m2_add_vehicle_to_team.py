"""add vehicle_id to schedule_team_assignments

Revision ID: h7i8j9k0l1m2
Revises: g6h7i8j9k0l1
Create Date: 2026-04-01 06:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'h7i8j9k0l1m2'
down_revision = 'g6h7i8j9k0l1'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('schedule_team_assignments',
                  sa.Column('vehicle_id', postgresql.UUID(), nullable=True))
    op.create_foreign_key('fk_team_assignment_vehicle_id', 'schedule_team_assignments', 'vehicles', ['vehicle_id'], ['id'])
    op.create_index('ix_team_assignments_vehicle_id', 'schedule_team_assignments', ['vehicle_id'])
    # Drop old unique constraint and create new one with vehicle_id
    op.drop_constraint('uq_team_assignment_day_provider', 'schedule_team_assignments', type_='unique')
    op.create_unique_constraint('uq_team_assignment_day_role_vehicle', 'schedule_team_assignments', ['schedule_day_id', 'role', 'vehicle_id'])


def downgrade():
    op.drop_constraint('uq_team_assignment_day_role_vehicle', 'schedule_team_assignments', type_='unique')
    op.create_unique_constraint('uq_team_assignment_day_provider', 'schedule_team_assignments', ['schedule_day_id', 'provider_id'])
    op.drop_index('ix_team_assignments_vehicle_id', table_name='schedule_team_assignments')
    op.drop_constraint('fk_team_assignment_vehicle_id', 'schedule_team_assignments', type_='foreignkey')
    op.drop_column('schedule_team_assignments', 'vehicle_id')
