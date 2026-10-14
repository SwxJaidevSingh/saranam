"""Add patient_visits table for Saranam visit tracking

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-24 07:00:00.000000

Note: patient_visits table was already created by a previous migration (ec8f57118a55).
This migration is a no-op — it exists to maintain the revision chain.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    # patient_visits table already exists from previous migration ec8f57118a55
    # No action needed
    pass


def downgrade():
    # Don't drop the table since we didn't create it
    pass
