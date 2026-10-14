"""teleconsult: add direction (inbound/outbound) to tele_sessions

Revision ID: a7b8c9d0e1f2
Revises: z6a7b8c9d0e1
Create Date: 2026-04-29 05:15:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = 'a7b8c9d0e1f2'
down_revision = 'z6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    has_col = bind.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name='tele_sessions' AND column_name='direction'"
    )).scalar()
    if not has_col:
        op.add_column(
            'tele_sessions',
            sa.Column('direction', sa.String(16), nullable=False, server_default='outbound'),
        )
        op.create_index(
            'idx_tele_sessions_direction',
            'tele_sessions',
            ['direction', 'created_at'],
        )


def downgrade():
    op.drop_index('idx_tele_sessions_direction', table_name='tele_sessions')
    op.drop_column('tele_sessions', 'direction')
