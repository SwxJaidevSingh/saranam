"""Widen nursing_assessments string columns for longer UI labels

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-03-24 17:30:00.000000

The OPD UI uses labels like 'Semi-conscious', 'Needs Attention', 'Independent',
'With Support' which exceed the original VARCHAR(10/20) limits.
"""
from alembic import op
import sqlalchemy as sa

revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade():
    # Widen all short string columns in nursing_assessments
    op.alter_column('nursing_assessments', 'consciousness', type_=sa.String(50))
    op.alter_column('nursing_assessments', 'orientation', type_=sa.String(50))
    op.alter_column('nursing_assessments', 'demeanor', type_=sa.String(50))
    op.alter_column('nursing_assessments', 'adl', type_=sa.String(50))
    op.alter_column('nursing_assessments', 'built', type_=sa.String(50))
    op.alter_column('nursing_assessments', 'hygiene_general', type_=sa.String(50))
    op.alter_column('nursing_assessments', 'wound_odor', type_=sa.String(50))
    op.alter_column('nursing_assessments', 'hygiene_environmental', type_=sa.String(50))
    op.alter_column('nursing_assessments', 'hygiene_oral', type_=sa.String(50))
    op.alter_column('nursing_assessments', 'hygiene_skin', type_=sa.String(50))

    # Also widen physiotherapy observation fields
    op.alter_column('physiotherapy_assessments', 'obs_built', type_=sa.String(50))


def downgrade():
    op.alter_column('nursing_assessments', 'consciousness', type_=sa.String(20))
    op.alter_column('nursing_assessments', 'orientation', type_=sa.String(20))
    op.alter_column('nursing_assessments', 'demeanor', type_=sa.String(20))
    op.alter_column('nursing_assessments', 'adl', type_=sa.String(30))
    op.alter_column('nursing_assessments', 'built', type_=sa.String(20))
    op.alter_column('nursing_assessments', 'hygiene_general', type_=sa.String(10))
    op.alter_column('nursing_assessments', 'wound_odor', type_=sa.String(20))
    op.alter_column('nursing_assessments', 'hygiene_environmental', type_=sa.String(10))
    op.alter_column('nursing_assessments', 'hygiene_oral', type_=sa.String(10))
    op.alter_column('nursing_assessments', 'hygiene_skin', type_=sa.String(10))
    op.alter_column('physiotherapy_assessments', 'obs_built', type_=sa.String(20))
