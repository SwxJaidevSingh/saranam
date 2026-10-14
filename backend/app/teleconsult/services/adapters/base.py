"""Provider Adapter ABC.

Every adapter returns dicts in a uniform shape so the orchestrator and routes
never need vendor-specific logic. See docs/Saranam/plans/telecounications/05_PROVIDER_ADAPTERS.md.
"""
from abc import ABC, abstractmethod
from typing import Optional


class VendorOutageError(RuntimeError):
    """Raised on transient vendor failures (5xx, timeouts) so a failover can kick in."""


class ProviderAdapter(ABC):
    name: str = ""
    supported_channels: set = set()  # subset of {'video','voice','whatsapp','sms'}

    # ---- Video ----------------------------------------------------------
    @abstractmethod
    def create_video_room(self, *, name: str, settings: dict) -> dict:
        """Returns {room_id, moderator_token, participant_token,
        moderator_url, participant_url, raw}."""

    @abstractmethod
    def end_video_room(self, room_id: str) -> bool:
        ...

    @abstractmethod
    def fetch_recording(self, room_id: str) -> Optional[str]:
        ...

    # ---- Voice ----------------------------------------------------------
    @abstractmethod
    def initiate_voice_call(
        self,
        *,
        from_number: str,
        to_number: str,
        caller_id: str,
        callback_url: str,
        record: bool,
    ) -> dict:
        """Returns {call_id, status, raw}."""

    @abstractmethod
    def end_voice_call(self, call_id: str) -> bool:
        ...

    # ---- WhatsApp / SMS -------------------------------------------------
    @abstractmethod
    def send_whatsapp(self, *, to: str, template_key: str, params: list) -> dict:
        """Returns {message_id, status, raw}."""

    @abstractmethod
    def send_sms(self, *, to: str, body: str) -> dict:
        ...

    # ---- Webhook --------------------------------------------------------
    @abstractmethod
    def verify_webhook(self, headers: dict, raw_body: bytes) -> bool:
        ...

    @abstractmethod
    def parse_webhook_event(self, payload: dict) -> dict:
        """Returns normalized: {event_type, vendor_session_id, data, occurred_at}."""
