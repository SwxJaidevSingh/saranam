"""Common database models."""
from datetime import datetime
from uuid import uuid4
from sqlalchemy import Column, String, Boolean, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID
from passlib.context import CryptContext
from app.extensions import db

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class BaseModel(db.Model):
    """Base model with common fields."""
    __abstract__ = True

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self):
        """Convert model to dictionary."""
        return {
            column.name: getattr(self, column.name)
            for column in self.__table__.columns
        }


class User(BaseModel):
    """User model."""
    __tablename__ = 'users'

    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(
        Enum('viewer','admin', 'doctor', 'nurse', 'physiotherapist', 'counsellor', 'data_entry', name='user_role'),
        nullable=False,
        default='data_entry'
    )
    is_active = Column(Boolean, default=True, nullable=False)
    is_approved = Column(Boolean, default=False, nullable=False, index=True)

    # Multi-tenant platform admin flag (Hospital Portal Phase 1). CV Raman staff
    # are platform admins ("god view"): they bypass org scoping. Existing users
    # are backfilled to true by the introducing migration. Orthogonal to `role`
    # (which still governs the main app) and to OrganizationMembership.
    is_platform_admin = Column(Boolean, default=False, nullable=False, server_default='false', index=True)

    # API Key for service accounts
    api_key_hash = Column(String(255), unique=True, index=True)

    # Relationships
    forms_created = db.relationship('Form', back_populates='creator', lazy='dynamic')
    submissions = db.relationship('Submission', back_populates='submitted_by_user', lazy='dynamic')

    def set_password(self, password):
        """Hash and set password."""
        self.password_hash = pwd_context.hash(password)

    def check_password(self, password):
        """Check if password matches hash."""
        return pwd_context.verify(password, self.password_hash)

    def set_api_key(self, api_key):
        """Hash and set API key for service account."""
        self.api_key_hash = pwd_context.hash(api_key)

    def check_api_key(self, api_key):
        """Check if API key matches hash."""
        if not self.api_key_hash:
            return False
        return pwd_context.verify(api_key, self.api_key_hash)

    @classmethod
    def find_by_api_key(cls, api_key):
        """
        Find user by API key (for service accounts).

        Args:
            api_key: The raw API key string

        Returns:
            User object or None if not found/invalid
        """
        # Get all users with API keys (should be few)
        users_with_keys = cls.query.filter(cls.api_key_hash.isnot(None)).all()
        for user in users_with_keys:
            if user.check_api_key(api_key):
                return user
        return None

    def to_dict(self):
        """Convert to dictionary (exclude password and API key)."""
        data = super().to_dict()
        data.pop('password_hash', None)
        data.pop('api_key_hash', None)
        data['is_platform_admin'] = self.is_platform_admin
        return data

    def has_permission(self, permission):
        """Check if user has permission based on role."""
        role_permissions = {
            'admin': [
                'create_form', 'edit_form', 'delete_form', 'view_form', 'submit_form', 
                'view_submission', 'view_analytics', 'manage_users', 'view_patients', 
                'create_patients', 'view_all_assessments', 'manage_prescriptions', 
                'manage_scheduling', 'view_physio_assessment', 'view_psych_assessment'
            ],
            'doctor': [
                'view_form', 'submit_form', 'view_submission', 'view_patients', 
                'create_patients', 'view_all_assessments', 'manage_prescriptions', 
                'manage_scheduling'
            ],
            'nurse': [
                'view_form', 'submit_form', 'view_submission', 'view_patients', 
                'create_patients', 'view_all_assessments', 'manage_scheduling'
            ],
            'physiotherapist': [
                'view_form', 'submit_form', 'view_submission', 'create_patients','view_patients', 
                'manage_scheduling', 'view_physio_assessment'
            ],
            'counsellor': [
                'view_form', 'submit_form', 'view_submission', 'create_patients', 
                'manage_scheduling', 'view_psych_assessment', 'view_patients'
            ],
            'data_entry': [
                'create_patients', 'manage_scheduling', 'view_patients'
            ],
            'viewer': [
                'create_patients'
            ]
        }
        return permission in role_permissions.get(self.role, [])

    def __repr__(self):
        return f'<User {self.email}>'