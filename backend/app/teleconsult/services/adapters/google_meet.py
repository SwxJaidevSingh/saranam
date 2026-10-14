"""GoogleMeetAdapter — primary video provider via Google Calendar API.

Creates a Calendar event with `conferenceData.createRequest` so Google
auto-attaches a Meet conference and returns `hangoutLink`. Same call also
sends Google's native calendar invite + popup reminders to attendees.

Auth: single shared scheduling account (consumer Gmail) authorizes our
app once via OAuth; refresh token persists in `system_settings`. The
adapter mints fresh access tokens on every call.

Voice / WhatsApp / SMS aren't supported — those raise NotImplementedError
so the orchestrator routes them to EnableX.
"""
import os
import uuid
from datetime import datetime, timedelta
from typing import Optional

from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.extensions import db
from app.reminders.models import SystemSetting
from app.teleconsult.services.adapters.base import ProviderAdapter, VendorOutageError


SCOPES = ["https://www.googleapis.com/auth/calendar.events"]
REFRESH_TOKEN_KEY = "google_oauth_refresh_token"
TIMEZONE_DEFAULT = os.getenv("TELECONSULT_TIMEZONE", "Asia/Kolkata")


class GoogleMeetUnavailable(VendorOutageError):
    """Raised when the adapter can't talk to Google (missing token, API failure).

    Inherits VendorOutageError so the orchestrator's existing fallback
    machinery picks it up the same way as EnableX 5xx / timeouts.
    """


class GoogleMeetAdapter(ProviderAdapter):
    name = "google_meet"
    supported_channels = {"video"}

    def __init__(self):
        self.client_id = os.getenv("GOOGLE_OAUTH_CLIENT_ID")
        self.client_secret = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET")
        self.host_email = os.getenv("GOOGLE_MEET_HOST_EMAIL", "primary")

    # ---- credentials ----------------------------------------------------

    def _get_refresh_token(self) -> Optional[str]:
        row = SystemSetting.query.filter_by(key=REFRESH_TOKEN_KEY).first()
        return row.value if row else None

    def _credentials(self) -> Credentials:
        rt = self._get_refresh_token()
        if not rt:
            raise GoogleMeetUnavailable(
                "Google OAuth not authorized — visit "
                "/api/teleconsult/google/oauth/start to grant access."
            )
        if not self.client_id or not self.client_secret:
            raise GoogleMeetUnavailable(
                "GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET missing"
            )
        creds = Credentials(
            token=None,
            refresh_token=rt,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=self.client_id,
            client_secret=self.client_secret,
            scopes=SCOPES,
        )
        try:
            creds.refresh(GoogleAuthRequest())
        except Exception as e:
            raise GoogleMeetUnavailable(f"Refresh token rejected: {e}") from e
        return creds

    def _service(self):
        try:
            return build("calendar", "v3", credentials=self._credentials(), cache_discovery=False)
        except GoogleMeetUnavailable:
            raise
        except Exception as e:
            raise GoogleMeetUnavailable(f"Calendar client init failed: {e}") from e

    # ---- VIDEO ----------------------------------------------------------

    def create_video_room(self, *, name, settings):
        """Create a calendar event with an auto-attached Meet conference.

        `settings` may contain (all optional):
          - duration_minutes (int, default 30)
          - scheduled_at (datetime, default now+1min)
          - description (str)
          - attendees (list of {"email": "..."})
          - timezone (str, default Asia/Kolkata)
        """
        scheduled_at = settings.get("scheduled_at") or datetime.utcnow() + timedelta(minutes=1)
        duration = max(15, int(settings.get("duration_minutes") or 30))
        end_at = scheduled_at + timedelta(minutes=duration)
        timezone = settings.get("timezone", TIMEZONE_DEFAULT)

        attendees = [a for a in (settings.get("attendees") or []) if a.get("email")]
        request_id = f"saranam-{uuid.uuid4().hex[:16]}"

        # Prefer the human-readable summary the orchestrator passes; fall back
        # to the technical `name` only if nothing nicer was provided.
        summary = settings.get("summary") or name or "Saranam Teleconsult"
        body = {
            "summary": summary[:200],
            "description": settings.get("description")
                or "Click the Google Meet link to join your video consultation.",
            "start": {"dateTime": scheduled_at.replace(microsecond=0).isoformat(),
                      "timeZone": timezone},
            "end": {"dateTime": end_at.replace(microsecond=0).isoformat(),
                    "timeZone": timezone},
            "attendees": attendees,
            "conferenceData": {
                "createRequest": {
                    "requestId": request_id,
                    "conferenceSolutionKey": {"type": "hangoutsMeet"},
                },
            },
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {"method": "popup", "minutes": 1440},
                    {"method": "popup", "minutes": 15},
                ],
            },
            "guestsCanInviteOthers": False,
            "guestsCanModify": False,
        }

        service = self._service()
        attendee_emails = [a.get("email") for a in attendees]
        print(f"[teleconsult] google_meet creating event '{summary}' "
              f"start={scheduled_at.isoformat()} attendees={attendee_emails}")
        try:
            event = service.events().insert(
                calendarId=self.host_email,
                body=body,
                conferenceDataVersion=1,
                sendUpdates="all",
            ).execute()
        except HttpError as e:
            raise GoogleMeetUnavailable(f"Calendar insert failed: {e}") from e
        ev_attendees = [(a.get("email"), a.get("responseStatus"))
                        for a in (event.get("attendees") or [])]
        print(f"[teleconsult] google_meet event created id={event.get('id')} "
              f"meet={event.get('hangoutLink')} attendees_returned={ev_attendees}")

        meet_url = event.get("hangoutLink")
        if not meet_url:
            # Sometimes the conferenceData isn't ready immediately; pull again.
            cd = event.get("conferenceData") or {}
            entry_points = cd.get("entryPoints") or []
            for ep in entry_points:
                if ep.get("entryPointType") == "video":
                    meet_url = ep.get("uri")
                    break
        if not meet_url:
            raise GoogleMeetUnavailable("Calendar event created but no Meet link returned")

        return {
            "room_id": event.get("id"),
            "moderator_token": None,
            "participant_token": None,
            "moderator_url": meet_url,
            "participant_url": meet_url,
            "raw": event,
        }

    def end_video_room(self, room_id):
        if not room_id:
            return False
        try:
            service = self._service()
            service.events().delete(
                calendarId=self.host_email,
                eventId=room_id,
                sendUpdates="all",
            ).execute()
            return True
        except (HttpError, GoogleMeetUnavailable):
            return False

    def fetch_recording(self, room_id):
        # Consumer Gmail Meet doesn't record; recording requires Workspace.
        return None

    # ---- VOICE / WhatsApp / SMS — not supported -------------------------

    def initiate_voice_call(self, **kwargs):
        raise NotImplementedError("google_meet does not support voice — use enablex")

    def end_voice_call(self, call_id):
        raise NotImplementedError("google_meet does not support voice")

    def send_whatsapp(self, **kwargs):
        raise NotImplementedError("google_meet does not support whatsapp")

    def send_sms(self, **kwargs):
        raise NotImplementedError("google_meet does not support sms")

    # ---- Webhook (no inbound webhooks for Meet via Calendar API) --------

    def verify_webhook(self, headers, raw_body):
        return False

    def parse_webhook_event(self, payload):
        return {"event_type": "unknown", "vendor_session_id": None,
                "data": payload, "occurred_at": None}
