"""Authentication routes."""
import hashlib
import secrets
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import Schema, fields, ValidationError

from app.extensions import db
from app.common.models import User
from app.auth.services import AuthService
from app.auth.decorators import require_auth
from app.auth.account_models import PlatformInvite, PasswordResetToken
from app.portal.email_util import send_email, get_app_base_url

# Create blueprint
auth_bp = Blueprint('auth', __name__)

RESET_TTL_HOURS = 2
# Generic response for forgot-password — identical whether or not the email
# exists, to avoid leaking which addresses have accounts.
GENERIC_RESET_MSG = 'If an account exists for that email, a reset link has been sent.'


def _hash_token(raw_token):
    """Deterministic sha256 hex of the raw token (what we store / look up by)."""
    return hashlib.sha256(raw_token.encode('utf-8')).hexdigest()


# Validation schemas
class RegisterSchema(Schema):
    """Registration validation schema."""
    email = fields.Email(required=True)
    password = fields.Str(required=True, validate=lambda x: len(x) >= 8)
    full_name = fields.Str(required=True, validate=lambda x: len(x) >= 2)
    role = fields.Str(missing='viewer', validate=lambda x: x in ['admin', 'data_entry', 'viewer'])


class LoginSchema(Schema):
    """Login validation schema."""
    email = fields.Email(required=True)
    password = fields.Str(required=True)


class AcceptInviteSchema(Schema):
    """Accept a platform invite: set name + password."""
    token = fields.Str(required=True, validate=lambda x: len(x or '') >= 1)
    full_name = fields.Str(required=True, validate=lambda x: len((x or '').strip()) >= 2)
    password = fields.Str(required=True, validate=lambda x: len(x or '') >= 8)


class ForgotPasswordSchema(Schema):
    """Request a password reset link."""
    email = fields.Email(required=True)


class ResetPasswordSchema(Schema):
    """Reset a password with a token."""
    token = fields.Str(required=True, validate=lambda x: len(x or '') >= 1)
    password = fields.Str(required=True, validate=lambda x: len(x or '') >= 8)


@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user."""
    schema = RegisterSchema()
    try:
        data = schema.load(request.json)
    except ValidationError as e:
        return jsonify({'message': 'Validation error', 'errors': e.messages}), 400

    user, message = AuthService.register_user(
        email=data['email'],
        password=data['password'],
        full_name=data['full_name'],
        role=data['role']
    )

    if not user:
        return jsonify({'message': message, 'error': 'registration_failed'}), 400

    return jsonify({'message': message, 'user': user.to_dict()}), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    """Login user and return tokens."""
    schema = LoginSchema()
    try:
        data = schema.load(request.json)
    except ValidationError as e:
        return jsonify({'message': 'Validation error', 'errors': e.messages}), 400

    result, message = AuthService.authenticate_user(
        email=data['email'],
        password=data['password']
    )

    if not result:
        return jsonify({'message': message, 'error': 'authentication_failed'}), 401

    # Realm separation: the main dashboard is for Saranam/platform staff only.
    # Hospital portal users (org members, not platform admins) must sign in via
    # the Hospital Portal — block them here so the two realms never cross.
    if not result['user'].get('is_platform_admin'):
        return jsonify({
            'message': 'This account belongs to the Hospital Portal. Please sign in there.',
            'error': 'portal_user',
        }), 403

    return jsonify({
        'message': message,
        'access_token': result['access_token'],
        'refresh_token': result['refresh_token'],
        'user': result['user']
    }), 200


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Refresh access token."""
    user_id = get_jwt_identity()
    result, message = AuthService.refresh_access_token(user_id)

    if not result:
        return jsonify({'message': message, 'error': 'refresh_failed'}), 401

    return jsonify({
        'message': message,
        'access_token': result['access_token']
    }), 200


@auth_bp.route('/me', methods=['GET'])
@require_auth
def get_current_user(current_user):
    """Get current user details."""
    user_id = get_jwt_identity()
    user_data, message = AuthService.get_current_user(user_id)

    if not user_data:
        return jsonify({'message': message, 'error': 'user_not_found'}), 404

    return jsonify({'user': user_data}), 200


@auth_bp.route('/logout', methods=['POST'])
@require_auth
def logout(current_user):
    """Logout user (client should remove tokens)."""
    # In a stateless JWT system, logout is handled client-side
    # Here we just return success
    return jsonify({'message': 'Logged out successfully'}), 200


@auth_bp.route('/accept-invite', methods=['POST'])
def accept_invite():
    """PUBLIC: accept a platform invite — create a main-dashboard user."""
    schema = AcceptInviteSchema()
    try:
        data = schema.load(request.get_json(silent=True) or {})
    except ValidationError as e:
        return jsonify({'message': 'Validation error', 'errors': e.messages}), 400

    invite = PlatformInvite.query.filter_by(token_hash=_hash_token(data['token'])).first()
    if invite is None or invite.accepted_at is not None or invite.expires_at < datetime.utcnow():
        return jsonify({'message': 'This invitation is invalid or has expired',
                        'error': 'invalid_invite'}), 400

    email = invite.email.strip().lower()
    if User.query.filter(User.email.ilike(email)).first():
        return jsonify({'message': 'An account with this email already exists',
                        'error': 'email_exists'}), 409

    try:
        user = User(
            email=email,
            full_name=data['full_name'].strip(),
            role=invite.role,          # main-app role pre-assigned on the invite
            is_approved=True,
            is_active=True,
            is_platform_admin=True,    # platform user — can sign in to the main dashboard
        )
        user.set_password(data['password'])
        db.session.add(user)
        invite.accepted_at = datetime.utcnow()
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'message': 'Could not complete signup', 'error': 'accept_failed'}), 500

    return jsonify({'message': 'Account created. You can now sign in.',
                    'user': user.to_dict()}), 201


@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """PUBLIC: email a password reset link. Always returns a generic success."""
    schema = ForgotPasswordSchema()
    try:
        data = schema.load(request.get_json(silent=True) or {})
    except ValidationError:
        return jsonify({'message': GENERIC_RESET_MSG}), 200

    email = data['email'].strip().lower()
    user = User.query.filter(User.email.ilike(email)).first()
    # Only main-dashboard (platform) users reset here; portal users reset via the portal.
    if user is not None and user.is_platform_admin and user.is_active:
        raw_token = secrets.token_urlsafe(32)
        prt = PasswordResetToken(
            user_id=user.id,
            token_hash=_hash_token(raw_token),
            expires_at=datetime.utcnow() + timedelta(hours=RESET_TTL_HOURS),
        )
        try:
            db.session.add(prt)
            db.session.commit()
            reset_link = f'{get_app_base_url()}/reset-password?token={raw_token}'
            send_email(
                to=email,
                subject='Reset your Saranam password',
                html_body=(
                    '<p>We received a request to reset your password.</p>'
                    f'<p><a href="{reset_link}">Reset your password</a></p>'
                    f'<p>This link expires in {RESET_TTL_HOURS} hours. '
                    'If you did not request this, you can ignore this email.</p>'
                ),
            )
        except Exception:
            db.session.rollback()
            # Still return generic success — never leak failure details.

    return jsonify({'message': GENERIC_RESET_MSG}), 200


@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """PUBLIC: set a new password using a reset token."""
    schema = ResetPasswordSchema()
    try:
        data = schema.load(request.get_json(silent=True) or {})
    except ValidationError as e:
        return jsonify({'message': 'Validation error', 'errors': e.messages}), 400

    prt = PasswordResetToken.query.filter_by(token_hash=_hash_token(data['token'])).first()
    if prt is None or prt.used_at is not None or prt.expires_at < datetime.utcnow():
        return jsonify({'message': 'This reset link is invalid or has expired',
                        'error': 'invalid_token'}), 400

    user = User.query.get(prt.user_id)
    if user is None:
        return jsonify({'message': 'This reset link is invalid or has expired',
                        'error': 'invalid_token'}), 400

    try:
        user.set_password(data['password'])
        prt.used_at = datetime.utcnow()
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'message': 'Could not reset password', 'error': 'reset_failed'}), 500

    return jsonify({'message': 'Password updated. You can now sign in.'}), 200