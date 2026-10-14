"""Authentication services."""
from datetime import datetime
from flask_jwt_extended import create_access_token, create_refresh_token
from app.extensions import db
from app.common.models import User


class AuthService:
    """Authentication service."""

    @staticmethod
    def register_user(email, password, full_name, role='viewer'):
        """Register a new user with pending approval status."""
        # Check if user exists
        if User.query.filter_by(email=email).first():
            return None, "User with this email already exists"

        # Create new user with is_approved=False (requires admin approval)
        user = User(
            email=email,
            full_name=full_name,
            role=role,
            is_approved=False  # New users require approval
        )
        user.set_password(password)

        try:
            db.session.add(user)
            db.session.commit()
            return user, "Registration successful. Your account is pending admin approval."
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def authenticate_user(email, password):
        """Authenticate user and return tokens."""
        # Find user by email
        user = User.query.filter_by(email=email).first()

        # Check password first
        if not user or not user.check_password(password):
            return None, "Invalid credentials"

        # Check if account is approved
        if not user.is_approved:
            return None, "Your account is pending admin approval. Please contact the administrator."

        # Check if account is active
        if not user.is_active:
            return None, "Your account has been deactivated. Please contact the administrator."

        # Create tokens
        access_token = create_access_token(
            identity=str(user.id),
            additional_claims={
                'email': user.email,
                'role': user.role,
                'full_name': user.full_name
            }
        )
        refresh_token = create_refresh_token(
            identity=str(user.id),
            additional_claims={'email': user.email}
        )

        return {
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': user.to_dict()
        }, "Login successful"

    @staticmethod
    def refresh_access_token(user_id):
        """Generate new access token."""
        user = User.query.get(user_id)
        if not user or not user.is_active:
            return None, "User not found or inactive"

        access_token = create_access_token(
            identity=str(user.id),
            additional_claims={
                'email': user.email,
                'role': user.role,
                'full_name': user.full_name
            }
        )

        return {'access_token': access_token}, "Token refreshed"

    @staticmethod
    def get_current_user(user_id):
        """Get current user details."""
        user = User.query.get(user_id)
        if not user:
            return None, "User not found"

        return user.to_dict(), "User found"