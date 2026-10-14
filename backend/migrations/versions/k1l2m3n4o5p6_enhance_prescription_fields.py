"""enhance prescription item fields: structured dosage, SOS, medicine type, dosage form, warning signs

Revision ID: k1l2m3n4o5p6
Revises: j9k0l1m2n3o4
Create Date: 2026-04-01 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'k1l2m3n4o5p6'
down_revision = 'j9k0l1m2n3o4'
branch_labels = None
depends_on = None


def upgrade():
    # Structured dosage (Req 5.1)
    op.add_column('opd_prescription_items', sa.Column('dosage_morning', sa.String(10), nullable=True))
    op.add_column('opd_prescription_items', sa.Column('dosage_afternoon', sa.String(10), nullable=True))
    op.add_column('opd_prescription_items', sa.Column('dosage_night', sa.String(10), nullable=True))

    # SOS flag (Req 5.5)
    op.add_column('opd_prescription_items', sa.Column('sos', sa.Boolean(), server_default='false', nullable=False))

    # Medicine type (Req 5.3)
    op.add_column('opd_prescription_items', sa.Column('medicine_type', sa.String(30), nullable=True))

    # Dosage form (Req 5.4)
    op.add_column('opd_prescription_items', sa.Column('dosage_form', sa.String(30), nullable=True))

    # Warning signs (Req 5.6)
    op.add_column('opd_prescription_items', sa.Column('warning_signs', sa.Text(), nullable=True))

    # Migrate old frequency text values to abbreviations
    op.execute("""
        UPDATE opd_prescription_items SET frequency = CASE
            WHEN frequency = 'Once daily' THEN 'OD'
            WHEN frequency = 'Twice daily' THEN 'BD'
            WHEN frequency = 'Three times daily' THEN 'TDS'
            WHEN frequency = 'Four times daily' THEN 'QDS'
            WHEN frequency = 'Every 4 hours' THEN 'Q4H'
            WHEN frequency = 'Every 6 hours' THEN 'Q6H'
            WHEN frequency = 'Every 8 hours' THEN 'Q8H'
            WHEN frequency = 'Stat' THEN 'STAT'
            ELSE frequency
        END
        WHERE frequency IN ('Once daily', 'Twice daily', 'Three times daily',
                           'Four times daily', 'Every 4 hours', 'Every 6 hours',
                           'Every 8 hours', 'Stat')
    """)

    # Rows with "As needed" frequency → set SOS flag and clear frequency
    op.execute("""
        UPDATE opd_prescription_items
        SET sos = true, frequency = NULL
        WHERE frequency = 'As needed' OR frequency = 'SOS'
    """)


def downgrade():
    op.drop_column('opd_prescription_items', 'warning_signs')
    op.drop_column('opd_prescription_items', 'dosage_form')
    op.drop_column('opd_prescription_items', 'medicine_type')
    op.drop_column('opd_prescription_items', 'sos')
    op.drop_column('opd_prescription_items', 'dosage_night')
    op.drop_column('opd_prescription_items', 'dosage_afternoon')
    op.drop_column('opd_prescription_items', 'dosage_morning')
