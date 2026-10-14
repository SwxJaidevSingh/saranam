"""prescription enhancements: time-based dosage, provider designation and signature

Revision ID: p6q7r8s9t0u1
Revises: o5p6q7r8s9t0
Create Date: 2026-04-09 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'p6q7r8s9t0u1'
down_revision = 'o5p6q7r8s9t0'
branch_labels = None
depends_on = None


def upgrade():
    # Time-based dosage columns on prescription items
    op.add_column('opd_prescription_items', sa.Column('dosage_6am', sa.String(10), nullable=True))
    op.add_column('opd_prescription_items', sa.Column('dosage_10am', sa.String(10), nullable=True))
    op.add_column('opd_prescription_items', sa.Column('dosage_2pm', sa.String(10), nullable=True))
    op.add_column('opd_prescription_items', sa.Column('dosage_6pm', sa.String(10), nullable=True))
    op.add_column('opd_prescription_items', sa.Column('dosage_10pm', sa.String(10), nullable=True))

    # Provider designation and signature
    op.add_column('healthcare_providers', sa.Column('designation', sa.String(100), nullable=True))
    op.add_column('healthcare_providers', sa.Column('signature_image', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('opd_prescription_items', 'dosage_10pm')
    op.drop_column('opd_prescription_items', 'dosage_6pm')
    op.drop_column('opd_prescription_items', 'dosage_2pm')
    op.drop_column('opd_prescription_items', 'dosage_10am')
    op.drop_column('opd_prescription_items', 'dosage_6am')
    op.drop_column('healthcare_providers', 'signature_image')
    op.drop_column('healthcare_providers', 'designation')
