"""ai_summary columns + patient_ai_summaries table

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-04-30 00:00:00.000000

Adds:
- `ai_summary` TEXT column on the four assessment tables that get a per-form
  AI summary button (nursing / doctor / psychological / physiotherapy).
- New `patient_ai_summaries` table — one snapshot per patient (upsert,
  not history) for the holistic patient-level summary shown on the patient
  profile page.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'b8c9d0e1f2a3'
down_revision = 'a7b8c9d0e1f2'
branch_labels = None
depends_on = None


ASSESSMENT_TABLES = (
    'nursing_assessments',
    'doctor_assessments',
    'psychological_assessments',
    'physiotherapy_assessments',
)


def upgrade():
    bind = op.get_bind()

    def column_exists(table: str, column: str) -> bool:
        return bool(bind.execute(sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = :t AND column_name = :c"
        ), {'t': table, 'c': column}).scalar())

    def table_exists(name: str) -> bool:
        return bool(bind.execute(sa.text(
            "SELECT 1 FROM information_schema.tables WHERE table_name = :n"
        ), {'n': name}).scalar())

    for tbl in ASSESSMENT_TABLES:
        if not column_exists(tbl, 'ai_summary'):
            op.add_column(tbl, sa.Column('ai_summary', sa.Text(), nullable=True))

    if not table_exists('patient_ai_summaries'):
        op.create_table(
            'patient_ai_summaries',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('patient_id', postgresql.UUID(as_uuid=True),
                      sa.ForeignKey('patients.id', ondelete='CASCADE'),
                      nullable=False, unique=True),
            sa.Column('summary_text', sa.Text(), nullable=False),
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
            'ix_patient_ai_summaries_patient_id',
            'patient_ai_summaries', ['patient_id'],
        )


def downgrade():
    bind = op.get_bind()

    def column_exists(table: str, column: str) -> bool:
        return bool(bind.execute(sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = :t AND column_name = :c"
        ), {'t': table, 'c': column}).scalar())

    op.drop_index('ix_patient_ai_summaries_patient_id', table_name='patient_ai_summaries')
    op.drop_table('patient_ai_summaries')

    for tbl in ASSESSMENT_TABLES:
        if column_exists(tbl, 'ai_summary'):
            op.drop_column(tbl, 'ai_summary')
