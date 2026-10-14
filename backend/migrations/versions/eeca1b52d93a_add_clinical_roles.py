"""add clinical roles

Revision ID: eeca1b52d93a
Revises: d6e7f8a9b0c1
Create Date: 2026-06-22 19:00:35.771151

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'eeca1b52d93a'
down_revision = 'd6e7f8a9b0c1'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'doctor'")
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'nurse'")
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'physiotherapist'")
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'counsellor'")
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'data_entry'")