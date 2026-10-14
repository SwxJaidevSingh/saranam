"""add_appointment_management_tables

Revision ID: 3ceea10e865c
Revises: a8884fd00a32
Create Date: 2026-03-02 13:52:16.245940

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '3ceea10e865c'
down_revision = 'a8884fd00a32'
branch_labels = None
depends_on = None


def upgrade():
    # Create healthcare_providers table
    op.create_table(
        'healthcare_providers',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('hpr_id', sa.String(length=100), nullable=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('full_name', sa.String(length=255), nullable=False),
        sa.Column('email_encrypted', sa.Text(), nullable=True),
        sa.Column('phone_encrypted', sa.Text(), nullable=True),
        sa.Column('specialization', sa.String(length=100), nullable=True),
        sa.Column('department', sa.String(length=100), nullable=True),
        sa.Column('license_number', sa.String(length=100), nullable=True),
        sa.Column('qualification', sa.String(length=255), nullable=True),
        sa.Column('facility_hfr_id', sa.String(length=100), nullable=True),
        sa.Column('bio', sa.Text(), nullable=True),
        sa.Column('years_of_experience', sa.Integer(), nullable=True),
        sa.Column('default_consultation_duration', sa.Integer(), nullable=True, server_default='30'),
        sa.Column('accepts_new_patients', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('hpr_id'),
        sa.UniqueConstraint('license_number'),
        sa.UniqueConstraint('user_id')
    )
    op.create_index(op.f('ix_healthcare_providers_department'), 'healthcare_providers', ['department'], unique=False)
    op.create_index(op.f('ix_healthcare_providers_facility_hfr_id'), 'healthcare_providers', ['facility_hfr_id'], unique=False)
    op.create_index(op.f('ix_healthcare_providers_full_name'), 'healthcare_providers', ['full_name'], unique=False)
    op.create_index(op.f('ix_healthcare_providers_hpr_id'), 'healthcare_providers', ['hpr_id'], unique=False)
    op.create_index(op.f('ix_healthcare_providers_is_active'), 'healthcare_providers', ['is_active'], unique=False)
    op.create_index(op.f('ix_healthcare_providers_specialization'), 'healthcare_providers', ['specialization'], unique=False)
    op.create_index(op.f('ix_healthcare_providers_user_id'), 'healthcare_providers', ['user_id'], unique=False)

    # Create provider_schedules table
    op.create_table(
        'provider_schedules',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('provider_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('day_of_week', sa.Integer(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('slot_duration', sa.Integer(), nullable=False, server_default='30'),
        sa.Column('max_appointments_per_slot', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('break_start_time', sa.Time(), nullable=True),
        sa.Column('break_end_time', sa.Time(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['provider_id'], ['healthcare_providers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('provider_id', 'day_of_week', name='uq_provider_day')
    )
    op.create_index(op.f('ix_provider_schedules_day_of_week'), 'provider_schedules', ['day_of_week'], unique=False)
    op.create_index(op.f('ix_provider_schedules_is_active'), 'provider_schedules', ['is_active'], unique=False)
    op.create_index(op.f('ix_provider_schedules_provider_id'), 'provider_schedules', ['provider_id'], unique=False)

    # Create patient_caregivers table
    op.create_table(
        'patient_caregivers',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('caregiver_user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('relationship', sa.String(length=50), nullable=False),
        sa.Column('can_book_appointments', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('can_view_medical_data', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('can_update_patient_info', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('can_access_reports', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_primary_caregiver', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('authorization_document', sa.Text(), nullable=True),
        sa.Column('consent_given_at', sa.Date(), nullable=True),
        sa.Column('consent_expires_at', sa.Date(), nullable=True),
        sa.Column('is_emergency_contact', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['caregiver_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_patient_caregivers_caregiver_user_id'), 'patient_caregivers', ['caregiver_user_id'], unique=False)
    op.create_index(op.f('ix_patient_caregivers_is_active'), 'patient_caregivers', ['is_active'], unique=False)
    op.create_index(op.f('ix_patient_caregivers_patient_id'), 'patient_caregivers', ['patient_id'], unique=False)

    # Add appointment-specific columns to encounters table
    op.add_column('encounters', sa.Column('appointment_type', sa.String(length=50), nullable=True))
    op.add_column('encounters', sa.Column('provider_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('encounters', sa.Column('recurrence_rule', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('encounters', sa.Column('parent_appointment_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('encounters', sa.Column('booking_source', sa.String(length=50), nullable=True))
    op.add_column('encounters', sa.Column('booked_by', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('encounters', sa.Column('cancellation_reason', sa.Text(), nullable=True))
    op.add_column('encounters', sa.Column('cancelled_at', sa.DateTime(), nullable=True))
    op.add_column('encounters', sa.Column('cancelled_by', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('encounters', sa.Column('no_show_reason', sa.Text(), nullable=True))
    op.add_column('encounters', sa.Column('reminder_sent', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('encounters', sa.Column('reminder_preferences', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('encounters', sa.Column('checked_in_at', sa.DateTime(), nullable=True))
    op.add_column('encounters', sa.Column('checked_out_at', sa.DateTime(), nullable=True))
    op.add_column('encounters', sa.Column('pre_appointment_notes', sa.Text(), nullable=True))
    op.add_column('encounters', sa.Column('post_appointment_notes', sa.Text(), nullable=True))
    op.add_column('encounters', sa.Column('meeting_link', sa.String(length=500), nullable=True))
    op.add_column('encounters', sa.Column('meeting_password', sa.String(length=100), nullable=True))

    # Create foreign keys for new encounter columns
    op.create_foreign_key('fk_encounters_provider_id', 'encounters', 'healthcare_providers', ['provider_id'], ['id'])
    op.create_foreign_key('fk_encounters_parent_appointment_id', 'encounters', 'encounters', ['parent_appointment_id'], ['id'])
    op.create_foreign_key('fk_encounters_booked_by', 'encounters', 'users', ['booked_by'], ['id'])
    op.create_foreign_key('fk_encounters_cancelled_by', 'encounters', 'users', ['cancelled_by'], ['id'])

    # Create indexes for new encounter columns
    op.create_index(op.f('ix_encounters_appointment_type'), 'encounters', ['appointment_type'], unique=False)
    op.create_index(op.f('ix_encounters_provider_id'), 'encounters', ['provider_id'], unique=False)
    op.create_index(op.f('ix_encounters_parent_appointment_id'), 'encounters', ['parent_appointment_id'], unique=False)

    # Create appointment_reminders table
    op.create_table(
        'appointment_reminders',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('encounter_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('reminder_type', sa.String(length=50), nullable=False),
        sa.Column('channel', sa.String(length=20), nullable=False),
        sa.Column('scheduled_at', sa.DateTime(), nullable=False),
        sa.Column('sent_at', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='pending'),
        sa.Column('delivery_status', sa.String(length=50), nullable=True),
        sa.Column('delivery_status_updated_at', sa.DateTime(), nullable=True),
        sa.Column('retry_count', sa.String(length=50), nullable=True, server_default='0'),
        sa.Column('max_retries', sa.String(length=50), nullable=True, server_default='3'),
        sa.Column('last_retry_at', sa.DateTime(), nullable=True),
        sa.Column('recipient', sa.String(length=255), nullable=False),
        sa.Column('message_body', sa.Text(), nullable=True),
        sa.Column('subject', sa.String(length=255), nullable=True),
        sa.Column('provider_message_id', sa.String(length=255), nullable=True),
        sa.Column('provider_response', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('error_code', sa.String(length=50), nullable=True),
        sa.Column('clicked', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('clicked_at', sa.DateTime(), nullable=True),
        sa.Column('confirmed', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('confirmed_at', sa.DateTime(), nullable=True),
        sa.Column('consent_verified', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['encounter_id'], ['encounters.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_appointment_reminders_encounter_id'), 'appointment_reminders', ['encounter_id'], unique=False)
    op.create_index(op.f('ix_appointment_reminders_reminder_type'), 'appointment_reminders', ['reminder_type'], unique=False)
    op.create_index(op.f('ix_appointment_reminders_scheduled_at'), 'appointment_reminders', ['scheduled_at'], unique=False)
    op.create_index(op.f('ix_appointment_reminders_sent_at'), 'appointment_reminders', ['sent_at'], unique=False)
    op.create_index(op.f('ix_appointment_reminders_status'), 'appointment_reminders', ['status'], unique=False)


def downgrade():
    # Drop appointment_reminders table
    op.drop_index(op.f('ix_appointment_reminders_status'), table_name='appointment_reminders')
    op.drop_index(op.f('ix_appointment_reminders_sent_at'), table_name='appointment_reminders')
    op.drop_index(op.f('ix_appointment_reminders_scheduled_at'), table_name='appointment_reminders')
    op.drop_index(op.f('ix_appointment_reminders_reminder_type'), table_name='appointment_reminders')
    op.drop_index(op.f('ix_appointment_reminders_encounter_id'), table_name='appointment_reminders')
    op.drop_table('appointment_reminders')

    # Remove appointment columns from encounters
    op.drop_index(op.f('ix_encounters_parent_appointment_id'), table_name='encounters')
    op.drop_index(op.f('ix_encounters_provider_id'), table_name='encounters')
    op.drop_index(op.f('ix_encounters_appointment_type'), table_name='encounters')
    op.drop_constraint('fk_encounters_cancelled_by', 'encounters', type_='foreignkey')
    op.drop_constraint('fk_encounters_booked_by', 'encounters', type_='foreignkey')
    op.drop_constraint('fk_encounters_parent_appointment_id', 'encounters', type_='foreignkey')
    op.drop_constraint('fk_encounters_provider_id', 'encounters', type_='foreignkey')
    op.drop_column('encounters', 'meeting_password')
    op.drop_column('encounters', 'meeting_link')
    op.drop_column('encounters', 'post_appointment_notes')
    op.drop_column('encounters', 'pre_appointment_notes')
    op.drop_column('encounters', 'checked_out_at')
    op.drop_column('encounters', 'checked_in_at')
    op.drop_column('encounters', 'reminder_preferences')
    op.drop_column('encounters', 'reminder_sent')
    op.drop_column('encounters', 'no_show_reason')
    op.drop_column('encounters', 'cancelled_by')
    op.drop_column('encounters', 'cancelled_at')
    op.drop_column('encounters', 'cancellation_reason')
    op.drop_column('encounters', 'booked_by')
    op.drop_column('encounters', 'booking_source')
    op.drop_column('encounters', 'parent_appointment_id')
    op.drop_column('encounters', 'recurrence_rule')
    op.drop_column('encounters', 'provider_id')
    op.drop_column('encounters', 'appointment_type')

    # Drop patient_caregivers table
    op.drop_index(op.f('ix_patient_caregivers_patient_id'), table_name='patient_caregivers')
    op.drop_index(op.f('ix_patient_caregivers_is_active'), table_name='patient_caregivers')
    op.drop_index(op.f('ix_patient_caregivers_caregiver_user_id'), table_name='patient_caregivers')
    op.drop_table('patient_caregivers')

    # Drop provider_schedules table
    op.drop_index(op.f('ix_provider_schedules_provider_id'), table_name='provider_schedules')
    op.drop_index(op.f('ix_provider_schedules_is_active'), table_name='provider_schedules')
    op.drop_index(op.f('ix_provider_schedules_day_of_week'), table_name='provider_schedules')
    op.drop_table('provider_schedules')

    # Drop healthcare_providers table
    op.drop_index(op.f('ix_healthcare_providers_user_id'), table_name='healthcare_providers')
    op.drop_index(op.f('ix_healthcare_providers_specialization'), table_name='healthcare_providers')
    op.drop_index(op.f('ix_healthcare_providers_is_active'), table_name='healthcare_providers')
    op.drop_index(op.f('ix_healthcare_providers_hpr_id'), table_name='healthcare_providers')
    op.drop_index(op.f('ix_healthcare_providers_full_name'), table_name='healthcare_providers')
    op.drop_index(op.f('ix_healthcare_providers_facility_hfr_id'), table_name='healthcare_providers')
    op.drop_index(op.f('ix_healthcare_providers_department'), table_name='healthcare_providers')
    op.drop_table('healthcare_providers')
