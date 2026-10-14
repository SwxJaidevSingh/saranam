"""
Add service support to bulk imports

This migration adds service-related fields to bulk_import_items table.

To apply this migration:
1. Copy content to a new migration file created with:
   flask db revision -m "Add service support to bulk imports"
2. Run: flask db upgrade
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
# NOTE: These will be auto-generated when you run `flask db revision`
revision = 'xxxxx'  # Will be auto-generated
down_revision = 'yyyyy'  # Will be previous migration (bulk import tables)
branch_labels = None
depends_on = None


def upgrade():
    # Add service-related columns to bulk_import_items
    op.add_column('bulk_import_items',
                  sa.Column('service_id', UUID(as_uuid=True),
                           sa.ForeignKey('services.id'), nullable=True))

    op.add_column('bulk_import_items',
                  sa.Column('service_match_type', sa.String(50), nullable=True))

    op.add_column('bulk_import_items',
                  sa.Column('service_match_score', sa.Integer, nullable=True))

    # Create index on service_id for faster lookups
    op.create_index('idx_bulk_items_service_id', 'bulk_import_items', ['service_id'])


def downgrade():
    # Drop index
    op.drop_index('idx_bulk_items_service_id', 'bulk_import_items')

    # Drop columns
    op.drop_column('bulk_import_items', 'service_match_score')
    op.drop_column('bulk_import_items', 'service_match_type')
    op.drop_column('bulk_import_items', 'service_id')
