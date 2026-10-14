"""patient-summary-restructure: add summary_blocks JSONB column

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-05-14 16:30:00.000000

Per docs/Saranam/plans/patient-summary-restructure/plan.md §A3.

Adds a JSONB column holding the structured per-block narratives
({nursing, psychosocial, physiotherapy}) produced by the new patient
summary generator. summary_text is retained as a flattened fallback for
back-compat (PDFs, legacy callers).
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'd0e1f2a3b4c5'
down_revision = 'a8b9c0d1e2f3'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    has_col = bind.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name='patient_ai_summaries' AND column_name='summary_blocks'"
    )).scalar()
    if not has_col:
        op.add_column(
            'patient_ai_summaries',
            sa.Column(
                'summary_blocks',
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=True,
            ),
        )


def downgrade():
    bind = op.get_bind()
    has_col = bind.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name='patient_ai_summaries' AND column_name='summary_blocks'"
    )).scalar()
    if has_col:
        op.drop_column('patient_ai_summaries', 'summary_blocks')
