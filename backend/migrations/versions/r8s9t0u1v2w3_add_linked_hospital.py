"""add linked_hospital to patients for Homecare UHID Code prefix

Revision ID: r8s9t0u1v2w3
Revises: q7r8s9t0u1v2
Create Date: 2026-04-11 08:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'r8s9t0u1v2w3'
down_revision = 'q7r8s9t0u1v2'
branch_labels = None
depends_on = None


def upgrade():
    # Nullable so existing patients are unaffected. Required via schema validator
    # when is_bangalore_resident=True. Values are constrained to the hospital
    # catalog in app.patients.uhid_service.HOSPITAL_CATALOG.
    op.add_column(
        'patients',
        sa.Column('linked_hospital', sa.String(10), nullable=True)
    )


def downgrade():
    op.drop_column('patients', 'linked_hospital')
