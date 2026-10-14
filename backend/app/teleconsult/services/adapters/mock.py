"""MockAdapter — used when ENABLEX_MOCK=true or in unit tests.

Always returns deterministic fake data; never makes network calls.
"""
import uuid
from typing import Optional
from datetime import datetime

from app.teleconsult.services.adapters.base import ProviderAdapter


class MockAdapter(ProviderAdapter):
    name = "mock"
    supported_channels = {"video", "voice", "whatsapp", "sms"}

    def create_video_room(self, *, name, settings):
        rid = f"mock-{uuid.uuid4().hex[:12]}"
        return {
            "room_id": rid,
            "moderator_token": f"mod-{rid}",
            "participant_token": f"part-{rid}",
            "moderator_url": f"https://example.test/mock/?token=mod-{rid}",
            "participant_url": f"https://example.test/mock/?token=part-{rid}",
            "raw": {"mock": True, "name": name, "settings": settings},
        }

    def end_video_room(self, room_id):
        return True

    def fetch_recording(self, room_id):
        return f"https://example.test/mock-recordings/{room_id}.mp4"

    def initiate_voice_call(self, *, from_number, to_number, caller_id, callback_url, record):
        cid = f"mock-call-{uuid.uuid4().hex[:12]}"
        return {"call_id": cid, "status": "initiated", "raw": {"mock": True}}

    def end_voice_call(self, call_id):
        return True

    def send_whatsapp(self, *, to, template_key, params):
        mid = f"mock-wa-{uuid.uuid4().hex[:12]}"
        return {"message_id": mid, "status": "queued", "raw": {"mock": True}}

    def send_sms(self, *, to, body):
        mid = f"mock-sms-{uuid.uuid4().hex[:12]}"
        return {"message_id": mid, "status": "queued", "raw": {"mock": True}}

    def verify_webhook(self, headers, raw_body):
        return True

    def parse_webhook_event(self, payload):
        return {
            "event_type": payload.get("event", "unknown"),
            "vendor_session_id": payload.get("room_id") or payload.get("call_id"),
            "data": payload,
            "occurred_at": payload.get("timestamp", datetime.utcnow().isoformat()),
        }
