"""Add form sharing columns

Revision ID: 49a8938ba2c8
Revises: 788f0e305a04
Create Date: 2026-02-22 19:45:37.046937

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '49a8938ba2c8'
down_revision = '788f0e305a04'
branch_labels = None
depends_on = None


def upgrade():
    # Add form sharing columns
    op.add_column('forms', sa.Column('is_public', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('forms', sa.Column('share_token', sa.String(length=64), nullable=True))

    # Create indexes
    op.create_index(op.f('ix_forms_is_public'), 'forms', ['is_public'], unique=False)
    op.create_index(op.f('ix_forms_share_token'), 'forms', ['share_token'], unique=True)


def downgrade():
    # Remove indexes
    op.drop_index(op.f('ix_forms_share_token'), table_name='forms')
    op.drop_index(op.f('ix_forms_is_public'), table_name='forms')

    # Remove columns
    op.drop_column('forms', 'share_token')
    op.drop_column('forms', 'is_public')
