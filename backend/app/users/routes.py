"""User management routes."""
import hashlib
import secrets
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from marshmallow import Schema, fields, ValidationError

from app.extensions import db
from app.common.models import User
from app.users.services import UserService
from app.auth.decorators import require_role, require_permission
from app.auth.account_models import PlatformInvite
from app.organizations.email_realm import check_can_add_platform_user
from app.portal.email_util import send_email, get_app_base_url

# Create blueprint
users_bp = Blueprint('users', __name__)

INVITE_TTL_DAYS = 7


def _hash_token(raw_token):
    """Deterministic sha256 hex of the raw token (what we store / look up by)."""
    return hashlib.sha256(raw_token.encode('utf-8')).hexdigest()


# Validation schemas
class UpdateUserSchema(Schema):
    """Update user validation schema."""
    full_name = fields.Str(validate=lambda x: len(x) >= 2 if x else True)
    email = fields.Email()
    role = fields.Str(validate=lambda x: x in ['admin', 'doctor', 'nurse', 'physiotherapist', 'counsellor', 'data_entry', 'viewer'])


class CreateUserSchema(Schema):
    """Create main-dashboard (platform) user validation schema."""
    full_name = fields.Str(required=True, validate=lambda x: len((x or '').strip()) >= 2)
    email = fields.Email(required=True)
    password = fields.Str(required=True, validate=lambda x: len(x or '') >= 6)
    role = fields.Str(required=True, validate=lambda x: x in ['admin', 'doctor', 'nurse', 'physiotherapist', 'counsellor', 'data_entry', 'viewer'])


class InviteUserSchema(Schema):
    """Invite a main-dashboard user by email + role."""
    email = fields.Email(required=True)
    role = fields.Str(required=True, validate=lambda x: x in ['admin', 'doctor', 'nurse', 'physiotherapist', 'counsellor', 'data_entry', 'viewer'])


class SetPasswordSchema(Schema):
    """Admin sets a user's password."""
    password = fields.Str(required=True, validate=lambda x: len(x or '') >= 8)


@users_bp.route('', methods=['GET'])
@require_permission('manage_users')
def list_users():
    """
    List all users with optional filters.

    Query params:
        role: Filter by role (admin, data_entry, viewer)
        status: Filter by status (active, inactive)
        approval: Filter by approval (approved, pending, rejected)
        search: Search query for email/name
        page: Page number (default: 1)
        per_page: Results per page (default: 50)
    """
    # Get query parameters
    role_filter = request.args.get('role')
    status_filter = request.args.get('status')
    approval_filter = request.args.get('approval')
    search_query = request.args.get('search')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    # Default: platform realm only (hide hospital-portal users). Pass
    # include_hospital=true to show everyone.
    include_hospital = request.args.get('include_hospital', 'false').lower() == 'true'

    # Validate per_page
    if per_page > 100:
        per_page = 100

    users, total, message = UserService.list_users(
        role_filter=role_filter,
        status_filter=status_filter,
        approval_filter=approval_filter,
        search_query=search_query,
        page=page,
        per_page=per_page,
        include_hospital=include_hospital
    )

    if users is None:
        return jsonify({'message': message, 'error': 'list_failed'}), 500

    return jsonify({
        'users': users,
        'total': total,
        'page': page,
        'per_page': per_page,
        'message': message
    }), 200


@users_bp.route('', methods=['POST'])
@require_permission('manage_users')
def create_user():
    """Create a main-dashboard (platform) user that can sign in to the main app."""
    schema = CreateUserSchema()
    try:
        data = schema.load(request.get_json(silent=True) or {})
    except ValidationError as e:
        return jsonify({'message': 'Validation error', 'errors': e.messages}), 400

    # Realm-aware duplicate check: tell the admin WHY (already main-dashboard user
    # vs. registered through the Hospital Portal).
    ok, err_code, err_msg = check_can_add_platform_user(data['email'])
    if not ok:
        return jsonify({'message': err_msg, 'error': err_code}), 409

    user_data, message = UserService.create_platform_user(
        full_name=data['full_name'],
        email=data['email'],
        password=data['password'],
        role=data['role'],
    )

    if not user_data:
        return jsonify({'message': message, 'error': 'create_failed'}), 409

    return jsonify({'user': user_data, 'message': message}), 201


@users_bp.route('/invite', methods=['POST'])
@require_permission('manage_users')
def invite_user():
    """Invite a main-dashboard (platform) user by email — emails an accept link."""
    schema = InviteUserSchema()
    try:
        data = schema.load(request.get_json(silent=True) or {})
    except ValidationError as e:
        return jsonify({'message': 'Validation error', 'errors': e.messages}), 400

    email = data['email'].strip().lower()
    # Realm-aware duplicate check (already main-dashboard user vs. Hospital Portal).
    ok, err_code, err_msg = check_can_add_platform_user(email)
    if not ok:
        return jsonify({'message': err_msg, 'error': err_code}), 409

    # Random token; store ONLY its hash. Raw token is emailed, never persisted.
    raw_token = secrets.token_urlsafe(32)
    invite = PlatformInvite(
        email=email,
        role=data['role'],
        token_hash=_hash_token(raw_token),
        expires_at=datetime.utcnow() + timedelta(days=INVITE_TTL_DAYS),
        invited_by=get_jwt_identity(),
    )
    try:
        db.session.add(invite)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'message': 'Could not create invite', 'error': 'invite_failed'}), 500

    accept_link = f'{get_app_base_url()}/accept-invite?token={raw_token}'
    sent = send_email(
        to=email,
        subject='You have been invited to the Saranam dashboard',
        html_body=(
            f'<p>You have been invited to the <strong>Saranam dashboard</strong> as '
            f'<strong>{data["role"].replace("_", " ")}</strong>.</p>'
            f'<p><a href="{accept_link}">Accept your invitation &amp; set your password</a></p>'
            f'<p>This invitation expires in {INVITE_TTL_DAYS} days.</p>'
        ),
    )
    return jsonify({
        'message': 'Invite sent' if sent else 'Invite created (email not configured in this environment)',
        'invite': invite.to_dict(),
        'email_sent': sent,
    }), 201


@users_bp.route('/<user_id>/password', methods=['PUT'])
@require_permission('manage_users')
def set_user_password(user_id):
    """Admin sets/resets a user's password."""
    schema = SetPasswordSchema()
    try:
        data = schema.load(request.get_json(silent=True) or {})
    except ValidationError as e:
        return jsonify({'message': 'Validation error', 'errors': e.messages}), 400

    user_data, message = UserService.set_password(user_id, data['password'])
    if not user_data:
        return jsonify({'message': message, 'error': 'set_password_failed'}), 400

    return jsonify({'user': user_data, 'message': message}), 200


@users_bp.route('/<user_id>', methods=['GET'])
@require_permission('manage_users')
def get_user(user_id):
    """Get user by ID."""
    user_data, message = UserService.get_user(user_id)

    if not user_data:
        return jsonify({'message': message, 'error': 'user_not_found'}), 404

    return jsonify({'user': user_data, 'message': message}), 200


@users_bp.route('/<user_id>/approve', methods=['POST'])
@require_permission('manage_users')
def approve_user(user_id):
    """Approve a pending user."""
    user_data, message = UserService.approve_user(user_id)

    if not user_data:
        return jsonify({'message': message, 'error': 'approve_failed'}), 400

    return jsonify({'user': user_data, 'message': message}), 200


@users_bp.route('/<user_id>/reject', methods=['POST'])
@require_permission('manage_users')
def reject_user(user_id):
    """Reject a pending user (soft delete)."""
    user_data, message = UserService.reject_user(user_id)

    if not user_data:
        return jsonify({'message': message, 'error': 'reject_failed'}), 400

    return jsonify({'user': user_data, 'message': message}), 200


@users_bp.route('/<user_id>', methods=['PUT'])
@require_permission('manage_users')
def update_user(user_id):
    """Update user details."""
    schema = UpdateUserSchema()
    try:
        data = schema.load(request.json)
    except ValidationError as e:
        return jsonify({'message': 'Validation error', 'errors': e.messages}), 400

    user_data, message = UserService.update_user(
        user_id=user_id,
        full_name=data.get('full_name'),
        email=data.get('email'),
        role=data.get('role')
    )

    if not user_data:
        return jsonify({'message': message, 'error': 'update_failed'}), 400

    return jsonify({'user': user_data, 'message': message}), 200


@users_bp.route('/<user_id>/toggle-status', methods=['PUT'])
@require_permission('manage_users')
def toggle_user_status(user_id):
    """Toggle user active status."""
    user_data, message = UserService.toggle_active_status(user_id)

    if not user_data:
        return jsonify({'message': message, 'error': 'toggle_failed'}), 400

    return jsonify({'user': user_data, 'message': message}), 200


@users_bp.route('/pending/count', methods=['GET'])
@require_permission('manage_users')
def get_pending_count():
    """Get count of pending approval users."""
    count = UserService.get_pending_users_count()
    return jsonify({'count': count}), 200
