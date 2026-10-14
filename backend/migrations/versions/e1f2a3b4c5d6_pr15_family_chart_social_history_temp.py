"""PR#15 follow-ups: family_chart, social_history_assessments, temperature→string

Revision ID: e1f2a3b4c5d6
Revises: d1e2f3a4b5c6
Create Date: 2026-06-15 00:00:00.000000

Brings the database in line with the models merged in PR #15 (which shipped
without migrations). Three changes, all additive / non-destructive:

  1. patients.family_chart  — new JSONB column (list of family-member rows).
  2. social_history_assessments — new table (one row per visit; UNIQUE(visit_id)).
  3. patient_visits.vitals_temperature  — Numeric(4,1) → varchar, converting
     every existing value to text via USING (no data loss; e.g. 37.2 → '37.2').
     The column is now free-text so clinicians can enter 'Afebrile' etc.; the
     read paths (to_dict, routes, analytics) tolerate non-numeric values.

Targets DigitalOcean (the new production). Supabase is intentionally NOT touched.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'e1f2a3b4c5d6'
down_revision = 'd1e2f3a4b5c6'
branch_labels = None
depends_on = None


def upgrade():
    # ── 1. patients.family_chart (JSONB, nullable) ────────────────────────
    op.add_column(
        'patients',
        sa.Column('family_chart', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )

    # ── 2. social_history_assessments ─────────────────────────────────────
    op.create_table(
        'social_history_assessments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('visit_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('patient_visits.id', ondelete='CASCADE'), nullable=False),
        # Social history
        sa.Column('source_of_income', sa.Text(), nullable=True),
        sa.Column('socioeconomic_status', sa.Text(), nullable=True),
        sa.Column('living_condition', sa.Text(), nullable=True),
        sa.Column('social_burden', sa.Text(), nullable=True),
        sa.Column('health_insurance', sa.Text(), nullable=True),
        # Insight
        sa.Column('insight_patient_diagnosis', sa.Text(), nullable=True),
        sa.Column('insight_patient_prognosis', sa.Text(), nullable=True),
        sa.Column('insight_family_diagnosis', sa.Text(), nullable=True),
        sa.Column('insight_family_prognosis', sa.Text(), nullable=True),
        # Social issues
        sa.Column('social_issues', sa.Text(), nullable=True),
        # Audit
        sa.Column('assessed_by', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id'), nullable=True),
        sa.Column('assessed_at', sa.DateTime(), nullable=True,
                  server_default=sa.func.now()),
        sa.Column('created_at', sa.DateTime(), nullable=False,
                  server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False,
                  server_default=sa.func.now()),
        sa.UniqueConstraint('visit_id', name='uq_social_history_assessment_visit'),
    )
    op.create_index('ix_social_history_assessments_patient_id',
                    'social_history_assessments', ['patient_id'])
    op.create_index('ix_social_history_assessments_visit_id',
                    'social_history_assessments', ['visit_id'])

    # ── 3. patient_visits.vitals_temperature → varchar (preserve data) ─────
    op.alter_column(
        'patient_visits', 'vitals_temperature',
        existing_type=sa.Numeric(precision=4, scale=1),
        type_=sa.String(),
        existing_nullable=True,
        postgresql_using='vitals_temperature::text',
    )


def downgrade():
    # Reverse order. Non-numeric temperature values can't cast back to Numeric,
    # so null them first (a rollback accepts losing any free-text readings).
    op.execute(
        r"UPDATE patient_visits SET vitals_temperature = NULL "
        r"WHERE vitals_temperature IS NOT NULL "
        r"AND vitals_temperature !~ '^-?[0-9]+(\.[0-9]+)?$'"
    )
    op.alter_column(
        'patient_visits', 'vitals_temperature',
        existing_type=sa.String(),
        type_=sa.Numeric(precision=4, scale=1),
        existing_nullable=True,
        postgresql_using='vitals_temperature::numeric(4,1)',
    )

    op.drop_index('ix_social_history_assessments_visit_id',
                  table_name='social_history_assessments')
    op.drop_index('ix_social_history_assessments_patient_id',
                  table_name='social_history_assessments')
    op.drop_table('social_history_assessments')

    op.drop_column('patients', 'family_chart')
