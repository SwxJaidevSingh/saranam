"""add scheduling system tables

Revision ID: 788adf543a80
Revises: d4e5f6a7b8c9
Create Date: 2026-03-26 07:44:52.450792

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '788adf543a80'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade():
    # Geographic Clusters
    op.create_table('geographic_clusters',
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('color_hex', sa.String(length=7), nullable=False),
        sa.Column('pin_codes', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    # Vehicles
    op.create_table('vehicles',
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('registration_number', sa.String(length=50), nullable=True),
        sa.Column('vehicle_type', sa.String(length=50), nullable=True),
        sa.Column('capacity', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # Schedule Config (singleton)
    op.create_table('schedule_config',
        sa.Column('visit_days', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('non_visit_day_labels', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('planning_day', sa.String(length=20), nullable=False),
        sa.Column('planning_deadline_time', sa.Time(), nullable=True),
        sa.Column('approval_deadline_day', sa.String(length=20), nullable=False),
        sa.Column('approval_deadline_time', sa.Time(), nullable=True),
        sa.Column('max_patients_per_vehicle_per_day', sa.Integer(), nullable=False),
        sa.Column('recommended_patients_per_day', sa.Integer(), nullable=False),
        sa.Column('active_vehicles', sa.Integer(), nullable=False),
        sa.Column('cluster_efficiency_target', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('visit_gap_alert_threshold_days', sa.Integer(), nullable=False),
        sa.Column('notification_methods', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('proactive_call_days', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('proactive_call_window_start', sa.Time(), nullable=True),
        sa.Column('proactive_call_window_end', sa.Time(), nullable=True),
        sa.Column('auto_create_schedule', sa.Boolean(), nullable=True),
        sa.Column('updated_by', sa.UUID(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # On-Call Roster
    op.create_table('on_call_roster',
        sa.Column('week_start_date', sa.Date(), nullable=False),
        sa.Column('week_end_date', sa.Date(), nullable=False),
        sa.Column('clinician_user_id', sa.UUID(), nullable=False),
        sa.Column('phone_numbers', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['clinician_user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('week_start_date', 'clinician_user_id', name='uq_on_call_week_clinician')
    )

    # Patient Scheduling Meta
    op.create_table('patient_scheduling_meta',
        sa.Column('patient_id', sa.UUID(), nullable=False),
        sa.Column('cluster_id', sa.UUID(), nullable=True),
        sa.Column('complexity', sa.String(length=20), nullable=True),
        sa.Column('care_status', sa.String(length=10), nullable=True),
        sa.Column('recommended_frequency_days', sa.Integer(), nullable=True),
        sa.Column('special_notes', sa.Text(), nullable=True),
        sa.Column('lead_flagged', sa.Boolean(), nullable=True),
        sa.Column('lead_flag_reason', sa.Text(), nullable=True),
        sa.Column('lead_flagged_at', sa.DateTime(), nullable=True),
        sa.Column('lead_flagged_by', sa.UUID(), nullable=True),
        sa.Column('scheduling_active', sa.Boolean(), nullable=True),
        sa.Column('recently_hospitalized', sa.Boolean(), nullable=True),
        sa.Column('hospital_discharge_date', sa.Date(), nullable=True),
        sa.Column('last_visit_date', sa.Date(), nullable=True),
        sa.Column('days_since_last_visit', sa.Integer(), nullable=True),
        sa.Column('priority_score', sa.Integer(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['cluster_id'], ['geographic_clusters.id']),
        sa.ForeignKeyConstraint(['lead_flagged_by'], ['users.id']),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_patient_scheduling_meta_patient_id', 'patient_scheduling_meta', ['patient_id'], unique=True)

    # Weekly Schedules
    op.create_table('weekly_schedules',
        sa.Column('week_start_date', sa.Date(), nullable=False),
        sa.Column('week_end_date', sa.Date(), nullable=False),
        sa.Column('vehicle_id', sa.UUID(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('submitted_at', sa.DateTime(), nullable=True),
        sa.Column('submitted_by', sa.UUID(), nullable=True),
        sa.Column('submitted_note', sa.Text(), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('approved_by', sa.UUID(), nullable=True),
        sa.Column('approval_note', sa.Text(), nullable=True),
        sa.Column('sent_back_reason', sa.Text(), nullable=True),
        sa.Column('communicated_at', sa.DateTime(), nullable=True),
        sa.Column('review_started_at', sa.DateTime(), nullable=True),
        sa.Column('review_completed_at', sa.DateTime(), nullable=True),
        sa.Column('review_completed_by', sa.UUID(), nullable=True),
        sa.Column('review_notes', sa.Text(), nullable=True),
        sa.Column('review_metrics', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.ForeignKeyConstraint(['review_completed_by'], ['users.id']),
        sa.ForeignKeyConstraint(['submitted_by'], ['users.id']),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('week_start_date', 'vehicle_id', name='uq_weekly_schedule_vehicle_week')
    )

    # Schedule Days
    op.create_table('schedule_days',
        sa.Column('weekly_schedule_id', sa.UUID(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('day_of_week', sa.String(length=20), nullable=False),
        sa.Column('day_note', sa.Text(), nullable=True),
        sa.Column('kit_ready', sa.Boolean(), nullable=True),
        sa.Column('kit_ready_at', sa.DateTime(), nullable=True),
        sa.Column('kit_ready_by', sa.UUID(), nullable=True),
        sa.Column('cluster_efficiency', sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['kit_ready_by'], ['users.id']),
        sa.ForeignKeyConstraint(['weekly_schedule_id'], ['weekly_schedules.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('weekly_schedule_id', 'date', name='uq_schedule_day_date')
    )
    op.create_index('ix_schedule_days_weekly_schedule_id', 'schedule_days', ['weekly_schedule_id'])

    # Schedule Slots
    op.create_table('schedule_slots',
        sa.Column('schedule_day_id', sa.UUID(), nullable=False),
        sa.Column('patient_id', sa.UUID(), nullable=False),
        sa.Column('slot_order', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('missed_reason', sa.Text(), nullable=True),
        sa.Column('cancelled_reason', sa.Text(), nullable=True),
        sa.Column('is_adhoc', sa.Boolean(), nullable=True),
        sa.Column('adhoc_reason', sa.Text(), nullable=True),
        sa.Column('adhoc_added_by', sa.UUID(), nullable=True),
        sa.Column('visit_id', sa.UUID(), nullable=True),
        sa.Column('exception_note', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['adhoc_added_by'], ['users.id']),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id']),
        sa.ForeignKeyConstraint(['schedule_day_id'], ['schedule_days.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['visit_id'], ['patient_visits.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('schedule_day_id', 'patient_id', name='uq_schedule_slot_patient_day')
    )
    op.create_index('ix_schedule_slots_schedule_day_id', 'schedule_slots', ['schedule_day_id'])
    op.create_index('ix_schedule_slots_patient_id', 'schedule_slots', ['patient_id'])

    # Schedule Team Assignments
    op.create_table('schedule_team_assignments',
        sa.Column('schedule_day_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['schedule_day_id'], ['schedule_days.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('schedule_day_id', 'user_id', name='uq_team_assignment_day_user')
    )
    op.create_index('ix_schedule_team_assignments_schedule_day_id', 'schedule_team_assignments', ['schedule_day_id'])
    op.create_index('ix_schedule_team_assignments_user_id', 'schedule_team_assignments', ['user_id'])

    # Schedule Audit Log
    op.create_table('schedule_audit_log',
        sa.Column('weekly_schedule_id', sa.UUID(), nullable=False),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('actor_user_id', sa.UUID(), nullable=False),
        sa.Column('details', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['actor_user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['weekly_schedule_id'], ['weekly_schedules.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_schedule_audit_log_weekly_schedule_id', 'schedule_audit_log', ['weekly_schedule_id'])
    op.create_index('ix_schedule_audit_log_actor_user_id', 'schedule_audit_log', ['actor_user_id'])

    # Schedule Notifications
    op.create_table('schedule_notifications',
        sa.Column('weekly_schedule_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('notification_type', sa.String(length=50), nullable=False),
        sa.Column('channel', sa.String(length=20), nullable=False),
        sa.Column('sent_at', sa.DateTime(), nullable=True),
        sa.Column('delivered_at', sa.DateTime(), nullable=True),
        sa.Column('read_at', sa.DateTime(), nullable=True),
        sa.Column('acknowledged', sa.Boolean(), nullable=True),
        sa.Column('acknowledged_at', sa.DateTime(), nullable=True),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['weekly_schedule_id'], ['weekly_schedules.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_schedule_notifications_weekly_schedule_id', 'schedule_notifications', ['weekly_schedule_id'])
    op.create_index('ix_schedule_notifications_user_id', 'schedule_notifications', ['user_id'])


def downgrade():
    op.drop_table('schedule_notifications')
    op.drop_table('schedule_audit_log')
    op.drop_table('schedule_team_assignments')
    op.drop_table('schedule_slots')
    op.drop_table('schedule_days')
    op.drop_table('weekly_schedules')
    op.drop_table('patient_scheduling_meta')
    op.drop_table('on_call_roster')
    op.drop_table('schedule_config')
    op.drop_table('vehicles')
    op.drop_table('geographic_clusters')
