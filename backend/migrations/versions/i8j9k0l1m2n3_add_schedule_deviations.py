"""add schedule_deviations table

Revision ID: i8j9k0l1m2n3
Revises: h7i8j9k0l1m2
Create Date: 2026-04-01 07:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'i8j9k0l1m2n3'
down_revision = 'h7i8j9k0l1m2'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'schedule_deviations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('schedule_day_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('schedule_days.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('deviation_type', sa.String(50), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('time_impact', sa.String(255), nullable=True),
        sa.Column('affected_patient_ids', postgresql.JSONB(), server_default='[]'),
        sa.Column('emergency_patient_name', sa.String(255), nullable=True),
        sa.Column('emergency_patient_location', sa.Text(), nullable=True),
        sa.Column('emergency_reason', sa.Text(), nullable=True),
        sa.Column('reported_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')),
    )


def downgrade():
    op.drop_table('schedule_deviations')
