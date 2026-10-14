"""Authentication and authorization decorators."""
from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity, get_jwt
from app.common.models import User


def require_auth(f):
    """Decorator to require authentication."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        verify_jwt_in_request()
        user_id = get_jwt_identity()
        current_user = User.query.get(user_id)

        if not current_user:
            return jsonify({
                'message': 'User not found',
                'error': 'invalid_user'
            }), 401

        return f(*args, current_user=current_user, **kwargs)
    return decorated_function


def require_role(*allowed_roles):
    """Decorator to require specific roles."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            user_role = claims.get('role')

            if user_role not in allowed_roles:
                return jsonify({
                    'message': f'Access denied. Required role: {", ".join(allowed_roles)}',
                    'error': 'insufficient_permissions'
                }), 403

            return f(*args, **kwargs)
        return decorated_function
    return decorator


def require_permission(permission):
    """Decorator to require specific permission."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            user = User.query.get(user_id)

            if not user or not user.has_permission(permission):
                return jsonify({
                    'message': f'Access denied. Required permission: {permission}',
                    'error': 'insufficient_permissions'
                }), 403

            return f(*args, **kwargs)
        return decorated_function
    return decorator


def get_current_user():
    """Get current authenticated user."""
    user_id = get_jwt_identity()
    return User.query.get(user_id)