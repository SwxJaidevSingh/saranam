"""Add patient management indexes and recent_patients table

Revision ID: 0f17ad6df3df
Revises: bf768c05eb59
Create Date: 2026-03-01 18:30:05.682642

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '0f17ad6df3df'
down_revision = 'bf768c05eb59'
branch_labels = None
depends_on = None


def upgrade():
    # Create recent_patients table
    op.create_table(
        'recent_patients',
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('last_accessed', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('access_count', sa.Integer(), server_default='1', nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id', 'patient_id')
    )

    # Add indexes for recent_patients
    op.create_index('idx_recent_patients_user', 'recent_patients', ['user_id', 'last_accessed'], unique=False)

    # Add indexes to patients table for better search performance
    op.create_index('idx_patients_full_name', 'patients', ['full_name'], unique=False)

    # Add index to form_submissions for patient queries
    op.create_index('idx_form_submissions_patient_id', 'form_submissions', ['patient_id'], unique=False)
    op.create_index('idx_form_submissions_patient_created', 'form_submissions', ['patient_id', 'created_at'], unique=False)


def downgrade():
    # Drop indexes
    op.drop_index('idx_form_submissions_patient_created', table_name='form_submissions')
    op.drop_index('idx_form_submissions_patient_id', table_name='form_submissions')
    op.drop_index('idx_patients_full_name', table_name='patients')
    op.drop_index('idx_recent_patients_user', table_name='recent_patients')

    # Drop recent_patients table
    op.drop_table('recent_patients')
