"""Add provider resolution fields for bulk imports

Revision ID: ea9b8cf2fa5c
Revises: f8a4b2c9d1e3
Create Date: 2026-03-14 05:30:00.976739

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ea9b8cf2fa5c'
down_revision = 'f8a4b2c9d1e3'
branch_labels = None
depends_on = None


def upgrade():
    # Add columns to healthcare_providers table
    op.add_column('healthcare_providers',
                  sa.Column('is_placeholder', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('healthcare_providers',
                  sa.Column('created_from_bulk_import', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('healthcare_providers',
                  sa.Column('bulk_import_session_id', sa.UUID(), nullable=True))

    # Add foreign key constraint
    op.create_foreign_key('fk_provider_bulk_session',
                         'healthcare_providers', 'bulk_import_sessions',
                         ['bulk_import_session_id'], ['id'],
                         ondelete='SET NULL')

    # Add columns to bulk_import_items table
    op.add_column('bulk_import_items',
                  sa.Column('original_provider_name', sa.String(255), nullable=True))
    op.add_column('bulk_import_items',
                  sa.Column('provider_resolution_action', sa.String(50), nullable=True))
    op.add_column('bulk_import_items',
                  sa.Column('provider_created_id', sa.UUID(), nullable=True))

    # Add foreign key constraint
    op.create_foreign_key('fk_item_created_provider',
                         'bulk_import_items', 'healthcare_providers',
                         ['provider_created_id'], ['id'],
                         ondelete='SET NULL')

    # Add index for querying missing providers
    op.create_index('idx_bulk_items_provider_resolution',
                   'bulk_import_items',
                   ['provider_resolution_action', 'original_provider_name'])


def downgrade():
    # Drop indexes
    op.drop_index('idx_bulk_items_provider_resolution', table_name='bulk_import_items')

    # Drop foreign keys
    op.drop_constraint('fk_item_created_provider', 'bulk_import_items', type_='foreignkey')
    op.drop_constraint('fk_provider_bulk_session', 'healthcare_providers', type_='foreignkey')

    # Drop columns from bulk_import_items
    op.drop_column('bulk_import_items', 'provider_created_id')
    op.drop_column('bulk_import_items', 'provider_resolution_action')
    op.drop_column('bulk_import_items', 'original_provider_name')

    # Drop columns from healthcare_providers
    op.drop_column('healthcare_providers', 'bulk_import_session_id')
    op.drop_column('healthcare_providers', 'created_from_bulk_import')
    op.drop_column('healthcare_providers', 'is_placeholder')
