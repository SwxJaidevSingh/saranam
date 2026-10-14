"""add_is_approved_field_to_users

Revision ID: e6b57bd78fc2
Revises: 84980545a372
Create Date: 2026-03-13 20:05:02.590808

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e6b57bd78fc2'
down_revision = '84980545a372'
branch_labels = None
depends_on = None


def upgrade():
    # Add is_approved column with default False
    op.add_column('users', sa.Column('is_approved', sa.Boolean(), nullable=False, server_default='false'))

    # Create index on is_approved for better query performance
    op.create_index('ix_users_is_approved', 'users', ['is_approved'])

    # Auto-approve all existing users
    op.execute("UPDATE users SET is_approved = true")


def downgrade():
    # Drop index
    op.drop_index('ix_users_is_approved', table_name='users')

    # Drop column
    op.drop_column('users', 'is_approved')
