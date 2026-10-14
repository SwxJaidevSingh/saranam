"""Add AI form builder tables

Revision ID: bf768c05eb59
Revises: 593c579cc146
Create Date: 2026-02-27 08:55:42.594860

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid


# revision identifiers, used by Alembic.
revision = 'bf768c05eb59'
down_revision = '593c579cc146'
branch_labels = None
depends_on = None


def upgrade():
    # Create ai_form_sessions table
    op.create_table('ai_form_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('llm_provider', sa.String(50), nullable=False),
        sa.Column('llm_model', sa.String(100), nullable=False),
        sa.Column('mode', sa.String(20), nullable=False),
        sa.Column('conversation_history', postgresql.JSONB, nullable=False, server_default='[]'),
        sa.Column('current_schema', postgresql.JSONB, nullable=True),
        sa.Column('form_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('forms.id'), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime, nullable=True),
    )

    # Create ai_generation_logs table
    op.create_table('ai_generation_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('session_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('ai_form_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('prompt_sent', sa.Text, nullable=False),
        sa.Column('response_received', sa.Text, nullable=True),
        sa.Column('tokens_used', sa.Integer, nullable=True),
        sa.Column('latency_ms', sa.Integer, nullable=True),
        sa.Column('success', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('error_message', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    # Create indexes
    op.create_index('idx_ai_sessions_user', 'ai_form_sessions', ['user_id'])
    op.create_index('idx_ai_sessions_status', 'ai_form_sessions', ['status'])
    op.create_index('idx_ai_logs_session', 'ai_generation_logs', ['session_id'])


def downgrade():
    # Drop indexes
    op.drop_index('idx_ai_logs_session', table_name='ai_generation_logs')
    op.drop_index('idx_ai_sessions_status', table_name='ai_form_sessions')
    op.drop_index('idx_ai_sessions_user', table_name='ai_form_sessions')

    # Drop tables
    op.drop_table('ai_generation_logs')
    op.drop_table('ai_form_sessions')
