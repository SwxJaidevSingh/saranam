"""External API authentication - API Key and JWT hybrid."""
from functools import wraps
from flask import request, jsonify
from flask_jwt_extended import create_access_token, create_refresh_token
from app.common.models import User
from datetime import timedelta


def api_key_required(f):
    """
    Decorator to require API key authentication.

    Checks for 'X-API-Key' header and validates against service account.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')

        if not api_key:
            return jsonify({
                'error': 'Missing API key',
                'message': 'X-API-Key header is required'
            }), 401

        # Find user by API key
        user = User.find_by_api_key(api_key)

        if not user:
            return jsonify({
                'error': 'Invalid API key',
                'message': 'The provided API key is invalid or expired'
            }), 401

        if not user.is_active:
            return jsonify({
                'error': 'Account disabled',
                'message': 'This service account has been disabled'
            }), 403

        # Attach user to request for use in route
        request.current_user = user

        return f(*args, **kwargs)

    return decorated_function


def generate_tokens_for_user(user):
    """
    Generate JWT access and refresh tokens for a user.

    Args:
        user: User object

    Returns:
        dict with access_token and refresh_token
    """
    additional_claims = {
        'email': user.email,
        'role': user.role,
        'full_name': user.full_name
    }

    access_token = create_access_token(
        identity=str(user.id),
        additional_claims=additional_claims,
        expires_delta=timedelta(hours=1)
    )

    refresh_token = create_refresh_token(
        identity=str(user.id),
        additional_claims=additional_claims,
        expires_delta=timedelta(days=7)
    )

    return {
        'access_token': access_token,
        'refresh_token': refresh_token,
        'token_type': 'Bearer',
        'expires_in': 3600,  # 1 hour in seconds
        'user': {
            'id': str(user.id),
            'email': user.email,
            'full_name': user.full_name,
            'role': user.role
        }
    }
