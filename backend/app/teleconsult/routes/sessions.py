"""Teleconsult session routes."""
from datetime import datetime
from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.teleconsult.routes import teleconsult_bp
from app.teleconsult.services.orchestrator import SessionOrchestrator


def _parse_iso(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except (ValueError, AttributeError):
        return None


@teleconsult_bp.route("/sessions/initiate-now", methods=["POST"])
@jwt_required()
def initiate_now():
    data = request.get_json() or {}
    patient_id = data.get("patient_id")
    provider_id = data.get("provider_id")
    channel = data.get("channel")
    if not patient_id or not provider_id or not channel:
        return jsonify({"error": "patient_id, provider_id, channel required"}), 400
    if channel not in ("video", "voice"):
        return jsonify({"error": "channel must be 'video' or 'voice'"}), 400

    try:
        result = SessionOrchestrator.initiate_now(
            patient_id=patient_id,
            provider_id=provider_id,
            channel=channel,
            record_call=bool(data.get("record_call", False)),
            notes=data.get("notes"),
            created_by=get_jwt_identity(),
        )
        return jsonify(result), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@teleconsult_bp.route("/sessions/schedule", methods=["POST"])
@jwt_required()
def schedule_session():
    data = request.get_json() or {}
    patient_id = data.get("patient_id")
    provider_id = data.get("provider_id")
    channel = data.get("channel")
    scheduled_at = _parse_iso(data.get("scheduled_at"))
    if not patient_id or not provider_id or not channel or not scheduled_at:
        return jsonify({
            "error": "patient_id, provider_id, channel, scheduled_at (ISO-8601) required"
        }), 400
    if channel not in ("video", "voice"):
        return jsonify({"error": "channel must be 'video' or 'voice'"}), 400

    try:
        result = SessionOrchestrator.schedule(
            patient_id=patient_id,
            provider_id=provider_id,
            channel=channel,
            scheduled_at=scheduled_at,
            record_call=bool(data.get("record_call", False)),
            notes=data.get("notes"),
            linked_visit_id=data.get("linked_visit_id"),
            created_by=get_jwt_identity(),
        )
        return jsonify(result), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@teleconsult_bp.route("/sessions", methods=["GET"])
@jwt_required()
def list_sessions():
    args = request.args
    result = SessionOrchestrator.list_sessions(
        patient_id=args.get("patient_id"),
        provider_id=args.get("provider_id"),
        status=args.get("status"),
        channel=args.get("channel"),
        linked_visit_id=args.get("linked_visit_id"),
        from_dt=_parse_iso(args.get("from")),
        to_dt=_parse_iso(args.get("to")),
        limit=int(args.get("limit", 100)),
    )
    return jsonify({"sessions": result})


@teleconsult_bp.route("/sessions/this-week", methods=["GET"])
@jwt_required()
def this_week():
    result = SessionOrchestrator.list_this_week(provider_id=request.args.get("provider_id"))
    return jsonify({"sessions": result})


@teleconsult_bp.route("/sessions/<uuid:session_id>", methods=["GET"])
@jwt_required()
def get_session(session_id):
    include_tokens = request.args.get("include_tokens", "false").lower() == "true"
    result = SessionOrchestrator.get(session_id, include_tokens=include_tokens)
    if not result:
        return jsonify({"error": "Session not found"}), 404
    return jsonify(result)


@teleconsult_bp.route("/sessions/<uuid:session_id>/end", methods=["POST"])
@jwt_required()
def end_session(session_id):
    result = SessionOrchestrator.end(session_id)
    if not result:
        return jsonify({"error": "Session not found"}), 404
    return jsonify(result)


@teleconsult_bp.route("/sessions/<uuid:session_id>", methods=["DELETE"])
@jwt_required()
def cancel_session(session_id):
    data = request.get_json(silent=True) or {}
    result = SessionOrchestrator.cancel(session_id, reason=data.get("reason"))
    if not result:
        return jsonify({"error": "Session not found"}), 404
    return jsonify(result)

@teleconsult_bp.route("/sessions/<uuid:session_id>/documentation", methods=["GET"])
@jwt_required()
def get_documentation(session_id):
    documentation = SessionOrchestrator.get_documentation(session_id)

    if documentation is None:
        return jsonify({}), 200

    return jsonify(documentation), 200


@teleconsult_bp.route("/sessions/<uuid:session_id>/documentation", methods=["PUT"])
@jwt_required()
def save_documentation(session_id):
    payload = request.get_json() or {}

    documentation = SessionOrchestrator.save_documentation(
        session_id=session_id,
        payload=payload,
    )

    return jsonify(documentation), 200


@teleconsult_bp.route("/visits/<uuid:visit_id>/documentation", methods=["GET"])
@jwt_required()
def get_visit_documentation(visit_id):
    documentation = SessionOrchestrator.get_documentation_by_visit(visit_id)
    if documentation is None:
        return jsonify({}), 200
    return jsonify(documentation), 200


@teleconsult_bp.route("/visits/<uuid:visit_id>/documentation", methods=["PUT"])
@jwt_required()
def save_visit_documentation(visit_id):
    payload = request.get_json() or {}
    documentation = SessionOrchestrator.save_documentation_by_visit(
        visit_id=visit_id,
        payload=payload,
    )
    return jsonify(documentation), 200

