"""add_analytics_cache_tables

Revision ID: d8d9a5a627d7
Revises: 0f17ad6df3df
Create Date: 2026-03-02 03:52:51.777519

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd8d9a5a627d7'
down_revision = '0f17ad6df3df'
branch_labels = None
depends_on = None


def upgrade():
    # Create analytics_cache table for performance
    op.create_table(
        'analytics_cache',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('cache_key', sa.String(255), unique=True, nullable=False),
        sa.Column('metric_type', sa.String(100), nullable=False),
        sa.Column('filters', sa.dialects.postgresql.JSONB),
        sa.Column('result', sa.dialects.postgresql.JSONB, nullable=False),
        sa.Column('expires_at', sa.DateTime, nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('CURRENT_TIMESTAMP'))
    )

    # Create indexes for faster queries
    op.create_index('idx_analytics_cache_key', 'analytics_cache', ['cache_key'])
    op.create_index('idx_analytics_cache_expires', 'analytics_cache', ['expires_at'])
    op.create_index('idx_analytics_cache_metric', 'analytics_cache', ['metric_type'])


def downgrade():
    op.drop_index('idx_analytics_cache_metric')
    op.drop_index('idx_analytics_cache_expires')
    op.drop_index('idx_analytics_cache_key')
    op.drop_table('analytics_cache')
