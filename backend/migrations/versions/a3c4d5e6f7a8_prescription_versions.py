"""Prescription versioning: prescription_versions + prescription_pdf_downloads

Revision ID: a3c4d5e6f7a8
Revises: f2b3c4d5e6f7
Create Date: 2026-06-15 00:00:00.000000

Two new tables for immutable, versioned, signed prescription PDFs:
  - prescription_versions     — one immutable issued PDF per (patient, version),
    with a frozen content + prescribing-doctor snapshot and a private Cloudinary ref.
  - prescription_pdf_downloads — audit/analytics row per PDF download.
Additive only — no existing table is altered.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'a3c4d5e6f7a8'
down_revision = 'f2b3c4d5e6f7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'prescription_versions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('visit_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('patient_visits.id', ondelete='SET NULL'), nullable=True),
        sa.Column('plan_of_care_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('plans_of_care.id', ondelete='SET NULL'), nullable=True),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('visit_type', sa.String(50), nullable=True),
        sa.Column('snapshot', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('prescribing_doctor', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('content_hash', sa.String(64), nullable=True),
        sa.Column('cloudinary_public_id', sa.String(255), nullable=True),
        sa.Column('cloudinary_url', sa.String(500), nullable=True),
        sa.Column('cloudinary_resource_type', sa.String(20), nullable=True, server_default='raw'),
        sa.Column('file_bytes', sa.Integer(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_prescription_versions_patient_id', 'prescription_versions', ['patient_id'])
    op.create_index('ix_prescription_versions_visit_id', 'prescription_versions', ['visit_id'])

    op.create_table(
        'prescription_pdf_downloads',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('version_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('prescription_versions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=True),
        sa.Column('downloaded_by', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_prescription_pdf_downloads_version_id', 'prescription_pdf_downloads', ['version_id'])
    op.create_index('ix_prescription_pdf_downloads_patient_id', 'prescription_pdf_downloads', ['patient_id'])
    op.create_index('ix_prescription_pdf_downloads_downloaded_by', 'prescription_pdf_downloads', ['downloaded_by'])


def downgrade():
    op.drop_table('prescription_pdf_downloads')
    op.drop_index('ix_prescription_versions_visit_id', table_name='prescription_versions')
    op.drop_index('ix_prescription_versions_patient_id', table_name='prescription_versions')
    op.drop_table('prescription_versions')
