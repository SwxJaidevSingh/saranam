"""Prescription versions: storage_kind + pdf_data (DB fallback when no Cloudinary)

Revision ID: b4d5e6f7a8b9
Revises: a3c4d5e6f7a8
Create Date: 2026-06-15 00:00:00.000000

Adds a storage_kind discriminator and a pdf_data BYTEA fallback so prescription
PDFs can be stored in the DB when Cloudinary isn't configured (the feature works
end-to-end either way; it uses Cloudinary automatically once creds exist). Additive.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b4d5e6f7a8b9'
down_revision = 'a3c4d5e6f7a8'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('prescription_versions', sa.Column('storage_kind', sa.String(20), nullable=True))
    op.add_column('prescription_versions', sa.Column('pdf_data', sa.LargeBinary(), nullable=True))


def downgrade():
    op.drop_column('prescription_versions', 'pdf_data')
    op.drop_column('prescription_versions', 'storage_kind')
