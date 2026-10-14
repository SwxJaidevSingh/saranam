"""Organization models — multi-tenant foundation (Hospital Portal Phase 1).

Three models, all extending BaseModel (UUID id + created_at/updated_at):

- Organization            → tenant org (hospital / ngo / camp / internal).
- OrganizationMembership  → (user, org, role) join; cross-org access is just an
                            extra membership row (no separate grants table).
- OrganizationInvite      → email invite flow for additional org users.

These are additive: the existing User.role and main-app behaviour are untouched.
No blueprints/routes in this phase. See
docs/Saranam/plans/hospital-portal-multitenant/plan.md §4 for rationale.
"""
from sqlalchemy import (
    Column, String, Boolean, DateTime, Date, ForeignKey, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from app.common.models import BaseModel


class Organization(BaseModel):
    """A tenant organization (hospital / ngo / camp / internal).

    `code` is the stable human identifier (e.g. 'KIMS', 'CVRAMAN'). The seed
    org `CVRAMAN` (type='internal', status='active') owns all existing patients.

    NOTE: an org may reference a `hospital_options` catalog code via
    `linked_hospital_code` (for intake defaults) but is a SEPARATE concept from
    the UHID catalog — multi-tenancy must not touch UHID generation.
    """
    __tablename__ = 'organizations'

    code = Column(String(16), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=True)
    # 'hospital' | 'ngo' | 'camp' | 'internal'
    type = Column(String(20), nullable=False)
    # 'pending_approval' | 'active' | 'suspended'
    status = Column(String(20), nullable=False, server_default='pending_approval')
    # Optional default linked_hospital catalog code for intake (separate from UHID).
    linked_hospital_code = Column(String(10), nullable=True)

    # Toggles controlled from the main (god-view) dashboard.
    can_view_org_directory = Column(Boolean, nullable=False, server_default='false')
    show_referral_feedback = Column(Boolean, nullable=False, server_default='false')

    # Per-org branding.
    logo_url = Column(String(500), nullable=True)
    accent_color = Column(String(16), nullable=True)

    is_active = Column(Boolean, nullable=False, server_default='true', index=True)

    def to_dict(self):
        """Serialize all fields (stringify UUIDs/dates)."""
        return {
            'id': str(self.id) if self.id else None,
            'code': self.code,
            'name': self.name,
            'display_name': self.display_name,
            'type': self.type,
            'status': self.status,
            'linked_hospital_code': self.linked_hospital_code,
            'can_view_org_directory': self.can_view_org_directory,
            'show_referral_feedback': self.show_referral_feedback,
            'logo_url': self.logo_url,
            'accent_color': self.accent_color,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f'<Organization {self.code} ({self.type}/{self.status})>'


class OrganizationMembership(BaseModel):
    """Join row: a user's role within an organization.

    Cross-org access is granted simply by inserting another membership row for
    the target org (granted by a platform admin). One user may belong to many
    orgs; (user_id, organization_id) is unique.
    """
    __tablename__ = 'organization_memberships'

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey('users.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey('organizations.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    # 'org_admin' | 'org_data_entry' | 'org_viewer'
    role = Column(String(20), nullable=False)
    is_active = Column(Boolean, nullable=False, server_default='true')
    invited_by = Column(
        UUID(as_uuid=True),
        ForeignKey('users.id', ondelete='SET NULL'),
        nullable=True,
    )
    joined_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint('user_id', 'organization_id', name='uq_org_membership_user_org'),
    )

    def to_dict(self):
        """Serialize all fields (stringify UUIDs/dates)."""
        return {
            'id': str(self.id) if self.id else None,
            'user_id': str(self.user_id) if self.user_id else None,
            'organization_id': str(self.organization_id) if self.organization_id else None,
            'role': self.role,
            'is_active': self.is_active,
            'invited_by': str(self.invited_by) if self.invited_by else None,
            'joined_at': self.joined_at.isoformat() if self.joined_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f'<OrganizationMembership user={self.user_id} org={self.organization_id} role={self.role}>'


class OrganizationInvite(BaseModel):
    """Email invite for adding a user to an organization.

    On accept: invitee sets their password → user created/linked → a membership
    row is inserted with the pre-assigned `role`. `token_hash` is the single-use
    hashed token and is NEVER exposed via to_dict().
    """
    __tablename__ = 'organization_invites'

    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey('organizations.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    email = Column(String(255), nullable=False, index=True)
    # 'org_admin' | 'org_data_entry' | 'org_viewer'
    role = Column(String(20), nullable=False)
    token_hash = Column(String(255), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    accepted_at = Column(DateTime, nullable=True)
    invited_by = Column(
        UUID(as_uuid=True),
        ForeignKey('users.id', ondelete='SET NULL'),
        nullable=True,
    )

    def to_dict(self):
        """Serialize fields. NOTE: token_hash is intentionally NOT exposed."""
        return {
            'id': str(self.id) if self.id else None,
            'organization_id': str(self.organization_id) if self.organization_id else None,
            'email': self.email,
            'role': self.role,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'accepted_at': self.accepted_at.isoformat() if self.accepted_at else None,
            'invited_by': str(self.invited_by) if self.invited_by else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f'<OrganizationInvite {self.email} org={self.organization_id} role={self.role}>'
