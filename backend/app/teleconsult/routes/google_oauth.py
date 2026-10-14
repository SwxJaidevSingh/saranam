"""One-time Google OAuth dance to capture the refresh token.

Flow:
1. Operator visits /api/teleconsult/google/oauth/start in browser.
2. Backend redirects to Google's consent screen (calendar.events scope).
3. After consent, Google redirects to /callback?code=... .
4. Backend exchanges code for tokens, persists refresh_token in
   system_settings (key: google_oauth_refresh_token).
5. From here on, GoogleMeetAdapter mints fresh access tokens silently.

In testing-mode OAuth apps the refresh token expires after 7 days; just
re-run /start to refresh it. Publish the OAuth app to "In production" to
remove that limit.
"""
import os
import secrets

from flask import redirect, request, jsonify, url_for, abort

from google_auth_oauthlib.flow import Flow

from app.extensions import db
from app.reminders.models import SystemSetting
from app.teleconsult.routes import teleconsult_bp


SCOPES = ["https://www.googleapis.com/auth/calendar.events"]
REFRESH_TOKEN_KEY = "google_oauth_refresh_token"
STATE_KEY = "google_oauth_state"
VERIFIER_KEY = "google_oauth_code_verifier"  # PKCE verifier persisted between /start and /callback


def _flow() -> Flow:
    client_id = os.getenv("GOOGLE_OAUTH_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET")
    redirect_uri = os.getenv(
        "GOOGLE_OAUTH_REDIRECT_URI",
        "http://localhost:5002/api/teleconsult/google/oauth/callback",
    )
    if not client_id or not client_secret:
        abort(500, "GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET missing in .env")
    return Flow.from_client_config(
        {
            "web": {
                "client_id": client_id,
                "client_secret": client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [redirect_uri],
            }
        },
        scopes=SCOPES,
        redirect_uri=redirect_uri,
    )


def _save_setting(key: str, value: str, description: str = ""):
    row = SystemSetting.query.filter_by(key=key).first()
    if row:
        row.value = value
    else:
        row = SystemSetting(key=key, value=value, description=description)
        db.session.add(row)
    db.session.commit()


def _get_setting(key: str):
    row = SystemSetting.query.filter_by(key=key).first()
    return row.value if row else None


@teleconsult_bp.route("/google/oauth/start", methods=["GET"])
def google_oauth_start():
    """Kick off the consent flow. Open this in a browser."""
    flow = _flow()
    state = secrets.token_urlsafe(24)
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",          # force refresh token return on every run
        include_granted_scopes="true",
        state=state,
    )
    # google-auth-oauthlib auto-enables PKCE for web clients — capture the
    # verifier so /callback can pass it back to fetch_token().
    _save_setting(STATE_KEY, state, "Transient OAuth CSRF state")
    if getattr(flow, "code_verifier", None):
        _save_setting(VERIFIER_KEY, flow.code_verifier, "Transient PKCE verifier")
    return redirect(auth_url)


@teleconsult_bp.route("/google/oauth/callback", methods=["GET"])
def google_oauth_callback():
    """Google redirects here after consent; exchange code for refresh token."""
    error = request.args.get("error")
    if error:
        return jsonify({"ok": False, "error": error}), 400

    received_state = request.args.get("state")
    expected_state = _get_setting(STATE_KEY)
    if not received_state or received_state != expected_state:
        return jsonify({"ok": False, "error": "Invalid OAuth state"}), 400

    code = request.args.get("code")
    if not code:
        return jsonify({"ok": False, "error": "Missing auth code"}), 400

    flow = _flow()
    verifier = _get_setting(VERIFIER_KEY)
    if verifier:
        flow.code_verifier = verifier
    try:
        flow.fetch_token(code=code)
    except Exception as e:
        return jsonify({"ok": False, "error": f"Token exchange failed: {e}"}), 400

    creds = flow.credentials
    if not creds.refresh_token:
        return jsonify({
            "ok": False,
            "error": "No refresh token returned. Revoke this app at "
                     "https://myaccount.google.com/permissions and re-run /start.",
        }), 400

    _save_setting(
        REFRESH_TOKEN_KEY,
        creds.refresh_token,
        "Google Calendar OAuth refresh token (Meet adapter)",
    )

    # State + verifier have done their job
    SystemSetting.query.filter_by(key=STATE_KEY).delete()
    SystemSetting.query.filter_by(key=VERIFIER_KEY).delete()
    db.session.commit()

    return jsonify({
        "ok": True,
        "message": "Google Calendar access authorized. Meet adapter is ready.",
        "scopes": creds.scopes,
        "token_uri": creds.token_uri,
    })


@teleconsult_bp.route("/google/oauth/status", methods=["GET"])
def google_oauth_status():
    """Quick check that the refresh token is in place."""
    rt = _get_setting(REFRESH_TOKEN_KEY)
    return jsonify({
        "authorized": bool(rt),
        "host_email": os.getenv("GOOGLE_MEET_HOST_EMAIL"),
        "redirect_uri": os.getenv("GOOGLE_OAUTH_REDIRECT_URI"),
    })
