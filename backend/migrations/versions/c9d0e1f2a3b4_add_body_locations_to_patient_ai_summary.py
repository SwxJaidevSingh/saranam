"""body-map-rewrite: add body_locations JSONB column to patient_ai_summaries

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-05-01 18:30:00.000000

Per docs/Saranam/plans/body-map-rewrite/PLAN.md §5.1.

Adds a JSONB array column to hold AI-suggested body-location highlights
for the patient summary. Each item: {id, zoneSlug, text, userEdited,
createdAt, updatedAt}. Slugs are validated against the zone library.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'c9d0e1f2a3b4'
down_revision = 'b8c9d0e1f2a3'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    has_col = bind.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name='patient_ai_summaries' AND column_name='body_locations'"
    )).scalar()
    if not has_col:
        op.add_column(
            'patient_ai_summaries',
            sa.Column(
                'body_locations',
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=False,
                server_default=sa.text("'[]'::jsonb"),
            ),
        )


def downgrade():
    bind = op.get_bind()
    has_col = bind.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name='patient_ai_summaries' AND column_name='body_locations'"
    )).scalar()
    if has_col:
        op.drop_column('patient_ai_summaries', 'body_locations')
