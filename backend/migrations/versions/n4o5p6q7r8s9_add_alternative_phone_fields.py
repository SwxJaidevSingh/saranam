"""add alternative phone fields to patients

Revision ID: n4o5p6q7r8s9
Revises: m3n4o5p6q7r8
Create Date: 2026-04-07 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'n4o5p6q7r8s9'
down_revision = 'm3n4o5p6q7r8'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('patients', sa.Column('alternative_phone', sa.String(20), nullable=True))
    op.add_column('patients', sa.Column('alternative_phone_name', sa.String(100), nullable=True))


def downgrade():
    op.drop_column('patients', 'alternative_phone_name')
    op.drop_column('patients', 'alternative_phone')
