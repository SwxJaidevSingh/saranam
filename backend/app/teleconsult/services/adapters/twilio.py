"""TwilioAdapter — outbound voice (bridge-on-connect) for the demo.

Used when TELECONSULT_VOICE_VENDOR=twilio. Runs alongside EnableX; flip the
env flag to switch back. Trial accounts work as long as both the patient's
and doctor's numbers are added under Console → Phone Numbers → Verified
Caller IDs.

Bridge flow:
  1. POST /Calls with To=patient, From=twilio_number, Url=<our TwiML endpoint>.
  2. Twilio rings the patient. When they answer, Twilio fetches Url.
  3. Our TwiML endpoint returns <Dial>doctor_phone</Dial> — Twilio dials the
     doctor and bridges the two legs.
  4. Status callbacks (initiated/ringing/answered/completed) flow into the
     existing teleconsult webhook so the UI sees the same lifecycle as
     EnableX.

Docs:
  https://www.twilio.com/docs/voice/api/call-resource
  https://www.twilio.com/docs/voice/twiml/dial
"""
import os
from typing import Optional

import requests
from requests.auth import HTTPBasicAuth

from app.teleconsult.services.adapters.base import ProviderAdapter, VendorOutageError


class TwilioAdapter(ProviderAdapter):
    name = "twilio"
    supported_channels = {"voice"}

    def __init__(self):
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.from_number = os.getenv("TWILIO_FROM_NUMBER")
        self.base = "https://api.twilio.com/2010-04-01"

    # ---- helpers --------------------------------------------------------

    def _auth(self):
        if not self.account_sid or not self.auth_token:
            raise RuntimeError("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN missing")
        return HTTPBasicAuth(self.account_sid, self.auth_token)

    def _request(self, method, path, **kwargs):
        url = f"{self.base}{path}"
        try:
            r = requests.request(method, url, auth=self._auth(), timeout=15, **kwargs)
        except requests.Timeout as e:
            raise VendorOutageError(f"Twilio timeout on {method} {path}") from e
        except requests.ConnectionError as e:
            raise VendorOutageError(f"Twilio connection error on {method} {path}") from e

        if 500 <= r.status_code < 600:
            raise VendorOutageError(f"Twilio 5xx on {method} {path}: {r.status_code}")
        if r.status_code >= 400:
            try:
                err = r.json()
            except ValueError:
                err = {"raw": r.text[:300]}
            raise requests.HTTPError(
                f"Twilio {method} {path} → {r.status_code}: {err}",
                response=r,
            )
        if r.status_code == 204 or not r.content:
            return {}
        try:
            return r.json()
        except ValueError:
            return {"raw": r.text}

    # ---- VOICE ----------------------------------------------------------

    def initiate_voice_call(self, *, from_number, to_number, caller_id, callback_url, record):
        """Twilio outbound call — leg-1 rings the patient; on answer Twilio
        fetches our TwiML endpoint which dials the doctor and bridges.

        `callback_url` is the public base URL for our teleconsult webhooks
        (without the /event suffix). We derive both the TwiML URL (which
        Twilio fetches on answer) and the StatusCallback URL from it.
        `from_number` (doctor) is appended as a query param to the TwiML
        URL so the endpoint knows who to dial.
        """
        if not self.from_number:
            raise RuntimeError("TWILIO_FROM_NUMBER missing")

        # `callback_url` from the orchestrator looks like
        # "<base>/api/teleconsult/webhooks/enablex/event" (legacy naming).
        # Strip back to the base + build twilio-specific paths.
        base = callback_url.rsplit("/api/teleconsult/", 1)[0] if callback_url else ""
        if not base:
            raise RuntimeError("PUBLIC_BASE_URL missing — Twilio needs a public TwiML URL")

        # `from_number` is the doctor (leg-2 / bridge target); `to_number`
        # is the patient (leg-1, rung first by Twilio).
        from urllib.parse import quote
        twiml_url = (
            f"{base}/api/teleconsult/webhooks/twilio/twiml"
            f"?bridge_to={quote(str(from_number))}"
        )
        status_url = f"{base}/api/teleconsult/webhooks/twilio/status"

        body = {
            "To": str(to_number),
            "From": str(self.from_number),
            "Url": twiml_url,
            "StatusCallback": status_url,
            "StatusCallbackEvent": ["initiated", "ringing", "answered", "completed"],
            "StatusCallbackMethod": "POST",
            "Record": "true" if record else "false",
        }
        path = f"/Accounts/{self.account_sid}/Calls.json"
        print(
            f"[teleconsult/twilio] outbound call — to(patient)={body['To']} "
            f"from(twilio)={body['From']} bridge_to(doctor)={from_number}"
        )
        # Twilio expects form-encoded, repeating the StatusCallbackEvent key
        # for each value. requests handles this when the value is a list.
        resp = self._request("POST", path, data=body)
        print(f"[teleconsult/twilio] response sid={resp.get('sid')} status={resp.get('status')}")
        return {
            "call_id": resp.get("sid"),
            "status": resp.get("status", "queued"),
            "raw": resp,
        }

    def end_voice_call(self, call_id):
        if not call_id:
            return False
        try:
            self._request(
                "POST",
                f"/Accounts/{self.account_sid}/Calls/{call_id}.json",
                data={"Status": "completed"},
            )
            return True
        except (requests.RequestException, VendorOutageError):
            return False

    # ---- Webhook --------------------------------------------------------

    def verify_webhook(self, headers, raw_body):
        # Twilio signs requests via X-Twilio-Signature; for a demo trial we
        # accept all. For production, validate with twilio.request_validator.
        return True

    def parse_webhook_event(self, payload):
        """Twilio status callbacks send form-encoded fields:
        CallSid, CallStatus, From, To, Direction, Timestamp, etc.
        """
        status = (payload.get("CallStatus") or "").lower()
        mapping = {
            "queued": "call.ringing",
            "initiated": "call.ringing",
            "ringing": "call.ringing",
            "in-progress": "session.started",
            "answered": "session.started",
            "completed": "session.ended",
            "busy": "session.ended",
            "no-answer": "session.ended",
            "failed": "call.failed",
            "canceled": "session.ended",
        }
        return {
            "event_type": mapping.get(status, status),
            "vendor_session_id": payload.get("CallSid"),
            "data": dict(payload),
            "occurred_at": payload.get("Timestamp"),
        }

    # ---- Unsupported channels ------------------------------------------

    def create_video_room(self, *, name, settings):
        raise NotImplementedError("Twilio adapter is voice-only in this app")

    def end_video_room(self, room_id):
        return False

    def fetch_recording(self, room_id):
        return None

    def send_whatsapp(self, *, to, template_key, params):
        raise NotImplementedError("Twilio adapter is voice-only in this app")

    def send_sms(self, *, to, body):
        raise NotImplementedError("Twilio adapter is voice-only in this app")
