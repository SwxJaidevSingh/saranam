"""On-duty status routes for teleconsult.

Reuses the existing CallLogAgentStatus table (from app.call_logs.models) so
the inbound_router and the legacy Smart Outreach module share one source of
truth for "which doctor is currently available to take an inbound call".
"""
from flask import jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.providers.models import HealthcareProvider
from app.call_logs.models import CallLogAgentStatus
from app.teleconsult.routes import teleconsult_bp


def _provider_for_user(user_id):
    if not user_id:
        return None
    return HealthcareProvider.query.filter_by(user_id=user_id).first()


@teleconsult_bp.route("/me/on-duty", methods=["GET"])
@jwt_required()
def get_my_on_duty():
    """Return current user's on-duty status, if they're linked to a provider."""
    user_id = get_jwt_identity()
    provider = _provider_for_user(user_id)
    if not provider:
        return jsonify({"linked_provider": False, "is_on_duty": False}), 200

    status = CallLogAgentStatus.query.filter_by(provider_id=provider.id).first()
    return jsonify({
        "linked_provider": True,
        "provider_id": str(provider.id),
        "provider_name": provider.full_name,
        "is_on_duty": bool(status.is_on_duty) if status else False,
    }), 200


@teleconsult_bp.route("/me/on-duty", methods=["PUT"])
@jwt_required()
def set_my_on_duty():
    user_id = get_jwt_identity()
    provider = _provider_for_user(user_id)
    if not provider:
        return jsonify({"error": "current user is not linked to a provider"}), 400

    body = request.get_json() or {}
    is_on_duty = bool(body.get("is_on_duty", False))

    status = CallLogAgentStatus.query.filter_by(provider_id=provider.id).first()
    if not status:
        status = CallLogAgentStatus(provider_id=provider.id, is_on_duty=is_on_duty)
        db.session.add(status)
    else:
        status.is_on_duty = is_on_duty
    db.session.commit()

    return jsonify({
        "linked_provider": True,
        "provider_id": str(provider.id),
        "is_on_duty": status.is_on_duty,
    }), 200


@teleconsult_bp.route("/on-duty", methods=["GET"])
@jwt_required()
def list_on_duty():
    """List of providers currently on duty (for admin / overview UI)."""
    rows = (
        db.session.query(HealthcareProvider, CallLogAgentStatus)
        .join(CallLogAgentStatus, HealthcareProvider.id == CallLogAgentStatus.provider_id)
        .filter(HealthcareProvider.is_active.is_(True))
        .filter(CallLogAgentStatus.is_on_duty.is_(True))
        .order_by(CallLogAgentStatus.last_updated.asc())
        .all()
    )
    return jsonify({
        "on_duty": [
            {
                "provider_id": str(p.id),
                "provider_name": p.full_name,
                "since": s.last_updated.isoformat() if s.last_updated else None,
            }
            for p, s in rows
        ]
    })
