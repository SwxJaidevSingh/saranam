"""add_form_configurations_table_for_ipd_dynamic_forms

Revision ID: 22f0f9c35d32
Revises: 501315cec15e
Create Date: 2026-03-13 08:42:43.130935

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '22f0f9c35d32'
down_revision = '501315cec15e'
branch_labels = None
depends_on = None


def upgrade():
    # Create form_configurations table for IPD dynamic forms
    # Note: facility_id is nullable UUID without FK constraint (multi-facility support to be added later)
    op.create_table('form_configurations',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('facility_id', sa.UUID(), nullable=True),
        sa.Column('service_id', sa.UUID(), nullable=True),
        sa.Column('form_type', sa.String(length=50), nullable=False),
        sa.Column('form_id', sa.UUID(), nullable=False),
        sa.Column('is_required', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('display_order', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['form_id'], ['forms.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['service_id'], ['services.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for efficient querying
    with op.batch_alter_table('form_configurations', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_form_configurations_facility_id'), ['facility_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_form_configurations_service_id'), ['service_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_form_configurations_form_type'), ['form_type'], unique=False)
        batch_op.create_index(batch_op.f('ix_form_configurations_form_id'), ['form_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_form_configurations_is_active'), ['is_active'], unique=False)

    # Create clinical_documentation table for progress notes and nursing assessments
    op.create_table('clinical_documentation',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('admission_id', sa.UUID(), nullable=False),
        sa.Column('patient_id', sa.UUID(), nullable=False),
        sa.Column('encounter_id', sa.UUID(), nullable=False),
        sa.Column('documentation_type', sa.String(length=50), nullable=False),
        sa.Column('form_submission_id', sa.UUID(), nullable=True),
        sa.Column('documented_by', sa.UUID(), nullable=True),
        sa.Column('documented_at', sa.DateTime(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['admission_id'], ['ipd_admissions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['encounter_id'], ['encounters.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['form_submission_id'], ['form_submissions.id'], ),
        sa.ForeignKeyConstraint(['documented_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for clinical_documentation
    with op.batch_alter_table('clinical_documentation', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_clinical_documentation_admission_id'), ['admission_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_clinical_documentation_patient_id'), ['patient_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_clinical_documentation_encounter_id'), ['encounter_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_clinical_documentation_documentation_type'), ['documentation_type'], unique=False)
        batch_op.create_index(batch_op.f('ix_clinical_documentation_documented_at'), ['documented_at'], unique=False)


def downgrade():
    # Drop tables in reverse order to handle foreign key constraints
    op.drop_table('clinical_documentation')
    op.drop_table('form_configurations')
