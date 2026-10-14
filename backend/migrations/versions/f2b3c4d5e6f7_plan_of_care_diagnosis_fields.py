"""Plan of Care: add diagnosis_text + icd10_diagnosis (prescription diagnosis)

Revision ID: f2b3c4d5e6f7
Revises: e1f2a3b4c5d6
Create Date: 2026-06-15 00:00:00.000000

The Plan of Care / Prescription form collects an ICD-10 diagnosis and a
free-text diagnosis, and the frontend already sends/reads `icd10_diagnosis`
and `diagnosis_text` — but `plans_of_care` had no columns for them, so the
generic assessment dispatcher silently dropped both on every save. Add the two
nullable TEXT columns so the diagnosis actually persists. Additive, no data risk.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f2b3c4d5e6f7'
down_revision = 'e1f2a3b4c5d6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('plans_of_care', sa.Column('icd10_diagnosis', sa.Text(), nullable=True))
    op.add_column('plans_of_care', sa.Column('diagnosis_text', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('plans_of_care', 'diagnosis_text')
    op.drop_column('plans_of_care', 'icd10_diagnosis')
