"""add uhid to patients with counters and history tables

Revision ID: q7r8s9t0u1v2
Revises: p6q7r8s9t0u1
Create Date: 2026-04-11 06:00:00.000000

"""
from datetime import date
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'q7r8s9t0u1v2'
down_revision = 'p6q7r8s9t0u1'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Add uhid column to patients (nullable, unique)
    op.add_column(
        'patients',
        sa.Column('uhid', sa.String(20), nullable=True)
    )
    op.create_unique_constraint('uq_patients_uhid', 'patients', ['uhid'])

    # 2. Counter table — atomic per (year, zone) sequence tracking
    op.create_table(
        'uhid_counters',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('zone_code', sa.String(2), nullable=False),
        sa.Column('last_sequence', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('year', 'zone_code', name='uq_uhid_counter_year_zone'),
    )

    # 3. History table — audit trail for admin UHID regenerations
    op.create_table(
        'uhid_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('old_uhid', sa.String(20), nullable=False, index=True),
        sa.Column('new_uhid', sa.String(20), nullable=True),
        sa.Column('replaced_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('replaced_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # 4. Seed counter rows for current year × 5 zones so concurrent first inserts
    #    don't race on the missing-row case (UPSERT also handles it, but seeding
    #    avoids the first-insert path entirely under normal load).
    current_year = date.today().year
    op.execute(
        sa.text("""
            INSERT INTO uhid_counters (year, zone_code, last_sequence)
            VALUES
                (:y, '01', 0),
                (:y, '02', 0),
                (:y, '03', 0),
                (:y, '04', 0),
                (:y, '05', 0)
            ON CONFLICT (year, zone_code) DO NOTHING
        """).bindparams(y=current_year)
    )


def downgrade():
    op.drop_table('uhid_history')
    op.drop_table('uhid_counters')
    op.drop_constraint('uq_patients_uhid', 'patients', type_='unique')
    op.drop_column('patients', 'uhid')
