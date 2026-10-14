"""Medicine structured strength: components + concentration denominator

Revision ID: c5e6f7a8b9c0
Revises: b4d5e6f7a8b9
Create Date: 2026-06-18 00:00:00.000000

Adds structured strength to medicine_master so concentrations (e.g. "500 mg / 2 ml")
and combinations (e.g. "100 mg + 325 mg") are first-class instead of being parsed out
of a free-text string. The existing `strength` string column is kept as a derived
display value, so all existing read sites keep working unchanged.

  - strength_components : JSONB  -> [{ "value": <num>, "unit": "<str>" }, ...]
  - strength_per_value  : Numeric-> concentration denominator (2 for "/2 ml")
  - strength_per_unit   : String -> denominator unit ("ml")

Additive only — all columns nullable, no existing column altered.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'c5e6f7a8b9c0'
down_revision = 'b4d5e6f7a8b9'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('medicine_master',
                  sa.Column('strength_components', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('medicine_master',
                  sa.Column('strength_per_value', sa.Numeric(10, 3), nullable=True))
    op.add_column('medicine_master',
                  sa.Column('strength_per_unit', sa.String(10), nullable=True))


def downgrade():
    op.drop_column('medicine_master', 'strength_per_unit')
    op.drop_column('medicine_master', 'strength_per_value')
    op.drop_column('medicine_master', 'strength_components')
