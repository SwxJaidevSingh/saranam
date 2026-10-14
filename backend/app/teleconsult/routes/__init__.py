"""Teleconsult routes — single blueprint for all /api/teleconsult/* endpoints."""
from flask import Blueprint, jsonify

teleconsult_bp = Blueprint("teleconsult", __name__)


@teleconsult_bp.route("/health", methods=["GET"])
def teleconsult_health():
    return jsonify({"status": "ok", "module": "teleconsult"})


# Sub-route registration — kept here so Phase 1 can drop in cleanly.
from app.teleconsult.routes import sessions       # noqa: E402, F401
from app.teleconsult.routes import webhooks       # noqa: E402, F401
from app.teleconsult.routes import on_duty        # noqa: E402, F401
from app.teleconsult.routes import google_oauth   # noqa: E402, F401
