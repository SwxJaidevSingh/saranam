"""ProviderRegistry — picks the right adapter at runtime.

ENABLEX_MOCK=true → MockAdapter for everything (dev / CI).
Otherwise: vendor name → concrete adapter.
"""
import os
from typing import Dict, Optional

from app.teleconsult.services.adapters.base import ProviderAdapter
from app.teleconsult.services.adapters.enablex import EnableXAdapter
from app.teleconsult.services.adapters.exotel import ExotelAdapter
from app.teleconsult.services.adapters.google_meet import GoogleMeetAdapter
from app.teleconsult.services.adapters.mock import MockAdapter
from app.teleconsult.services.adapters.twilio import TwilioAdapter


def _is_mock() -> bool:
    return os.getenv("ENABLEX_MOCK", "false").lower() in ("1", "true", "yes")


class ProviderRegistry:
    _instances: Dict[str, ProviderAdapter] = {}

    @classmethod
    def reset(cls):
        cls._instances = {}

    @classmethod
    def get(cls, vendor: str) -> ProviderAdapter:
        if vendor not in cls._instances:
            cls._instances[vendor] = cls._build(vendor)
        return cls._instances[vendor]

    @classmethod
    def _build(cls, vendor: str) -> ProviderAdapter:
        if _is_mock():
            return MockAdapter()
        if vendor == "enablex":
            return EnableXAdapter()
        if vendor == "exotel":
            return ExotelAdapter()
        if vendor == "twilio":
            return TwilioAdapter()
        if vendor == "google_meet":
            return GoogleMeetAdapter()
        if vendor == "mock":
            return MockAdapter()
        raise ValueError(f"Unknown vendor: {vendor}")

    @classmethod
    def for_channel(cls, channel: str, preferred: Optional[str] = None) -> ProviderAdapter:
        """Pick an adapter for a channel.

        Resolution order:
          1. explicit `preferred` arg
          2. TELECONSULT_VIDEO_PRIMARY env (video only)
          3. enablex (always-fallback)
          4. exotel
          5. google_meet (only if it supports the channel)
        """
        if preferred is None and channel == "video":
            preferred = os.getenv("TELECONSULT_VIDEO_PRIMARY", "enablex")
        if preferred is None and channel == "voice":
            preferred = os.getenv("TELECONSULT_VOICE_VENDOR", "enablex")
        if preferred is None:
            preferred = "enablex"
        candidates = [preferred] + [
            v for v in ("enablex", "twilio", "exotel", "google_meet") if v != preferred
        ]
        for vendor in candidates:
            try:
                adapter = cls.get(vendor)
            except ValueError:
                continue
            if channel in adapter.supported_channels:
                return adapter
        raise RuntimeError(f"No adapter supports channel: {channel}")
