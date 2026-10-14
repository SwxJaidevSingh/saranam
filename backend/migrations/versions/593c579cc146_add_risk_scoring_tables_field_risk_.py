"""add_risk_scoring_tables_field_risk_rules_form_risk_levels_submission_risk_scores

Revision ID: 593c579cc146
Revises: 7a719531d563
Create Date: 2026-02-27 05:43:07.998342

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '593c579cc146'
down_revision = '7a719531d563'
branch_labels = None
depends_on = None


def upgrade():
    # Field Risk Rules - Store risk scoring rules for form fields
    op.create_table('field_risk_rules',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('field_id', sa.String(length=255), nullable=False),
        sa.Column('form_id', sa.UUID(), nullable=False),
        sa.Column('rule_type', sa.String(length=50), nullable=False),
        sa.Column('condition', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(['form_id'], ['forms.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("rule_type IN ('range', 'categorical')", name='valid_rule_type')
    )
    with op.batch_alter_table('field_risk_rules', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_field_risk_rules_field_id'), ['field_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_field_risk_rules_form_id'), ['form_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_field_risk_rules_rule_type'), ['rule_type'], unique=False)

    # Form Risk Levels - Define risk thresholds for forms
    op.create_table('form_risk_levels',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('form_id', sa.UUID(), nullable=False),
        sa.Column('level_name', sa.String(length=50), nullable=False),
        sa.Column('min_score', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('max_score', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('color_code', sa.String(length=20), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(['form_id'], ['forms.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('form_risk_levels', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_form_risk_levels_form_id'), ['form_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_form_risk_levels_level_name'), ['level_name'], unique=False)

    # Submission Risk Scores - Cache calculated risk scores
    op.create_table('submission_risk_scores',
        sa.Column('submission_id', sa.UUID(), nullable=False),
        sa.Column('total_score', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('risk_level', sa.String(length=50), nullable=False),
        sa.Column('field_scores', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('calculated_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['submission_id'], ['form_submissions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('submission_id')
    )
    with op.batch_alter_table('submission_risk_scores', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_submission_risk_scores_risk_level'), ['risk_level'], unique=False)
        batch_op.create_index(batch_op.f('ix_submission_risk_scores_total_score'), ['total_score'], unique=False)

    # Field Sections - Reusable field groups
    op.create_table('field_sections',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('fields', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('is_system', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('field_sections', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_field_sections_category'), ['category'], unique=False)
        batch_op.create_index(batch_op.f('ix_field_sections_is_system'), ['is_system'], unique=False)
        batch_op.create_index(batch_op.f('ix_field_sections_name'), ['name'], unique=False)

    # Add template columns to forms table
    op.add_column('forms', sa.Column('is_template', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('forms', sa.Column('template_category', sa.String(length=100), nullable=True))
    op.add_column('forms', sa.Column('template_description', sa.Text(), nullable=True))

    with op.batch_alter_table('forms', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_forms_is_template'), ['is_template'], unique=False)
        batch_op.create_index(batch_op.f('ix_forms_template_category'), ['template_category'], unique=False)


def downgrade():
    # Drop template columns from forms table
    with op.batch_alter_table('forms', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_forms_template_category'))
        batch_op.drop_index(batch_op.f('ix_forms_is_template'))

    op.drop_column('forms', 'template_description')
    op.drop_column('forms', 'template_category')
    op.drop_column('forms', 'is_template')

    # Drop field_sections table
    with op.batch_alter_table('field_sections', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_field_sections_name'))
        batch_op.drop_index(batch_op.f('ix_field_sections_is_system'))
        batch_op.drop_index(batch_op.f('ix_field_sections_category'))

    op.drop_table('field_sections')

    # Drop submission_risk_scores table
    with op.batch_alter_table('submission_risk_scores', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_submission_risk_scores_total_score'))
        batch_op.drop_index(batch_op.f('ix_submission_risk_scores_risk_level'))

    op.drop_table('submission_risk_scores')

    # Drop form_risk_levels table
    with op.batch_alter_table('form_risk_levels', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_form_risk_levels_level_name'))
        batch_op.drop_index(batch_op.f('ix_form_risk_levels_form_id'))

    op.drop_table('form_risk_levels')

    # Drop field_risk_rules table
    with op.batch_alter_table('field_risk_rules', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_field_risk_rules_rule_type'))
        batch_op.drop_index(batch_op.f('ix_field_risk_rules_form_id'))
        batch_op.drop_index(batch_op.f('ix_field_risk_rules_field_id'))

    op.drop_table('field_risk_rules')
