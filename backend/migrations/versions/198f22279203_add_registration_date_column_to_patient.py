"""add registration_date column to Patient

Revision ID: 198f22279203
Revises: 165a96fb9002
Create Date: 2026-07-06 16:25:15.464324

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '198f22279203'
down_revision = '165a96fb9002'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('patients', schema=None) as batch_op:
        batch_op.add_column(sa.Column('registration_date', sa.Date(), nullable=True))


def downgrade():
    with op.batch_alter_table('patients', schema=None) as batch_op:
        batch_op.drop_column('registration_date')