"""add investigation columns to doctor assessment

Revision ID: fce21906b262
Revises: 872d41c335ad
Create Date: 2026-06-25 12:24:47.691964

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'fce21906b262'
down_revision = '872d41c335ad'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('doctor_assessments', schema=None) as batch_op:
        batch_op.add_column(sa.Column('investigation_panels', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
        batch_op.add_column(sa.Column('investigation_others', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
        batch_op.add_column(sa.Column('investigation_notes', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('doctor_assessments', schema=None) as batch_op:
        batch_op.drop_column('investigation_notes')
        batch_op.drop_column('investigation_others')
        batch_op.drop_column('investigation_panels')