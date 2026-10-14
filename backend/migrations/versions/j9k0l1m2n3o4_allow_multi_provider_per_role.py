"""allow multiple providers per role in team assignments

Revision ID: j9k0l1m2n3o4
Revises: i8j9k0l1m2n3
Create Date: 2026-04-01 17:30:00.000000

"""
from alembic import op

revision = 'j9k0l1m2n3o4'
down_revision = 'i8j9k0l1m2n3'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint('uq_team_assignment_day_role_vehicle', 'schedule_team_assignments', type_='unique')
    op.create_unique_constraint(
        'uq_team_assignment_day_role_provider_vehicle',
        'schedule_team_assignments',
        ['schedule_day_id', 'role', 'provider_id', 'vehicle_id']
    )


def downgrade():
    op.drop_constraint('uq_team_assignment_day_role_provider_vehicle', 'schedule_team_assignments', type_='unique')
    op.create_unique_constraint(
        'uq_team_assignment_day_role_vehicle',
        'schedule_team_assignments',
        ['schedule_day_id', 'role', 'vehicle_id']
    )
