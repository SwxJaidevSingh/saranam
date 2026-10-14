# Provider Adapters Plan — Teleconsult

## Why an abstraction

We need to:
1. **Mock** the vendor in dev/CI (`ENABLEX_MOCK=true`) so we don't burn trial credits.
2. **Swap** EnableX↔Exotel per channel later without touching routes or orchestrator.
3. **Add** new vendors (Twilio, Plivo) in the future as one file.

Approach: thin **Adapter ABC** + a **Registry** that picks the implementation at runtime.

## ABC

```python
# backend/app/teleconsult/services/adapters/base.py
from abc import ABC, abstractmethod
from typing import Optional

class ProviderAdapter(ABC):
    name: str = ""                          # 'enablex' | 'exotel' | 'mock'
    supported_channels: set[str] = set()    # subset of {'video','voice','whatsapp','sms'}

    # ---- Video ----------------------------------------------------------
    @abstractmethod
    def create_video_room(self, *, name: str, settings: dict) -> dict:
        """Returns dict with at least: room_id, moderator_token,
        participant_token, moderator_url, participant_url, raw."""

    @abstractmethod
    def end_video_room(self, room_id: str) -> bool: ...

    @abstractmethod
    def fetch_recording(self, room_id: str) -> Optional[str]: ...

    # ---- Voice ----------------------------------------------------------
    @abstractmethod
    def initiate_voice_call(self, *, from_number: str, to_number: str,
                            caller_id: str, callback_url: str,
                            record: bool) -> dict:
        """Returns: call_id, status, raw."""

    @abstractmethod
    def end_voice_call(self, call_id: str) -> bool: ...

    # ---- WhatsApp / SMS -------------------------------------------------
    @abstractmethod
    def send_whatsapp(self, *, to: str, template_key: str, params: list) -> dict:
        """Returns: message_id, status, raw."""

    @abstractmethod
    def send_sms(self, *, to: str, body: str) -> dict: ...

    # ---- Webhook --------------------------------------------------------
    @abstractmethod
    def verify_webhook(self, headers: dict, raw_body: bytes) -> bool: ...

    @abstractmethod
    def parse_webhook_event(self, payload: dict) -> dict:
        """Returns normalized: {event_type, vendor_session_id, data, occurred_at}."""
```

Each method returns a uniform dict so callers don't care which vendor returned what.

## EnableXAdapter

```python
# backend/app/teleconsult/services/adapters/enablex.py
import os, json, hmac, hashlib, requests
from requests.auth import HTTPBasicAuth
from .base import ProviderAdapter

class EnableXAdapter(ProviderAdapter):
    name = 'enablex'
    supported_channels = {'video', 'voice', 'whatsapp', 'sms'}

    def __init__(self):
        self.app_id     = os.getenv('ENABLEX_APP_ID')
        self.app_key    = os.getenv('ENABLEX_APP_KEY')
        self.base       = os.getenv('ENABLEX_BASE_URL', 'https://api.enablex.io')
        self.video_path = os.getenv('ENABLEX_VIDEO_PATH', '/video/v1')
        self.voice_path = os.getenv('ENABLEX_VOICE_PATH', '/voice/v1')
        self.wa_path    = os.getenv('ENABLEX_WA_PATH', '/whatsapp/v1')
        self.sms_path   = os.getenv('ENABLEX_SMS_PATH', '/sms/v1')
        self.toolkit    = os.getenv('ENABLEX_TOOLKIT_URL', 'https://video.enablex.io')
        self.secret     = os.getenv('ENABLEX_WEBHOOK_SECRET')

    # ---- helpers -----
    def _auth(self):
        if not self.app_id or not self.app_key:
            raise RuntimeError('ENABLEX_APP_ID / ENABLEX_APP_KEY missing')
        return HTTPBasicAuth(self.app_id, self.app_key)

    def _post(self, path, **kwargs):
        r = requests.post(f"{self.base}{path}", auth=self._auth(), timeout=15, **kwargs)
        r.raise_for_status()
        return r.json()

    # ---- VIDEO -------
    def create_video_room(self, *, name, settings):
        body = {
            'name': name,
            'owner_ref': settings.get('owner_ref', 'system'),
            'settings': {
                'quality': 'HD',
                'auto_recording': bool(settings.get('record', False)),
                'duration': int(settings.get('duration_minutes', 30)),
            },
            'sip': {'enabled': False},
            'data': settings.get('metadata', {}),
        }
        resp = self._post(f"{self.video_path}/rooms", json=body)
        room = (resp or {}).get('room') or resp
        room_id = room.get('room_id') or room.get('id')

        mod  = self._issue_token(room_id, role='moderator',  name=settings.get('moderator_name', 'Doctor'))
        part = self._issue_token(room_id, role='participant', name=settings.get('participant_name', 'Patient'))
        return {
            'room_id': room_id,
            'moderator_token':   mod.get('token'),
            'participant_token': part.get('token'),
            'moderator_url':   self._toolkit_url(mod.get('token')),
            'participant_url': self._toolkit_url(part.get('token')),
            'raw': resp,
        }

    def _issue_token(self, room_id, *, role, name):
        return self._post(f"{self.video_path}/rooms/{room_id}/tokens",
                          json={'name': name, 'role': role})

    def _toolkit_url(self, token):
        return f"{self.toolkit}/?token={token}" if token else None

    def end_video_room(self, room_id):
        try:
            requests.delete(f"{self.base}{self.video_path}/rooms/{room_id}",
                            auth=self._auth(), timeout=10)
            return True
        except requests.RequestException:
            return False

    def fetch_recording(self, room_id):
        try:
            r = requests.get(f"{self.base}{self.video_path}/rooms/{room_id}/recordings",
                             auth=self._auth(), timeout=15)
            r.raise_for_status()
            recs = r.json().get('recordings') or []
            return recs[0]['url'] if recs else None
        except requests.RequestException:
            return None

    # ---- VOICE -------
    def initiate_voice_call(self, *, from_number, to_number, caller_id, callback_url, record):
        # NOTE: EnableX Voice API path/payload should be verified against their docs at
        # https://developer.enablex.io/docs/voice — placeholder shape below.
        body = {
            'from': from_number,
            'to': to_number,
            'caller_id': caller_id,
            'record': bool(record),
            'callback_url': callback_url,
        }
        resp = self._post(f"{self.voice_path}/calls", json=body)
        return {
            'call_id': resp.get('call_id') or resp.get('id'),
            'status':  resp.get('status', 'initiated'),
            'raw':     resp,
        }

    def end_voice_call(self, call_id):
        try:
            requests.delete(f"{self.base}{self.voice_path}/calls/{call_id}",
                            auth=self._auth(), timeout=10)
            return True
        except requests.RequestException:
            return False

    # ---- WhatsApp -------
    def send_whatsapp(self, *, to, template_key, params):
        body = {
            'to': to,
            'template': template_key,
            'language': 'en',
            'components': [{'type': 'body', 'parameters': [
                {'type': 'text', 'text': str(p)} for p in params
            ]}],
        }
        resp = self._post(f"{self.wa_path}/messages", json=body)
        return {
            'message_id': resp.get('message_id') or resp.get('id'),
            'status':     resp.get('status', 'queued'),
            'raw':        resp,
        }

    # ---- SMS -------
    def send_sms(self, *, to, body):
        resp = self._post(f"{self.sms_path}/messages",
                          json={'to': to, 'body': body})
        return {'message_id': resp.get('message_id'), 'status': resp.get('status'), 'raw': resp}

    # ---- Webhook -------
    def verify_webhook(self, headers, raw_body):
        if not self.secret:
            return True   # dev: accept anything; prod: enforce
        sig = headers.get('X-Enablex-Signature') or headers.get('x-enablex-signature')
        if not sig:
            return False
        expected = hmac.new(self.secret.encode(), raw_body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(sig, expected)

    def parse_webhook_event(self, payload):
        etype = (payload.get('event') or payload.get('type') or '').lower()
        mapping = {
            'room.started':       'session.started',
            'session.started':    'session.started',
            'room.ended':         'session.ended',
            'session.ended':      'session.ended',
            'recording.available':'recording.ready',
            'recording.ready':    'recording.ready',
            'call.ringing':       'call.ringing',
            'call.completed':     'session.ended',
            'message.delivered':  'message.delivered',
            'message.failed':     'message.failed',
        }
        return {
            'event_type': mapping.get(etype, etype),
            'vendor_session_id': payload.get('room_id') or payload.get('call_id') or
                                 (payload.get('data') or {}).get('room_id'),
            'data': payload.get('data', payload),
            'occurred_at': payload.get('timestamp'),
        }
```

## ExotelAdapter (stub, Phase 7)

```python
# backend/app/teleconsult/services/adapters/exotel.py
class ExotelAdapter(ProviderAdapter):
    name = 'exotel'
    supported_channels = {'voice', 'sms', 'whatsapp'}   # no video

    # All methods raise NotImplementedError until Phase 7.
    # Voice impl will mirror existing app/call_logs/service.py but cleaner:
    #   - https://api.exotel.com/v1/Accounts/{SID}/Calls/connect.json
    #   - Adds Record=true, RecordingChannels=dual, StatusCallback=<webhook>
    #   - Auth: HTTPBasicAuth(API_KEY, API_TOKEN)
    ...
```

## MockAdapter

Always returns deterministic fake data. Used when `ENABLEX_MOCK=true` or in unit tests.

```python
class MockAdapter(ProviderAdapter):
    name = 'mock'
    supported_channels = {'video', 'voice', 'whatsapp', 'sms'}

    def create_video_room(self, *, name, settings):
        rid = f"mock-{uuid.uuid4().hex[:12]}"
        return {
            'room_id': rid,
            'moderator_token':   f'mod-{rid}',
            'participant_token': f'part-{rid}',
            'moderator_url':   f'https://example.test/mock?t=mod-{rid}',
            'participant_url': f'https://example.test/mock?t=part-{rid}',
            'raw': {'mock': True},
        }
    # ... rest no-op or echo
```

## Registry

```python
# backend/app/teleconsult/services/provider_registry.py
class ProviderRegistry:
    _instances: dict[str, ProviderAdapter] = {}

    @classmethod
    def get(cls, vendor: str) -> ProviderAdapter:
        if vendor not in cls._instances:
            cls._instances[vendor] = cls._build(vendor)
        return cls._instances[vendor]

    @classmethod
    def _build(cls, vendor: str) -> ProviderAdapter:
        if os.getenv('ENABLEX_MOCK', 'false').lower() == 'true':
            return MockAdapter()
        if vendor == 'enablex':
            return EnableXAdapter()
        if vendor == 'exotel':
            return ExotelAdapter()
        raise ValueError(f'Unknown vendor: {vendor}')

    @classmethod
    def for_channel(cls, channel: str, preferred: str = 'enablex') -> ProviderAdapter:
        """Pick adapter for a channel, with fallback chain."""
        order = [preferred] + [v for v in ('enablex', 'exotel') if v != preferred]
        for vendor in order:
            adapter = cls.get(vendor)
            if channel in adapter.supported_channels:
                return adapter
        raise RuntimeError(f'No adapter supports channel: {channel}')
```

`SessionOrchestrator` always calls `ProviderRegistry.for_channel('video')` — registry decides whether it's EnableX, Exotel, or Mock.

## Failover (Phase 7)

Wrap orchestrator calls in a small retry-with-fallback helper:
```python
def _with_failover(channel, fn):
    primary   = ProviderRegistry.for_channel(channel, preferred='enablex')
    secondary = ProviderRegistry.get('exotel')
    try:
        return fn(primary)
    except VendorOutageError:
        if channel in secondary.supported_channels:
            return fn(secondary)
        raise
```

Define a `VendorOutageError` for transient 5xx / timeouts; do **not** failover on user errors (4xx) — those mean our payload is wrong.

## Webhook signature verification

EnableX docs to confirm header name + algorithm. Plan defaults to:
- Header: `X-Enablex-Signature`
- Algorithm: `HMAC-SHA256(body, ENABLEX_WEBHOOK_SECRET)`

If their actual scheme differs, change `EnableXAdapter.verify_webhook` only — registry/orchestrator unchanged.

## Adapter-level testing

- `tests/teleconsult/test_enablex_adapter.py` — mock `requests`, assert payloads
- `tests/teleconsult/test_mock_adapter.py` — sanity
- `tests/teleconsult/test_orchestrator.py` — wires `MockAdapter` via `ENABLEX_MOCK=true`, no network
- One opt-in integration test against trial creds, gated by `RUN_ENABLEX_LIVE=true`

## Future vendors

To add Twilio/Plivo/Vonage:
1. Drop a new adapter file in `services/adapters/`
2. Add to `ProviderRegistry._build`
3. No changes to routes / orchestrator / models
