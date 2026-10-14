"""add care_status + place_of_death fields to patients (3-state status + death capture)

Revision ID: x4y5z6a7b8c9
Revises: w3x4y5z6a7b8
Create Date: 2026-04-18 12:00:00.000000

Meeting §3 (2026-04-14):
- Three-state patient status replaces the 2-state alive/deceased:
  Alive & Active  → is_deceased=false, care_status='active'
  Alive & Inactive → is_deceased=false, care_status='inactive'
  Deceased        → is_deceased=true   (care_status auto-demoted to 'inactive')
- Death capture gains Place of Death + Remarks (for 'Others').

Existing columns kept untouched: is_deceased, date_of_death, is_active
(is_active is a soft-delete / archival flag, NOT a clinical care state).
"""
from alembic import op
import sqlalchemy as sa

revision = 'x4y5z6a7b8c9'
down_revision = 'w3x4y5z6a7b8'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()

    def col_exists(name):
        return bind.execute(sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name='patients' AND column_name=:n"
        ), {'n': name}).scalar()

    # 1) care_status — clinical home-care state, default 'active'.
    if not col_exists('care_status'):
        op.add_column(
            'patients',
            sa.Column(
                'care_status',
                sa.String(20),
                nullable=False,
                server_default='active',
            ),
        )
        op.create_index('ix_patients_care_status', 'patients', ['care_status'])

    # 2) place_of_death — nullable enum-like string.
    if not col_exists('place_of_death'):
        op.add_column('patients', sa.Column('place_of_death', sa.String(30), nullable=True))

    # 3) place_of_death_remarks — used when place_of_death = 'others'.
    if not col_exists('place_of_death_remarks'):
        op.add_column('patients', sa.Column('place_of_death_remarks', sa.Text, nullable=True))

    # Backfill: any currently-deceased patient should be flagged Inactive so
    # the scheduler pool (which filters care_status='active') excludes them.
    bind.execute(sa.text(
        "UPDATE patients SET care_status='inactive' WHERE is_deceased = true"
    ))


def downgrade():
    op.drop_index('ix_patients_care_status', table_name='patients')
    op.drop_column('patients', 'place_of_death_remarks')
    op.drop_column('patients', 'place_of_death')
    op.drop_column('patients', 'care_status')
