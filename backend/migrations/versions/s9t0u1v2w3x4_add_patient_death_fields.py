"""add is_deceased and date_of_death to patients for palliative outcome tracking

Revision ID: s9t0u1v2w3x4
Revises: r8s9t0u1v2w3
Create Date: 2026-04-11 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 's9t0u1v2w3x4'
down_revision = 'r8s9t0u1v2w3'
branch_labels = None
depends_on = None


def upgrade():
    # Palliative outcome fields set on the last visit form when the team
    # learns of the patient's death. Backfill-safe: is_deceased defaults to
    # false for every existing row.
    op.add_column(
        'patients',
        sa.Column('is_deceased', sa.Boolean(), nullable=False, server_default=sa.text('false'))
    )
    op.add_column(
        'patients',
        sa.Column('date_of_death', sa.Date(), nullable=True)
    )
    op.create_index('ix_patients_is_deceased', 'patients', ['is_deceased'])
    op.create_index('ix_patients_date_of_death', 'patients', ['date_of_death'])


def downgrade():
    op.drop_index('ix_patients_date_of_death', table_name='patients')
    op.drop_index('ix_patients_is_deceased', table_name='patients')
    op.drop_column('patients', 'date_of_death')
    op.drop_column('patients', 'is_deceased')
