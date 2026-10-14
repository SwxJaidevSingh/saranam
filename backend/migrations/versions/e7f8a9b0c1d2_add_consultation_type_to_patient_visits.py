"""add consultation_type to patient_visits

Revision ID: e7f8a9b0c1d2
Revises: 0e18a9df239d
Create Date: 2026-09-19 16:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = 'e7f8a9b0c1d2'
down_revision = '0e18a9df239d'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    has_col = bind.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name='patient_visits' AND column_name='consultation_type'"
    )).scalar()
    if not has_col:
        op.add_column(
            'patient_visits',
            sa.Column('consultation_type', sa.String(50), nullable=True),
        )


def downgrade():
    op.drop_column('patient_visits', 'consultation_type')
