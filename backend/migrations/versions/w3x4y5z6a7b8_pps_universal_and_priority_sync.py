"""make PPS universal (patient-level) and add latest_pps_score cache on patients

Revision ID: w3x4y5z6a7b8
Revises: v2w3x4y5z6a7
Create Date: 2026-04-18 11:00:00.000000

Meeting §2 (2026-04-14):
- PPS no longer visit-scoped — any update flows to patient-level priority.
- `patients.latest_pps_score` caches the most recent pps_scores.pps_score so
  list/card views don't need to JOIN the history table.
- Patient priority (stored in `clinical_complexity`) is auto-derived from the
  latest PPS via:   0-40 → high,  50-70 → medium,  80-100 → low.
  The scheduler's existing complexity→priority mapping already yields the
  correct ordering under the new semantics — no scheduler code changes.
"""
from alembic import op
import sqlalchemy as sa

revision = 'w3x4y5z6a7b8'
down_revision = 'v2w3x4y5z6a7'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()

    # 1) Patient cache column for the current PPS value.
    col_exists = bind.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name='patients' AND column_name='latest_pps_score'"
    )).scalar()
    if not col_exists:
        op.add_column('patients', sa.Column('latest_pps_score', sa.Integer(), nullable=True))

    # 2) pps_scores.visit_id: NOT NULL → NULL. Allow patient-level entries
    #    with no visit context (recorded from the universal PpsCard).
    bind.execute(sa.text("ALTER TABLE pps_scores ALTER COLUMN visit_id DROP NOT NULL"))

    # 3) Drop the unique(visit_id) constraint so multiple PPS rows per visit
    #    are allowed (re-assessment within a visit) and so standalone entries
    #    (visit_id=NULL) can coexist.
    #    Index may have been created by the unique constraint — drop both.
    constraint_exists = bind.execute(sa.text(
        "SELECT 1 FROM information_schema.table_constraints "
        "WHERE table_name='pps_scores' AND constraint_name='uq_pps_score_visit'"
    )).scalar()
    if constraint_exists:
        op.drop_constraint('uq_pps_score_visit', 'pps_scores', type_='unique')

    # 4) Non-unique lookup index on (patient_id, recorded_at DESC) for the
    #    "latest PPS for this patient" query used by the priority sync.
    idx_exists = bind.execute(sa.text(
        "SELECT 1 FROM pg_indexes WHERE tablename='pps_scores' "
        "AND indexname='ix_pps_scores_patient_recorded_at'"
    )).scalar()
    if not idx_exists:
        op.create_index(
            'ix_pps_scores_patient_recorded_at',
            'pps_scores',
            ['patient_id', sa.text('recorded_at DESC')],
        )


def downgrade():
    op.drop_index('ix_pps_scores_patient_recorded_at', table_name='pps_scores')
    op.create_unique_constraint('uq_pps_score_visit', 'pps_scores', ['visit_id'])
    op.alter_column('pps_scores', 'visit_id', nullable=False)
    op.drop_column('patients', 'latest_pps_score')
