"""add primary_caregiver / decision_maker fields to patients (care circle at baseline)

Revision ID: v2w3x4y5z6a7
Revises: u1v2w3x4y5z6
Create Date: 2026-04-18 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'v2w3x4y5z6a7'
down_revision = 'u1v2w3x4y5z6'
branch_labels = None
depends_on = None


CARE_CIRCLE_COLUMNS = [
    ('primary_caregiver_name', sa.String(100)),
    ('primary_caregiver_relationship', sa.String(50)),
    ('primary_caregiver_phone', sa.String(20)),
    ('decision_maker_name', sa.String(100)),
    ('decision_maker_designation', sa.String(50)),
    ('decision_maker_phone', sa.String(20)),
]


def upgrade():
    # Care Circle is captured at the Initial Assessment (baseline), separate
    # from the data-collection caregiver (alternative_phone_*). Primary
    # Caregiver is a family member doing hands-on care; Decision Maker is
    # the clinical authority (treating physician / oncologist / palliative
    # consultant). All nullable — pre-existing patients have empty values.
    # Idempotent: skip any column that already exists on the table.
    bind = op.get_bind()
    for name, coltype in CARE_CIRCLE_COLUMNS:
        exists = bind.execute(sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name='patients' AND column_name=:name"
        ), {'name': name}).scalar()
        if not exists:
            op.add_column('patients', sa.Column(name, coltype, nullable=True))


def downgrade():
    for name, _ in CARE_CIRCLE_COLUMNS:
        op.drop_column('patients', name)
