"""add hospital_uhid to patients (hospital-issued ID from Kidwai/KCGH file)

Revision ID: u1v2w3x4y5z6
Revises: t0u1v2w3x4y5
Create Date: 2026-04-17 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'u1v2w3x4y5z6'
down_revision = 't0u1v2w3x4y5'
branch_labels = None
depends_on = None


def upgrade():
    # Hospital UHID is issued by the external hospital (Kidwai, KC General) and
    # copied from the patient's hospital file. Stored as free-form string because
    # we don't control the format and real data already contains mixed shapes
    # (10-11 digit numerics, occasional slashes/dashes). Nullable because the
    # number is often unknown at registration and filled in later.
    # Idempotent: some dev DBs already got this column via an ad-hoc add, so
    # guard with an information_schema lookup before adding.
    bind = op.get_bind()
    exists = bind.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name='patients' AND column_name='hospital_uhid'"
    )).scalar()
    if not exists:
        op.add_column(
            'patients',
            sa.Column('hospital_uhid', sa.String(30), nullable=True),
        )


def downgrade():
    op.drop_column('patients', 'hospital_uhid')
