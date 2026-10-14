"""add procedures records table for clinical procedures tracking

Revision ID: l2m3n4o5p6q7
Revises: k1l2m3n4o5p6
Create Date: 2026-04-01 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = 'l2m3n4o5p6q7'
down_revision = 'k1l2m3n4o5p6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('procedures_records',
        sa.Column('patient_id', sa.UUID(), nullable=False),
        sa.Column('visit_id', sa.UUID(), nullable=False),
        sa.Column('nursing', JSONB(), nullable=True),
        sa.Column('physiotherapy', JSONB(), nullable=True),
        sa.Column('counsellor', JSONB(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['visit_id'], ['patient_visits.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('visit_id', name='uq_procedures_record_visit'),
    )
    op.create_index('ix_procedures_records_patient_id', 'procedures_records', ['patient_id'])
    op.create_index('ix_procedures_records_visit_id', 'procedures_records', ['visit_id'])


def downgrade():
    op.drop_index('ix_procedures_records_visit_id', table_name='procedures_records')
    op.drop_index('ix_procedures_records_patient_id', table_name='procedures_records')
    op.drop_table('procedures_records')
