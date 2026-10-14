"""add_ipd_module_tables_beds_admissions_vitals

Revision ID: 501315cec15e
Revises: 3678d5791404
Create Date: 2026-03-09 21:42:06.828522

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '501315cec15e'
down_revision = '3678d5791404'
branch_labels = None
depends_on = None


def upgrade():
    # Create beds table
    op.create_table('beds',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('bed_number', sa.String(length=50), nullable=False),
        sa.Column('facility_id', sa.UUID(), nullable=True),
        sa.Column('building', sa.String(length=100), nullable=True),
        sa.Column('floor', sa.String(length=50), nullable=True),
        sa.Column('ward_name', sa.String(length=100), nullable=False),
        sa.Column('room_number', sa.String(length=50), nullable=True),
        sa.Column('bed_type', sa.String(length=50), nullable=False),
        sa.Column('bed_status', sa.String(length=50), nullable=False),
        sa.Column('has_oxygen', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('has_ventilator', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('beds', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_beds_bed_number'), ['bed_number'], unique=True)
        batch_op.create_index(batch_op.f('ix_beds_bed_status'), ['bed_status'], unique=False)
        batch_op.create_index(batch_op.f('ix_beds_ward_name'), ['ward_name'], unique=False)
        batch_op.create_index(batch_op.f('ix_beds_bed_type'), ['bed_type'], unique=False)
        batch_op.create_index(batch_op.f('ix_beds_facility_id'), ['facility_id'], unique=False)

    # Create ipd_admissions table
    op.create_table('ipd_admissions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('encounter_id', sa.UUID(), nullable=False),
        sa.Column('patient_id', sa.UUID(), nullable=False),
        sa.Column('admission_form_submission_id', sa.UUID(), nullable=True),
        sa.Column('admission_type', sa.String(length=50), nullable=False),
        sa.Column('admission_source', sa.String(length=50), nullable=True),
        sa.Column('admitting_doctor_id', sa.UUID(), nullable=True),
        sa.Column('admission_diagnosis', sa.Text(), nullable=True),
        sa.Column('admission_notes', sa.Text(), nullable=True),
        sa.Column('estimated_length_of_stay_days', sa.Integer(), nullable=True),
        sa.Column('discharge_form_submission_id', sa.UUID(), nullable=True),
        sa.Column('discharge_type', sa.String(length=50), nullable=True),
        sa.Column('discharge_diagnosis', sa.Text(), nullable=True),
        sa.Column('discharge_summary', sa.Text(), nullable=True),
        sa.Column('discharge_instructions', sa.Text(), nullable=True),
        sa.Column('follow_up_appointment_id', sa.UUID(), nullable=True),
        sa.Column('next_appointment_date', sa.DateTime(), nullable=True),
        sa.Column('doctor_notes', sa.Text(), nullable=True),
        sa.Column('billing_summary', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['encounter_id'], ['encounters.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['admission_form_submission_id'], ['form_submissions.id'], ),
        sa.ForeignKeyConstraint(['discharge_form_submission_id'], ['form_submissions.id'], ),
        sa.ForeignKeyConstraint(['admitting_doctor_id'], ['healthcare_providers.id'], ),
        sa.ForeignKeyConstraint(['follow_up_appointment_id'], ['encounters.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('ipd_admissions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_ipd_admissions_encounter_id'), ['encounter_id'], unique=True)
        batch_op.create_index(batch_op.f('ix_ipd_admissions_patient_id'), ['patient_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_ipd_admissions_admission_type'), ['admission_type'], unique=False)
        batch_op.create_index(batch_op.f('ix_ipd_admissions_admitting_doctor_id'), ['admitting_doctor_id'], unique=False)

    # Create bed_assignments table
    op.create_table('bed_assignments',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('bed_id', sa.UUID(), nullable=False),
        sa.Column('admission_id', sa.UUID(), nullable=True),
        sa.Column('patient_id', sa.UUID(), nullable=False),
        sa.Column('encounter_id', sa.UUID(), nullable=True),
        sa.Column('assigned_at', sa.DateTime(), nullable=False),
        sa.Column('released_at', sa.DateTime(), nullable=True),
        sa.Column('assigned_by', sa.UUID(), nullable=True),
        sa.Column('assignment_status', sa.String(length=50), nullable=False),
        sa.Column('transfer_reason', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['bed_id'], ['beds.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['admission_id'], ['ipd_admissions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['encounter_id'], ['encounters.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['assigned_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('bed_assignments', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_bed_assignments_bed_id'), ['bed_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_bed_assignments_admission_id'), ['admission_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_bed_assignments_patient_id'), ['patient_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_bed_assignments_assignment_status'), ['assignment_status'], unique=False)
        batch_op.create_index(batch_op.f('ix_bed_assignments_assigned_at'), ['assigned_at'], unique=False)

    # Create bed_waiting_list table
    op.create_table('bed_waiting_list',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('patient_id', sa.UUID(), nullable=False),
        sa.Column('service_id', sa.UUID(), nullable=True),
        sa.Column('requested_bed_type', sa.String(length=50), nullable=False),
        sa.Column('priority', sa.String(length=50), nullable=False),
        sa.Column('requested_at', sa.DateTime(), nullable=False),
        sa.Column('requested_by', sa.UUID(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('assigned_bed_id', sa.UUID(), nullable=True),
        sa.Column('assigned_at', sa.DateTime(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['service_id'], ['services.id'], ),
        sa.ForeignKeyConstraint(['assigned_bed_id'], ['beds.id'], ),
        sa.ForeignKeyConstraint(['requested_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('bed_waiting_list', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_bed_waiting_list_patient_id'), ['patient_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_bed_waiting_list_priority'), ['priority'], unique=False)
        batch_op.create_index(batch_op.f('ix_bed_waiting_list_status'), ['status'], unique=False)
        batch_op.create_index(batch_op.f('ix_bed_waiting_list_requested_at'), ['requested_at'], unique=False)

    # Create vitals_records table
    op.create_table('vitals_records',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('encounter_id', sa.UUID(), nullable=False),
        sa.Column('patient_id', sa.UUID(), nullable=False),
        sa.Column('recorded_at', sa.DateTime(), nullable=False),
        sa.Column('recorded_by', sa.UUID(), nullable=True),
        sa.Column('vitals_data', sa.JSON(), nullable=False),
        sa.Column('observation_notes', sa.Text(), nullable=True),
        sa.Column('is_critical', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['encounter_id'], ['encounters.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['recorded_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('vitals_records', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_vitals_records_encounter_id'), ['encounter_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_vitals_records_patient_id'), ['patient_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_vitals_records_recorded_at'), ['recorded_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_vitals_records_is_critical'), ['is_critical'], unique=False)


def downgrade():
    # Drop tables in reverse order to handle foreign key constraints
    op.drop_table('vitals_records')
    op.drop_table('bed_waiting_list')
    op.drop_table('bed_assignments')
    op.drop_table('ipd_admissions')
    op.drop_table('beds')
