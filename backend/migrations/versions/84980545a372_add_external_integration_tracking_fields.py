"""add external integration tracking fields

Revision ID: 84980545a372
Revises: 22f0f9c35d32
Create Date: 2026-03-13 20:03:18.216806

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision = '84980545a372'
down_revision = '22f0f9c35d32'
branch_labels = None
depends_on = None


def upgrade():
    # Add external tracking fields to patients table
    op.add_column('patients', sa.Column('source_system', sa.String(50), server_default='cv_raman', nullable=False))
    op.add_column('patients', sa.Column('external_id', sa.String(255), nullable=True))
    op.add_column('patients', sa.Column('external_metadata', JSONB, server_default='{}', nullable=False))

    # Add unique constraint for external system tracking
    op.create_index('idx_patients_external', 'patients', ['source_system', 'external_id'])
    op.create_unique_constraint('uq_patients_external', 'patients', ['source_system', 'external_id'])

    # Add external tracking fields to form_submissions table
    op.add_column('form_submissions', sa.Column('source_system', sa.String(50), server_default='cv_raman', nullable=False))
    op.add_column('form_submissions', sa.Column('external_submission_id', sa.String(255), nullable=True))
    op.add_column('form_submissions', sa.Column('external_metadata', JSONB, server_default='{}', nullable=False))

    # Add index for external submission tracking
    op.create_index('idx_submissions_external', 'form_submissions', ['source_system', 'external_submission_id'])
    op.create_unique_constraint('uq_submissions_external', 'form_submissions', ['source_system', 'external_submission_id'])

    # Add API key field to users table for service accounts
    op.add_column('users', sa.Column('api_key_hash', sa.String(255), nullable=True))
    op.create_index('idx_users_api_key', 'users', ['api_key_hash'])


def downgrade():
    # Remove API key from users
    op.drop_index('idx_users_api_key', 'users')
    op.drop_column('users', 'api_key_hash')

    # Remove external tracking from form_submissions
    op.drop_constraint('uq_submissions_external', 'form_submissions', type_='unique')
    op.drop_index('idx_submissions_external', 'form_submissions')
    op.drop_column('form_submissions', 'external_metadata')
    op.drop_column('form_submissions', 'external_submission_id')
    op.drop_column('form_submissions', 'source_system')

    # Remove external tracking from patients
    op.drop_constraint('uq_patients_external', 'patients', type_='unique')
    op.drop_index('idx_patients_external', 'patients')
    op.drop_column('patients', 'external_metadata')
    op.drop_column('patients', 'external_id')
    op.drop_column('patients', 'source_system')
