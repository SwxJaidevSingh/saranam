"""add_patient_cohort_tables

Revision ID: a8884fd00a32
Revises: d8d9a5a627d7
Create Date: 2026-03-02 12:43:41.565626

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers, used by Alembic.
revision = 'a8884fd00a32'
down_revision = 'd8d9a5a627d7'
branch_labels = None
depends_on = None


def upgrade():
    # Create patient_cohorts table
    op.create_table(
        'patient_cohorts',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('criteria', JSONB, nullable=False, server_default='{}'),
        sa.Column('owner_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('is_shared', sa.Boolean, default=False),
        sa.Column('shared_with', JSONB, server_default='[]'),
        sa.Column('auto_update', sa.Boolean, default=True),
        sa.Column('update_frequency', sa.String(20), default='daily'),
        sa.Column('last_calculated_at', sa.DateTime),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('member_count', sa.Integer, default=0),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.text('NOW()'), onupdate=sa.text('NOW()'))
    )

    # Create cohort_members table
    op.create_table(
        'cohort_members',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('cohort_id', UUID(as_uuid=True), sa.ForeignKey('patient_cohorts.id'), nullable=False),
        sa.Column('patient_id', UUID(as_uuid=True), sa.ForeignKey('patients.id'), nullable=False),
        sa.Column('joined_at', sa.DateTime, nullable=False, server_default=sa.text('NOW()')),
        sa.Column('snapshot_data', JSONB, server_default='{}'),
        sa.Column('still_qualifies', sa.Boolean, default=True),
        sa.Column('last_checked_at', sa.DateTime, server_default=sa.text('NOW()'))
    )

    # Create index for cohort_members
    op.create_index(
        'ix_cohort_members_cohort_patient',
        'cohort_members',
        ['cohort_id', 'patient_id']
    )

    # Create cohort_activities table
    op.create_table(
        'cohort_activities',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('cohort_id', UUID(as_uuid=True), sa.ForeignKey('patient_cohorts.id'), nullable=False),
        sa.Column('activity_type', sa.String(50), nullable=False),
        sa.Column('details', JSONB, server_default='{}'),
        sa.Column('performed_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.text('NOW()'))
    )

    # Create index for cohort_activities
    op.create_index(
        'ix_cohort_activities_cohort_created',
        'cohort_activities',
        ['cohort_id', 'created_at']
    )

    # Create cohort_outcomes table
    op.create_table(
        'cohort_outcomes',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('cohort_id', UUID(as_uuid=True), sa.ForeignKey('patient_cohorts.id'), nullable=False),
        sa.Column('metric_name', sa.String(100), nullable=False),
        sa.Column('metric_value', sa.Float, nullable=False),
        sa.Column('metric_metadata', JSONB, server_default='{}'),
        sa.Column('recorded_at', sa.DateTime, nullable=False, server_default=sa.text('NOW()'))
    )

    # Create index for cohort_outcomes
    op.create_index(
        'ix_cohort_outcomes_cohort_metric_time',
        'cohort_outcomes',
        ['cohort_id', 'metric_name', 'recorded_at']
    )


def downgrade():
    # Drop tables in reverse order (to handle foreign keys)
    op.drop_index('ix_cohort_outcomes_cohort_metric_time', table_name='cohort_outcomes')
    op.drop_table('cohort_outcomes')

    op.drop_index('ix_cohort_activities_cohort_created', table_name='cohort_activities')
    op.drop_table('cohort_activities')

    op.drop_index('ix_cohort_members_cohort_patient', table_name='cohort_members')
    op.drop_table('cohort_members')

    op.drop_table('patient_cohorts')
