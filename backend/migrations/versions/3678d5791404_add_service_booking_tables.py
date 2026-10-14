"""Add Service Booking tables

Revision ID: 3678d5791404
Revises: dd2fbe5d6e39
Create Date: 2026-03-09 10:57:39.408018

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = '3678d5791404'
down_revision = 'dd2fbe5d6e39'
branch_labels = None
depends_on = None


def upgrade():
    # service_id was already added in the previous migration, 
    # but we need the match fields for the LLM extraction logic.
    op.add_column('bulk_import_items',
                  sa.Column('service_match_type', sa.String(50), nullable=True))

    op.add_column('bulk_import_items',
                  sa.Column('service_match_score', sa.Integer, nullable=True))

    # Create index on service_id for faster lookups (was not created in the first migration)
    op.create_index('idx_bulk_items_service_id', 'bulk_import_items', ['service_id'])


def downgrade():
    # Drop index
    op.drop_index('idx_bulk_items_service_id', 'bulk_import_items')

    # Drop columns
    op.drop_column('bulk_import_items', 'service_match_score')
    op.drop_column('bulk_import_items', 'service_match_type')
