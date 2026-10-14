"""add diagnosis, referred_from, is_approximate_dob columns

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-03-30 21:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'c2d3e4f5a6b7'
down_revision = 'b1c2d3e4f5a6'
branch_labels = None
depends_on = None


def upgrade():
    # diagnosis column already exists from earlier migration
    op.add_column('patients',
                  sa.Column('referred_from', sa.String(100), nullable=True))
    op.add_column('patients',
                  sa.Column('is_approximate_dob', sa.Boolean(), server_default='false', nullable=False))


def downgrade():
    op.drop_column('patients', 'is_approximate_dob')
    op.drop_column('patients', 'referred_from')
