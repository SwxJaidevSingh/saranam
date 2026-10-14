"""visit_ai_summaries table — per-visit follow-up summaries

Revision ID: a8b9c0d1e2f3
Revises: c9d0e1f2a3b4
Create Date: 2026-05-14 00:00:00.000000

Per 2026-05-13 client meeting. Adds a new table storing one AI summary per
follow-up visit, so clinicians get a date-wise log of patient progression.
Distinct from `patient_ai_summaries` (which is one-row-per-patient "current
baseline") — this table accumulates over time and is the source of truth for:
  - the "Latest Patient Health" card on the patient Overview tab
  - the "Past Records" chronological section
  - (future) per-visit body-map state (column already provisioned)

Additive only — no destructive changes.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'a8b9c0d1e2f3'
down_revision = 'c9d0e1f2a3b4'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()

    def table_exists(name: str) -> bool:
        return bool(bind.execute(sa.text(
            "SELECT 1 FROM information_schema.tables WHERE table_name = :n"
        ), {'n': name}).scalar())

    if not table_exists('visit_ai_summaries'):
        op.create_table(
            'visit_ai_summaries',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('visit_id', postgresql.UUID(as_uuid=True),
                      sa.ForeignKey('patient_visits.id', ondelete='CASCADE'),
                      nullable=False, unique=True),
            sa.Column('patient_id', postgresql.UUID(as_uuid=True),
                      sa.ForeignKey('patients.id', ondelete='CASCADE'),
                      nullable=False),
            sa.Column('summary_text', sa.Text(), nullable=False),
            sa.Column('body_locations', postgresql.JSONB(),
                      nullable=False, server_default=sa.text("'[]'::jsonb")),
            sa.Column('model_used', sa.String(100), nullable=True),
            sa.Column('generated_at', sa.DateTime(), nullable=False),
            sa.Column('generated_by', postgresql.UUID(as_uuid=True),
                      sa.ForeignKey('users.id'), nullable=True),
            sa.Column('created_at', sa.DateTime(),
                      server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(),
                      server_default=sa.func.now(), nullable=False),
        )
        op.create_index(
            'ix_visit_ai_summaries_patient_id',
            'visit_ai_summaries', ['patient_id'],
        )


def downgrade():
    op.drop_index('ix_visit_ai_summaries_patient_id',
                  table_name='visit_ai_summaries')
    op.drop_table('visit_ai_summaries')
