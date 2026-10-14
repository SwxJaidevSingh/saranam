"""Account-management tokens: main-dashboard (platform) email invites and
password-reset tokens.

Both follow the org-invite security pattern: a high-entropy raw token is emailed
to the user and NEVER stored — we persist only sha256(token) and look up by that.
"""
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.common.models import BaseModel


class PlatformInvite(BaseModel):
    """Email invite to create a MAIN-DASHBOARD (platform) user.

    On accept the invitee sets name + password → a platform user is created
    (is_platform_admin=True) with the pre-assigned main-app `role`. `token_hash`
    is the single-use hashed token and is NEVER exposed via to_dict().
    """
    __tablename__ = 'platform_invites'

    email = Column(String(255), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # admin | data_entry | viewer
    token_hash = Column(String(255), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    accepted_at = Column(DateTime, nullable=True)
    invited_by = Column(
        UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'), nullable=True,
    )

    def to_dict(self):
        """Serialize fields. NOTE: token_hash is intentionally NOT exposed."""
        return {
            'id': str(self.id) if self.id else None,
            'email': self.email,
            'role': self.role,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'accepted_at': self.accepted_at.isoformat() if self.accepted_at else None,
            'invited_by': str(self.invited_by) if self.invited_by else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class PasswordResetToken(BaseModel):
    """Single-use password-reset token for the forgot-password flow."""
    __tablename__ = 'password_reset_tokens'

    user_id = Column(
        UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'),
        nullable=False, index=True,
    )
    token_hash = Column(String(255), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
