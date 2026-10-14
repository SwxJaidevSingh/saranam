"""Enhance bulk import tables for pure logic system

Revision ID: f8a4b2c9d1e3
Revises: e6b57bd78fc2
Create Date: 2026-03-13 22:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = 'f8a4b2c9d1e3'
down_revision = 'e6b57bd78fc2'
branch_labels = None
depends_on = None


def upgrade():
    # Add new columns to bulk_import_sessions for pure logic tracking
    op.add_column('bulk_import_sessions',
                  sa.Column('uses_pure_logic', sa.Boolean, server_default='false', nullable=False))
    op.add_column('bulk_import_sessions',
                  sa.Column('auto_approved_count', sa.Integer, server_default='0'))
    op.add_column('bulk_import_sessions',
                  sa.Column('needs_review_count', sa.Integer, server_default='0'))
    op.add_column('bulk_import_sessions',
                  sa.Column('rejected_count', sa.Integer, server_default='0'))
    op.add_column('bulk_import_sessions',
                  sa.Column('skipped_count', sa.Integer, server_default='0'))
    op.add_column('bulk_import_sessions',
                  sa.Column('conflict_summary', JSONB, nullable=True))

    # Add new columns to bulk_import_items for enhanced conflict resolution
    op.add_column('bulk_import_items',
                  sa.Column('suggested_alternatives', JSONB, nullable=True))
    op.add_column('bulk_import_items',
                  sa.Column('service_match_type', sa.String(50), nullable=True))
    op.add_column('bulk_import_items',
                  sa.Column('service_match_score', sa.Integer, nullable=True))
    op.add_column('bulk_import_items',
                  sa.Column('resolved_by', sa.ForeignKey('users.id'), nullable=True))
    op.add_column('bulk_import_items',
                  sa.Column('resolved_at', sa.DateTime, nullable=True))
    op.add_column('bulk_import_items',
                  sa.Column('conflict_severity', sa.String(20), nullable=True))

    # Create index for conflict queries
    op.create_index('idx_bulk_items_has_conflict', 'bulk_import_items', ['has_conflict'])
    op.create_index('idx_bulk_items_conflict_type', 'bulk_import_items', ['conflict_type'])


def downgrade():
    # Drop indexes
    op.drop_index('idx_bulk_items_conflict_type', 'bulk_import_items')
    op.drop_index('idx_bulk_items_has_conflict', 'bulk_import_items')

    # Drop columns from bulk_import_items
    op.drop_column('bulk_import_items', 'conflict_severity')
    op.drop_column('bulk_import_items', 'resolved_at')
    op.drop_column('bulk_import_items', 'resolved_by')
    op.drop_column('bulk_import_items', 'service_match_score')
    op.drop_column('bulk_import_items', 'service_match_type')
    op.drop_column('bulk_import_items', 'suggested_alternatives')

    # Drop columns from bulk_import_sessions
    op.drop_column('bulk_import_sessions', 'conflict_summary')
    op.drop_column('bulk_import_sessions', 'skipped_count')
    op.drop_column('bulk_import_sessions', 'rejected_count')
    op.drop_column('bulk_import_sessions', 'needs_review_count')
    op.drop_column('bulk_import_sessions', 'auto_approved_count')
    op.drop_column('bulk_import_sessions', 'uses_pure_logic')
