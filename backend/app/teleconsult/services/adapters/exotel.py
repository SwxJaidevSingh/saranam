"""ExotelAdapter — fallback for voice / SMS / WhatsApp.

Stubbed in Phase 0. Full implementation in Phase 7 once Exotel KYC clears.
The clean rewrite will mirror app/call_logs/service.py but add:
  - Record=true, RecordingChannels=dual
  - StatusCallback wired to /api/teleconsult/webhooks/exotel
  - Proper status webhook receiver
"""
from typing import Optional
from app.teleconsult.services.adapters.base import ProviderAdapter


class ExotelAdapter(ProviderAdapter):
    name = "exotel"
    supported_channels = {"voice", "sms", "whatsapp"}  # no video

    def create_video_room(self, *, name, settings):
        raise NotImplementedError("Exotel does not provide video rooms")

    def end_video_room(self, room_id):
        raise NotImplementedError("Exotel does not provide video rooms")

    def fetch_recording(self, room_id):
        raise NotImplementedError("Exotel does not provide video rooms")

    def initiate_voice_call(self, *, from_number, to_number, caller_id, callback_url, record):
        raise NotImplementedError("Exotel adapter — Phase 7")

    def end_voice_call(self, call_id):
        raise NotImplementedError("Exotel adapter — Phase 7")

    def send_whatsapp(self, *, to, template_key, params):
        raise NotImplementedError("Exotel adapter — Phase 7")

    def send_sms(self, *, to, body):
        raise NotImplementedError("Exotel adapter — Phase 7")

    def verify_webhook(self, headers, raw_body):
        raise NotImplementedError("Exotel adapter — Phase 7")

    def parse_webhook_event(self, payload):
        raise NotImplementedError("Exotel adapter — Phase 7")
