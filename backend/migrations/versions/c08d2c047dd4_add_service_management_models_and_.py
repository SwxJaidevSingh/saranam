"""Add service management models and encounter service fields

Revision ID: c08d2c047dd4
Revises: 3ceea10e865c
Create Date: 2026-03-05 03:25:52.382437

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'c08d2c047dd4'
down_revision = '3ceea10e865c'
branch_labels = None
depends_on = None


def upgrade():
    # Create enum types manually to avoid auto-creation issues
    conn = op.get_bind()

    # Create service type enum if it doesn't exist
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE servicetype AS ENUM ('IPD', 'OPD', 'PHYSIOTHERAPY', 'HOME_CARE');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """))

    # Create service status enum if it doesn't exist
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE servicestatus AS ENUM ('REQUESTED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """))

    # Create form type enum if it doesn't exist
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE formtype AS ENUM ('INITIAL', 'FOLLOW_UP', 'DISCHARGE', 'ASSESSMENT', 'PROGRESS_NOTE', 'DAILY_REPORT');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """))

    # Create services table
    op.create_table('services',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('service_type', postgresql.ENUM('IPD', 'OPD', 'PHYSIOTHERAPY', 'HOME_CARE', name='servicetype', create_type=False), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('department', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('requires_admission', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('requires_referral', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('default_duration_minutes', sa.Integer(), nullable=True, server_default='30'),
        sa.Column('max_daily_capacity', sa.Integer(), nullable=True),
        sa.Column('base_cost', sa.DECIMAL(10, 2), nullable=True),
        sa.Column('cost_currency', sa.String(3), nullable=True, server_default="'INR'"),
        sa.Column('default_form_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('intake_form_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('discharge_form_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('settings', postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default='{}'),
        sa.ForeignKeyConstraint(['default_form_id'], ['forms.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['intake_form_id'], ['forms.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['discharge_form_id'], ['forms.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_service_type_active', 'services', ['service_type', 'is_active'], unique=False)
    op.create_index('idx_service_department', 'services', ['department'], unique=False)

    # Create service_providers table
    op.create_table('service_providers',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('service_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('provider_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('is_primary', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('settings', postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default='{}'),
        sa.ForeignKeyConstraint(['service_id'], ['services.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['provider_id'], ['healthcare_providers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_service_provider', 'service_providers', ['service_id', 'provider_id'], unique=True)
    op.create_index('idx_provider_active', 'service_providers', ['provider_id', 'is_active'], unique=False)

    # Create service_schedules table
    op.create_table('service_schedules',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('service_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('day_of_week', sa.Integer(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('max_capacity', sa.Integer(), nullable=True, server_default='10'),
        sa.Column('buffer_minutes', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('break_times', postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default='[]'),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('effective_from', sa.DateTime(), nullable=True),
        sa.Column('effective_until', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['service_id'], ['services.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_service_schedule', 'service_schedules', ['service_id', 'day_of_week'], unique=False)
    op.create_index('idx_schedule_active', 'service_schedules', ['service_id', 'is_active'], unique=False)

    # Create service_forms table
    op.create_table('service_forms',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('service_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('form_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('form_type', postgresql.ENUM('INITIAL', 'FOLLOW_UP', 'DISCHARGE', 'ASSESSMENT', 'PROGRESS_NOTE', 'DAILY_REPORT', name='formtype', create_type=False), nullable=False),
        sa.Column('is_mandatory', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('sequence_order', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('conditions', postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default='{}'),
        sa.ForeignKeyConstraint(['service_id'], ['services.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['form_id'], ['forms.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_service_form', 'service_forms', ['service_id', 'form_id'], unique=True)
    op.create_index('idx_service_form_type', 'service_forms', ['service_id', 'form_type'], unique=False)

    # Add service-related columns to encounters table
    op.add_column('encounters', sa.Column('service_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('encounters', sa.Column('service_status', postgresql.ENUM('REQUESTED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', name='servicestatus', create_type=False), nullable=True))
    op.add_column('encounters', sa.Column('admission_date', sa.DateTime(), nullable=True))
    op.add_column('encounters', sa.Column('discharge_date', sa.DateTime(), nullable=True))
    op.add_column('encounters', sa.Column('bed_number', sa.String(50), nullable=True))
    op.add_column('encounters', sa.Column('follow_up_required', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('encounters', sa.Column('follow_up_scheduled_at', sa.DateTime(), nullable=True))
    op.add_column('encounters', sa.Column('follow_up_service_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('encounters', sa.Column('service_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    # Create foreign key constraints for encounters
    op.create_foreign_key('fk_encounters_service_id', 'encounters', 'services', ['service_id'], ['id'])
    op.create_foreign_key('fk_encounters_follow_up_service_id', 'encounters', 'services', ['follow_up_service_id'], ['id'])

    # Create indexes for encounters
    op.create_index('idx_encounters_service_id', 'encounters', ['service_id'], unique=False)
    op.create_index('idx_encounters_service_status', 'encounters', ['service_status'], unique=False)


def downgrade():
    # Drop indexes from encounters
    op.drop_index('idx_encounters_service_status', table_name='encounters')
    op.drop_index('idx_encounters_service_id', table_name='encounters')

    # Drop foreign key constraints from encounters
    op.drop_constraint('fk_encounters_follow_up_service_id', 'encounters', type_='foreignkey')
    op.drop_constraint('fk_encounters_service_id', 'encounters', type_='foreignkey')

    # Remove columns from encounters
    op.drop_column('encounters', 'service_metadata')
    op.drop_column('encounters', 'follow_up_service_id')
    op.drop_column('encounters', 'follow_up_scheduled_at')
    op.drop_column('encounters', 'follow_up_required')
    op.drop_column('encounters', 'bed_number')
    op.drop_column('encounters', 'discharge_date')
    op.drop_column('encounters', 'admission_date')
    op.drop_column('encounters', 'service_status')
    op.drop_column('encounters', 'service_id')

    # Drop service_forms table
    op.drop_index('idx_service_form_type', table_name='service_forms')
    op.drop_index('idx_service_form', table_name='service_forms')
    op.drop_table('service_forms')

    # Drop service_schedules table
    op.drop_index('idx_schedule_active', table_name='service_schedules')
    op.drop_index('idx_service_schedule', table_name='service_schedules')
    op.drop_table('service_schedules')

    # Drop service_providers table
    op.drop_index('idx_provider_active', table_name='service_providers')
    op.drop_index('idx_service_provider', table_name='service_providers')
    op.drop_table('service_providers')

    # Drop services table
    op.drop_index('idx_service_department', table_name='services')
    op.drop_index('idx_service_type_active', table_name='services')
    op.drop_table('services')

    # Note: We don't drop the enum types as they may be used elsewhere
    # and PostgreSQL doesn't allow dropping types that might have dependents
