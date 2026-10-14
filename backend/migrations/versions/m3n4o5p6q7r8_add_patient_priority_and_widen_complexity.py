"""add patient_priority column and widen clinical_complexity

Revision ID: m3n4o5p6q7r8
Revises: l2m3n4o5p6q7
Create Date: 2026-04-04 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'm3n4o5p6q7r8'
down_revision = 'l2m3n4o5p6q7'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('patients', 'clinical_complexity',
                    type_=sa.String(20),
                    existing_type=sa.String(10),
                    existing_nullable=True)
    op.add_column('patients', sa.Column('patient_priority', sa.String(20), nullable=True))


def downgrade():
    op.drop_column('patients', 'patient_priority')
    op.alter_column('patients', 'clinical_complexity',
                    type_=sa.String(10),
                    existing_type=sa.String(20),
                    existing_nullable=True)
