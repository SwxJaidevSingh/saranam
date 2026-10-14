"""Add missing provider count to bulk import sessions

Revision ID: f53aa63caa72
Revises: ea9b8cf2fa5c
Create Date: 2026-03-14 05:36:47.223266

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f53aa63caa72'
down_revision = 'ea9b8cf2fa5c'
branch_labels = None
depends_on = None


def upgrade():
    # Add missing_provider_count column to bulk_import_sessions
    op.add_column('bulk_import_sessions',
                  sa.Column('missing_provider_count', sa.Integer(), server_default='0', nullable=False))


def downgrade():
    # Drop missing_provider_count column
    op.drop_column('bulk_import_sessions', 'missing_provider_count')
