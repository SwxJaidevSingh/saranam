"""add exercise review to procedures

Revision ID: 430ca8eaa670
Revises: 05b6f3c73873
Create Date: 2026-07-19 20:22:44.992286

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '430ca8eaa670'
down_revision = '05b6f3c73873'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('procedures_records', schema=None) as batch_op:
        batch_op.add_column(sa.Column('exercise_review', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('procedures_records', schema=None) as batch_op:
        batch_op.drop_column('exercise_review')