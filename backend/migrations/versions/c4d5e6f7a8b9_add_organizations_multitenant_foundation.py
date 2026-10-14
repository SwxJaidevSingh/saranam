"""add organizations multi-tenant foundation (Hospital Portal Phase 1)

Revision ID: c4d5e6f7a8b9
Revises: 4ff0a21e96dc
Create Date: 2026-06-10 00:00:00.000000

Phase 1 of the Hospital Portal / multi-tenant platform (data-model only).
See docs/Saranam/plans/hospital-portal-multitenant/plan.md.

This migration:
  1. Creates `organizations`, `organization_memberships`, `organization_invites`.
  2. Adds `users.is_platform_admin` (the "god view" flag).
  3. Adds `patients.organization_id` (tenant owner) + six `origin_*` columns
     (structured referral source). `organization_id` is added NULLABLE first.
  4. BACKFILL:
       - Seeds a single internal org `CVRAMAN` (name 'CV Raman / Saranam',
         type 'internal', status 'active') if absent, via ON CONFLICT DO NOTHING.
       - Stamps every existing patient with that org's id
         (patients.organization_id IS NULL → CVRAMAN).
       - Flags every existing user is_platform_admin = true (all current users
         are CV Raman staff / platform admins).
  5. Sets `patients.organization_id` NOT NULL after the backfill.

It does NOT touch UHID logic, linked_hospital, hospital_uhid, or the
hospital_options catalog — multi-tenancy is orthogonal to UHID generation.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'c4d5e6f7a8b9'
down_revision = '4ff0a21e96dc'
branch_labels = None
depends_on = None


def upgrade():
    # ── 1. organizations ──────────────────────────────────────────────────
    op.create_table(
        'organizations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('code', sa.String(16), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('display_name', sa.String(255), nullable=True),
        sa.Column('type', sa.String(20), nullable=False),
        sa.Column('status', sa.String(20), nullable=False,
                  server_default='pending_approval'),
        sa.Column('linked_hospital_code', sa.String(10), nullable=True),
        sa.Column('can_view_org_directory', sa.Boolean(), nullable=False,
                  server_default=sa.text('false')),
        sa.Column('show_referral_feedback', sa.Boolean(), nullable=False,
                  server_default=sa.text('false')),
        sa.Column('logo_url', sa.String(500), nullable=True),
        sa.Column('accent_color', sa.String(16), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False,
                  server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), nullable=False,
                  server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False,
                  server_default=sa.func.now()),
        sa.UniqueConstraint('code', name='uq_organizations_code'),
    )
    op.create_index('ix_organizations_is_active', 'organizations', ['is_active'])

    # ── 2. organization_memberships ───────────────────────────────────────
    op.create_table(
        'organization_memberships',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('organizations.id', ondelete='CASCADE'),
                  nullable=False),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False,
                  server_default=sa.text('true')),
        sa.Column('invited_by', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('joined_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False,
                  server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False,
                  server_default=sa.func.now()),
        sa.UniqueConstraint('user_id', 'organization_id',
                            name='uq_org_membership_user_org'),
    )
    op.create_index('ix_organization_memberships_user_id',
                    'organization_memberships', ['user_id'])
    op.create_index('ix_organization_memberships_organization_id',
                    'organization_memberships', ['organization_id'])

    # ── 3. organization_invites ───────────────────────────────────────────
    op.create_table(
        'organization_invites',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('organizations.id', ondelete='CASCADE'),
                  nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('token_hash', sa.String(255), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('accepted_at', sa.DateTime(), nullable=True),
        sa.Column('invited_by', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False,
                  server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False,
                  server_default=sa.func.now()),
    )
    op.create_index('ix_organization_invites_organization_id',
                    'organization_invites', ['organization_id'])
    op.create_index('ix_organization_invites_email',
                    'organization_invites', ['email'])

    # ── 4. users.is_platform_admin ────────────────────────────────────────
    op.add_column(
        'users',
        sa.Column('is_platform_admin', sa.Boolean(), nullable=False,
                  server_default=sa.text('false')),
    )
    op.create_index('ix_users_is_platform_admin', 'users', ['is_platform_admin'])

    # ── 5. patients.organization_id (NULLABLE first) + origin_* ───────────
    op.add_column(
        'patients',
        sa.Column('organization_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('organizations.id'), nullable=True),
    )
    op.create_index('ix_patients_organization_id', 'patients', ['organization_id'])

    op.add_column('patients', sa.Column('origin_type', sa.String(20), nullable=True))
    op.create_index('ix_patients_origin_type', 'patients', ['origin_type'])
    op.add_column('patients', sa.Column('origin_source_code', sa.String(10), nullable=True))
    op.add_column(
        'patients',
        sa.Column('origin_organization_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('organizations.id'), nullable=True),
    )
    op.add_column('patients', sa.Column('origin_source_name', sa.String(150), nullable=True))
    op.add_column('patients', sa.Column('origin_referral_date', sa.Date(), nullable=True))
    op.add_column('patients', sa.Column('origin_notes', sa.Text(), nullable=True))

    # ── 6. BACKFILL ───────────────────────────────────────────────────────
    bind = op.get_bind()

    # 6a. Seed the internal CV Raman org (idempotent).
    bind.execute(sa.text("""
        INSERT INTO organizations (code, name, type, status)
        VALUES ('CVRAMAN', 'CV Raman / Saranam', 'internal', 'active')
        ON CONFLICT (code) DO NOTHING
    """))

    # 6b. Resolve its id.
    cvraman_id = bind.execute(sa.text(
        "SELECT id FROM organizations WHERE code = 'CVRAMAN'"
    )).scalar()

    # 6c. Stamp every existing patient with CVRAMAN ownership.
    bind.execute(
        sa.text("UPDATE patients SET organization_id = :org_id "
                "WHERE organization_id IS NULL"),
        {'org_id': cvraman_id},
    )

    # 6d. All existing users are CV Raman staff → platform admins.
    bind.execute(sa.text("UPDATE users SET is_platform_admin = true"))

    # ── 7. Now enforce NOT NULL on patients.organization_id ───────────────
    op.alter_column('patients', 'organization_id',
                    existing_type=postgresql.UUID(as_uuid=True),
                    nullable=False)


def downgrade():
    # Reverse in FK-safe order.

    # patients origin_* + organization_id
    op.drop_column('patients', 'origin_notes')
    op.drop_column('patients', 'origin_referral_date')
    op.drop_column('patients', 'origin_source_name')
    op.drop_column('patients', 'origin_organization_id')
    op.drop_index('ix_patients_origin_type', table_name='patients')
    op.drop_column('patients', 'origin_type')
    op.drop_column('patients', 'origin_source_code')
    op.drop_index('ix_patients_organization_id', table_name='patients')
    op.drop_column('patients', 'organization_id')

    # users.is_platform_admin
    op.drop_index('ix_users_is_platform_admin', table_name='users')
    op.drop_column('users', 'is_platform_admin')

    # org tables (children before parent)
    op.drop_index('ix_organization_invites_email', table_name='organization_invites')
    op.drop_index('ix_organization_invites_organization_id', table_name='organization_invites')
    op.drop_table('organization_invites')

    op.drop_index('ix_organization_memberships_organization_id', table_name='organization_memberships')
    op.drop_index('ix_organization_memberships_user_id', table_name='organization_memberships')
    op.drop_table('organization_memberships')

    op.drop_index('ix_organizations_is_active', table_name='organizations')
    op.drop_table('organizations')
