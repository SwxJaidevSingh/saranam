"""User management services."""
from datetime import datetime
from sqlalchemy import or_
from app.extensions import db
from app.common.models import User


class UserService:
    """User management service."""

    @staticmethod
    def list_users(role_filter=None, status_filter=None, approval_filter=None, search_query=None,
                   page=1, per_page=50, include_hospital=False):
        """
        List users with optional filters.

        Args:
            role_filter: Filter by role (admin, data_entry, viewer)
            status_filter: Filter by status (active, inactive)
            approval_filter: Filter by approval (approved, pending, rejected)
            search_query: Search in email and full_name
            page: Page number (default: 1)
            per_page: Results per page (default: 50)
            include_hospital: When False (default) the main Users page shows the
                platform realm only — hospital-portal users (non-platform users
                with an active org membership) are hidden.

        Returns:
            Tuple of (users list, total count, message)
        """
        try:
            query = User.query

            # Hide hospital-portal users by default — these belong to an org and
            # sign in via the Hospital Portal, not the main dashboard. Platform
            # admins and not-yet-onboarded users (no membership) stay visible.
            if not include_hospital:
                from app.organizations.models import OrganizationMembership
                member_ids = db.session.query(OrganizationMembership.user_id).filter(
                    OrganizationMembership.is_active == True
                )
                query = query.filter(
                    or_(User.is_platform_admin == True, ~User.id.in_(member_ids))
                )

            # Apply role filter
            if role_filter:
                query = query.filter(User.role == role_filter)

            # Apply status filter
            if status_filter == 'active':
                query = query.filter(User.is_active == True)
            elif status_filter == 'inactive':
                query = query.filter(User.is_active == False)

            # Apply approval filter
            if approval_filter == 'approved':
                query = query.filter(User.is_approved == True)
            elif approval_filter == 'pending':
                query = query.filter(User.is_approved == False, User.is_active == True)
            elif approval_filter == 'rejected':
                query = query.filter(User.is_approved == False, User.is_active == False)

            # Apply search query
            if search_query:
                search_term = f'%{search_query}%'
                query = query.filter(
                    or_(
                        User.email.ilike(search_term),
                        User.full_name.ilike(search_term)
                    )
                )

            # Get total count
            total = query.count()

            # Apply pagination and order by created_at descending
            users = query.order_by(User.created_at.desc()).paginate(
                page=page, per_page=per_page, error_out=False
            )

            return [user.to_dict() for user in users.items], total, "Users retrieved successfully"

        except Exception as e:
            return None, 0, str(e)

    @staticmethod
    def create_platform_user(full_name, email, password, role):
        """Create a main-dashboard (platform) user.

        Unlike the org/hospital create flow, this sets is_platform_admin=True so
        the user can actually sign in to the main dashboard. Pre-approved and
        active. role is the main-app enum (admin | data_entry | viewer).

        Returns:
            Tuple of (user dict, message). user dict is None on failure.
        """
        try:
            email = (email or '').strip().lower()
            if User.query.filter(User.email.ilike(email)).first():
                return None, "A user with this email already exists"

            user = User(
                email=email,
                full_name=(full_name or '').strip(),
                role=role,
                is_approved=True,
                is_active=True,
                is_platform_admin=True,
            )
            user.set_password(password)
            db.session.add(user)
            db.session.commit()
            return user.to_dict(), "User created successfully"
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def set_password(user_id, new_password):
        """Admin set/reset a user's password.

        Returns:
            Tuple of (user dict, message). user dict is None on failure.
        """
        try:
            user = User.query.get(user_id)
            if not user:
                return None, "User not found"
            user.set_password(new_password)
            user.updated_at = datetime.utcnow()
            db.session.commit()
            return user.to_dict(), "Password updated successfully"
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def get_user(user_id):
        """
        Get user by ID.

        Args:
            user_id: User UUID

        Returns:
            Tuple of (user dict, message)
        """
        try:
            user = User.query.get(user_id)
            if not user:
                return None, "User not found"

            return user.to_dict(), "User retrieved successfully"

        except Exception as e:
            return None, str(e)

    @staticmethod
    def approve_user(user_id):
        """
        Approve a pending user.

        Args:
            user_id: User UUID

        Returns:
            Tuple of (user dict, message)
        """
        try:
            user = User.query.get(user_id)
            if not user:
                return None, "User not found"

            if user.is_approved:
                return None, "User is already approved"

            # Approve user
            user.is_approved = True
            user.is_active = True
            user.updated_at = datetime.utcnow()

            db.session.commit()

            return user.to_dict(), "User approved successfully"

        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def reject_user(user_id):
        """
        Reject a pending user (soft delete).
        Sets is_approved=False and is_active=False.

        Args:
            user_id: User UUID

        Returns:
            Tuple of (user dict, message)
        """
        try:
            user = User.query.get(user_id)
            if not user:
                return None, "User not found"

            # Soft delete: set both flags to False
            user.is_approved = False
            user.is_active = False
            user.updated_at = datetime.utcnow()

            db.session.commit()

            return user.to_dict(), "User rejected successfully"

        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def update_user(user_id, full_name=None, email=None, role=None):
        """
        Update user details.

        Args:
            user_id: User UUID
            full_name: New full name (optional)
            email: New email (optional)
            role: New role (optional)

        Returns:
            Tuple of (user dict, message)
        """
        try:
            user = User.query.get(user_id)
            if not user:
                return None, "User not found"

            # Check if email already exists (if changing email)
            if email and email != user.email:
                existing_user = User.query.filter_by(email=email).first()
                if existing_user:
                    return None, "Email already in use"
                user.email = email

            # Update fields if provided
            if full_name:
                user.full_name = full_name

            if role and role in ['admin', 'doctor', 'nurse', 'physiotherapist', 'counsellor', 'data_entry']:
                user.role = role
            elif role:
                return None, "Invalid role"

            user.updated_at = datetime.utcnow()
            db.session.commit()

            return user.to_dict(), "User updated successfully"

        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def toggle_active_status(user_id):
        """
        Toggle user active status.

        Args:
            user_id: User UUID

        Returns:
            Tuple of (user dict, message)
        """
        try:
            user = User.query.get(user_id)
            if not user:
                return None, "User not found"

            # Toggle is_active
            user.is_active = not user.is_active
            user.updated_at = datetime.utcnow()

            db.session.commit()

            status = "activated" if user.is_active else "deactivated"
            return user.to_dict(), f"User {status} successfully"

        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def get_pending_users_count():
        """
        Get count of pending approval users.

        Returns:
            Integer count
        """
        try:
            count = User.query.filter_by(is_approved=False, is_active=True).count()
            return count
        except Exception:
            return 0
