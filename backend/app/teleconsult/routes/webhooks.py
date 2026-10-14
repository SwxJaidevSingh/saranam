"""Teleconsult webhook receivers — public endpoints for vendor callbacks."""
from flask import request, jsonify

from app.teleconsult.routes import teleconsult_bp
from app.teleconsult.services.orchestrator import SessionOrchestrator
from app.teleconsult.services.adapters.enablex import EnableXAdapter


@teleconsult_bp.route("/webhooks/enablex", methods=["POST"])
@teleconsult_bp.route("/webhooks/enablex/event", methods=["POST"])
def enablex_webhook():
    """EnableX posts call/room lifecycle events here.

    Two paths supported:
      - /webhooks/enablex          — video room webhooks (legacy)
      - /webhooks/enablex/event    — voice webhooks (per EnableX convention,
                                     event_url ends in /event)
    """
    raw = request.get_data() or b""
    adapter = EnableXAdapter()
    if not adapter.verify_webhook(dict(request.headers), raw):
        return jsonify({"error": "invalid signature"}), 401

    payload = request.get_json(silent=True) or {}
    parsed = adapter.parse_webhook_event(payload)
    result = SessionOrchestrator.apply_webhook_event(parsed)
    return jsonify(result), 200


@teleconsult_bp.route("/webhooks/enablex/inbound", methods=["POST", "GET"])
def enablex_inbound_webhook():
    """Inbound call routing — when a patient calls the EnableX virtual number,
    EnableX queries this endpoint to decide what to do (greeting + which
    doctor's mobile to dial).

    Configure in EnableX dashboard → Voice → Project Settings → Inbound
    Event URL → set to: https://<host>/api/teleconsult/webhooks/enablex/inbound

    Returns an EnableX-compatible action JSON: {action_on_connect.connect}
    targeting the on-duty doctor.
    """
    from app.teleconsult.services.inbound_router import handle_inbound_call

    payload = request.get_json(silent=True) or {}
    result = handle_inbound_call(payload, request_args=request.args)
    return jsonify(result), 200


@teleconsult_bp.route("/webhooks/exotel", methods=["POST"])
def exotel_webhook():
    """Placeholder — wired in Phase 7 when Exotel adapter ships."""
    return jsonify({"ok": True, "noop": True}), 200


# ---------------- Twilio ----------------

@teleconsult_bp.route("/webhooks/twilio/twiml", methods=["POST", "GET"])
def twilio_twiml_bridge():
    """TwiML returned to Twilio when the patient (leg-1) picks up.

    Twilio fetches this URL with method=POST. We respond with a <Dial>
    instruction that connects the doctor's phone (passed as ?bridge_to=).
    Both legs are then bridged by Twilio.
    """
    from xml.sax.saxutils import escape

    bridge_to = request.values.get("bridge_to", "").strip()
    caller_id = (
        __import__("os").getenv("TWILIO_FROM_NUMBER", "")
    )
    if not bridge_to:
        twiml = (
            "<?xml version='1.0' encoding='UTF-8'?>"
            "<Response><Say>No bridge target configured. Goodbye.</Say><Hangup/></Response>"
        )
        return twiml, 200, {"Content-Type": "text/xml"}

    caller_attr = f' callerId="{escape(caller_id)}"' if caller_id else ""
    twiml = (
        "<?xml version='1.0' encoding='UTF-8'?>"
        "<Response>"
        "<Say voice='alice'>Connecting you to your care team. Please hold.</Say>"
        f"<Dial{caller_attr} timeout='25' answerOnBridge='true'>"
        f"{escape(bridge_to)}"
        "</Dial>"
        "</Response>"
    )
    return twiml, 200, {"Content-Type": "text/xml"}


@teleconsult_bp.route("/webhooks/twilio/status", methods=["POST"])
def twilio_status_webhook():
    """Twilio status callbacks — initiated, ringing, answered, completed.

    Twilio posts form-encoded fields. We feed them through the adapter's
    parser and into the standard webhook event pipeline so the UI sees
    the same lifecycle as EnableX.
    """
    from app.teleconsult.services.adapters.twilio import TwilioAdapter

    payload = request.form.to_dict() or request.get_json(silent=True) or {}
    adapter = TwilioAdapter()
    parsed = adapter.parse_webhook_event(payload)
    result = SessionOrchestrator.apply_webhook_event(parsed)
    return jsonify(result), 200
