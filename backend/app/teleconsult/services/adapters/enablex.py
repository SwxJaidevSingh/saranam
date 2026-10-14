"""EnableXAdapter — production adapter for EnableX video / voice / WhatsApp / SMS.

Auth: HTTP Basic with APP_ID:APP_KEY against api.enablex.io.
Docs: https://developer.enablex.io/
"""
import os
import hmac
import hashlib
from typing import Optional

import requests
from requests.auth import HTTPBasicAuth

from app.teleconsult.services.adapters.base import ProviderAdapter, VendorOutageError


class EnableXAdapter(ProviderAdapter):
    name = "enablex"
    supported_channels = {"video", "voice", "whatsapp", "sms"}

    def __init__(self):
        self.app_id = os.getenv("ENABLEX_APP_ID")
        self.app_key = os.getenv("ENABLEX_APP_KEY")
        self.base = os.getenv("ENABLEX_BASE_URL", "https://api.enablex.io")
        # Video uses /v1/rooms (no /video prefix per their official sample app
        # github.com/EnableX/Video-Conferencing-Open-Source-Web-Application-Sample).
        self.video_path = os.getenv("ENABLEX_VIDEO_PATH", "/v1")
        self.voice_path = os.getenv("ENABLEX_VOICE_PATH", "/voice/v1")
        self.wa_path = os.getenv("ENABLEX_WA_PATH", "/whatsapp/v1")
        self.sms_path = os.getenv("ENABLEX_SMS_PATH", "/sms/v1")
        # The "toolkit URL" is now our own self-hosted patient join page;
        # EnableX has no hosted iframe. Patient opens this URL with ?token=,
        # the page loads /vendor/EnxRtc.js and joins the room directly.
        self.toolkit = os.getenv(
            "TELECONSULT_PATIENT_JOIN_URL",
            os.getenv("ENABLEX_TOOLKIT_URL", "https://video.enablex.io"),
        )
        self.secret = os.getenv("ENABLEX_WEBHOOK_SECRET")

    # ---- helpers --------------------------------------------------------

    def _auth(self):
        if not self.app_id or not self.app_key:
            raise RuntimeError("ENABLEX_APP_ID / ENABLEX_APP_KEY missing")
        return HTTPBasicAuth(self.app_id, self.app_key)

    def _request(self, method, path, **kwargs):
        url = f"{self.base}{path}"
        try:
            r = requests.request(method, url, auth=self._auth(), timeout=15, **kwargs)
        except requests.Timeout as e:
            raise VendorOutageError(f"EnableX timeout on {method} {path}") from e
        except requests.ConnectionError as e:
            raise VendorOutageError(f"EnableX connection error on {method} {path}") from e

        if 500 <= r.status_code < 600:
            raise VendorOutageError(f"EnableX 5xx on {method} {path}: {r.status_code}")
        if r.status_code >= 400:
            # Surface the body in the exception so logs are useful, but don't
            # let a non-JSON 4xx body crash callers that try to .json() the
            # response after the fact.
            try:
                err = r.json()
            except ValueError:
                err = {"raw": r.text[:300]}
            raise requests.HTTPError(
                f"EnableX {method} {path} → {r.status_code}: {err}",
                response=r,
            )
        if r.status_code == 204 or not r.content:
            return {}
        try:
            return r.json()
        except ValueError:
            # Non-JSON success body — just hand back text under a key so
            # callers don't have to special-case.
            return {"raw": r.text}

    def _toolkit_url(self, token: Optional[str]) -> Optional[str]:
        """Patient/Provider join URL.

        Points at our own self-hosted /teleconsult/join page (set via
        TELECONSULT_PATIENT_JOIN_URL env). The page bootstraps the
        EnableX Web SDK and joins the room with this token.
        """
        if not token:
            return None
        sep = "&" if "?" in self.toolkit else "?"
        return f"{self.toolkit}{sep}token={token}"

    # ---- VIDEO ----------------------------------------------------------

    def create_video_room(self, *, name, settings):
        """POST /v1/rooms/ — verified shape from EnableX official sample.

        Required: name, owner_ref, settings.duration (minutes).
        moderators / participants are STRING counts ('1'), not lists.
        """
        body = {
            "name": name[:60],
            "owner_ref": str(settings.get("owner_ref", "system"))[:60],
            "settings": {
                "description": settings.get("description", name)[:120],
                "mode": "group",
                "scheduled": False,
                "adhoc": True,
                # EnableX requires duration > 9 (i.e. ≥ 10 minutes)
                "duration": max(10, int(settings.get("duration_minutes", 30))),
                "moderators": "1",
                "participants": "1",
                "quality": "SD",
                "canvas": False,
                "screen_share": False,
                "abwd": True,
                "max_active_talkers": 2,
                "auto_recording": bool(settings.get("record", False)),
            },
        }
        resp = self._request("POST", f"{self.video_path}/rooms", json=body)
        room = (resp or {}).get("room") or resp or {}
        room_id = room.get("room_id") or room.get("id")

        moderator = self._issue_token(
            room_id, role="moderator", name=settings.get("moderator_name", "Doctor")
        )
        participant = self._issue_token(
            room_id, role="participant", name=settings.get("participant_name", "Patient")
        )

        return {
            "room_id": room_id,
            "moderator_token": moderator.get("token"),
            "participant_token": participant.get("token"),
            "moderator_url": moderator.get("url") or self._toolkit_url(moderator.get("token")),
            "participant_url": participant.get("url") or self._toolkit_url(participant.get("token")),
            "raw": resp,
        }

    def _issue_token(self, room_id, *, role, name):
        if not room_id:
            return {}
        # EnableX expects a `details` wrapper per vcxroom.js sample.
        resp = self._request(
            "POST",
            f"{self.video_path}/rooms/{room_id}/tokens",
            json={
                "name": name,
                "role": role,
                "user_ref": f"{role}-{name}".replace(" ", "-").lower(),
            },
        )
        token = (
            resp.get("token")
            or (resp.get("data") or {}).get("token")
            or (resp.get("token_info") or {}).get("token")
        )
        url = (
            resp.get("url")
            or (resp.get("data") or {}).get("url")
            or (resp.get("token_info") or {}).get("url")
        )
        return {"token": token, "url": url}

    def end_video_room(self, room_id):
        try:
            self._request("DELETE", f"{self.video_path}/rooms/{room_id}")
            return True
        except (requests.RequestException, VendorOutageError):
            return False

    def fetch_recording(self, room_id):
        try:
            resp = self._request("GET", f"{self.video_path}/rooms/{room_id}/recordings")
            recs = resp.get("recordings") or []
            return recs[0]["url"] if recs else None
        except (requests.RequestException, VendorOutageError):
            return None

    # ---- VOICE ----------------------------------------------------------

    def initiate_voice_call(self, *, from_number, to_number, caller_id, callback_url, record):
        """EnableX Voice v2 — POST /voice/v1/call (bridge-on-connect mode).

        Verified against EnableX's official sample
        github.com/EnableX/voice-outbound-bridge-on-connect.

        Flow:
          1. EnableX rings `to` (the patient) using `from` as caller-ID.
          2. Patient answers.
          3. EnableX dials `action_on_connect.connect.to` (the doctor)
             from `action_on_connect.connect.from` (virtual number again).
          4. When the doctor picks up, EnableX bridges the two legs.

        Body is snake_case. `from_number` parameter is the doctor's phone
        (used for the second leg). `caller_id` is the EnableX virtual
        number (used for both leg's caller identity).
        """
        body = {
            "name": "Saranam Teleconsult",
            "owner_ref": "saranam-teleconsult",
            # First leg
            "to": str(to_number),                # patient
            "from": str(caller_id) if caller_id else str(from_number),  # virtual number
            "auto_record": bool(record),
            # Bridge to the second leg (doctor) once the first leg connects
            "action_on_connect": {
                "connect": {
                    "from": str(caller_id) if caller_id else str(from_number),
                    "to": str(from_number),      # doctor
                },
            },
        }
        if callback_url:
            # EnableX convention: webhook URL ends in /event
            url = callback_url
            if not url.endswith("/event"):
                url = url.rstrip("/") + "/event"
            body["event_url"] = url

        print(f"[teleconsult] voice call — leg1 to={body['to']} from={body['from']} "
              f"leg2 connect.to={body['action_on_connect']['connect']['to']} "
              f"connect.from={body['action_on_connect']['connect']['from']}")
        resp = self._request("POST", f"{self.voice_path}/call", json=body)
        print(f"[teleconsult] voice call response: {resp}")
        return {
            "call_id": (
                resp.get("voice_id")
                or resp.get("call_id")
                or resp.get("id")
            ),
            "status": resp.get("state") or resp.get("status", "initiated"),
            "raw": resp,
        }

    def end_voice_call(self, call_id):
        if not call_id:
            return False
        try:
            self._request("DELETE", f"{self.voice_path}/call/{call_id}")
            return True
        except (requests.RequestException, VendorOutageError):
            return False

    # ---- WhatsApp -------------------------------------------------------

    def send_whatsapp(self, *, to, template_key, params):
        body = {
            "to": to,
            "template": template_key,
            "language": "en",
            "components": [
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": str(p)} for p in params],
                }
            ],
        }
        resp = self._request("POST", f"{self.wa_path}/messages", json=body)
        return {
            "message_id": resp.get("message_id") or resp.get("id"),
            "status": resp.get("status", "queued"),
            "raw": resp,
        }

    # ---- SMS ------------------------------------------------------------

    def send_sms(self, *, to, body):
        resp = self._request("POST", f"{self.sms_path}/messages", json={"to": to, "body": body})
        return {
            "message_id": resp.get("message_id"),
            "status": resp.get("status", "queued"),
            "raw": resp,
        }

    # ---- Webhook --------------------------------------------------------

    def verify_webhook(self, headers, raw_body):
        if not self.secret:
            # Dev/no-secret mode: accept everything. Production should set the secret.
            return True
        sig = headers.get("X-Enablex-Signature") or headers.get("x-enablex-signature")
        if not sig:
            return False
        expected = hmac.new(self.secret.encode(), raw_body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(sig, expected)

    def parse_webhook_event(self, payload):
        """Normalize EnableX video + voice webhook payloads.

        Voice webhooks (single event_url) carry: voice_id, state
        ("ringing" | "connected" | "disconnected"), from, to, timestamp.
        Video webhooks carry an `event` or `type` field.
        """
        etype = (payload.get("event") or payload.get("type") or "").lower()
        # Voice payloads use `state` instead of `event`/`type`
        state = (payload.get("state") or "").lower()

        if state and not etype:
            state_map = {
                "ringing": "call.ringing",
                "connected": "session.started",
                "disconnected": "session.ended",
            }
            normalized = state_map.get(state, state)
        else:
            mapping = {
                "room.started": "session.started",
                "session.started": "session.started",
                "room.ended": "session.ended",
                "session.ended": "session.ended",
                "recording.available": "recording.ready",
                "recording.ready": "recording.ready",
                "call.ringing": "call.ringing",
                "call.in_progress": "session.started",
                "call.completed": "session.ended",
                "message.delivered": "message.delivered",
                "message.failed": "message.failed",
            }
            normalized = mapping.get(etype, etype)

        return {
            "event_type": normalized,
            "vendor_session_id": (
                payload.get("voice_id")
                or payload.get("room_id")
                or payload.get("call_id")
                or (payload.get("data") or {}).get("room_id")
            ),
            "data": payload.get("data", payload),
            "occurred_at": payload.get("timestamp"),
        }
