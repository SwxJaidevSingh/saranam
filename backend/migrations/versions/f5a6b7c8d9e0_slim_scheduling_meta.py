"""remove duplicated columns from patient_scheduling_meta

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-04-01 02:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'f5a6b7c8d9e0'
down_revision = 'e4f5a6b7c8d9'
branch_labels = None
depends_on = None


def upgrade():
    # Drop columns that duplicate data from the patients table
    op.drop_column('patient_scheduling_meta', 'care_status')
    op.drop_column('patient_scheduling_meta', 'complexity')
    op.drop_column('patient_scheduling_meta', 'is_onco')
    op.drop_column('patient_scheduling_meta', 'recently_hospitalized')
    op.drop_column('patient_scheduling_meta', 'hospital_discharge_date')
    # Drop cluster_id FK (zones on patient table are sufficient)
    op.drop_constraint('patient_scheduling_meta_cluster_id_fkey', 'patient_scheduling_meta', type_='foreignkey')
    op.drop_column('patient_scheduling_meta', 'cluster_id')


def downgrade():
    op.add_column('patient_scheduling_meta', sa.Column('cluster_id', postgresql.UUID(), nullable=True))
    op.add_column('patient_scheduling_meta', sa.Column('care_status', sa.String(10), nullable=True))
    op.add_column('patient_scheduling_meta', sa.Column('complexity', sa.String(20), nullable=True))
    op.add_column('patient_scheduling_meta', sa.Column('is_onco', sa.Boolean(), nullable=True))
    op.add_column('patient_scheduling_meta', sa.Column('recently_hospitalized', sa.Boolean(), server_default='false'))
    op.add_column('patient_scheduling_meta', sa.Column('hospital_discharge_date', sa.Date(), nullable=True))
    op.create_foreign_key('patient_scheduling_meta_cluster_id_fkey', 'patient_scheduling_meta', 'geographic_clusters', ['cluster_id'], ['id'])
