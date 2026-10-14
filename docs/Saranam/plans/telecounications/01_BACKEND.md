# Backend Plan — Teleconsult

## Module layout

```
backend/app/teleconsult/
├── __init__.py                  # blueprint factory + scheduler registration
├── README.md
├── models/
│   ├── __init__.py
│   ├── tele_session.py          # TeleSession ORM
│   └── tele_notification.py     # TeleNotification ORM
├── services/
│   ├── __init__.py
│   ├── orchestrator.py          # SessionOrchestrator — single facade
│   ├── provider_registry.py     # picks adapter; encapsulates failover
│   ├── notifications.py         # NotificationService — dispatches via channel
│   ├── calendar_invite.py       # ICSGenerator
│   ├── reminder_scheduler.py    # APScheduler job for pending reminders
│   └── adapters/
│       ├── __init__.py
│       ├── base.py              # ProviderAdapter ABC
│       ├── enablex.py           # EnableXAdapter
│       ├── exotel.py            # ExotelAdapter (stub)
│       └── mock.py              # MockAdapter (tests + ENABLEX_MOCK=true)
├── routes/
│   ├── __init__.py
│   ├── sessions.py              # /api/teleconsult/sessions/*
│   ├── schedule.py              # /api/teleconsult/schedule/*
│   ├── webhooks.py              # /api/teleconsult/webhooks/*
│   └── providers.py             # /api/teleconsult/providers (list)
└── templates/
    ├── email/
    │   ├── teleconsult_scheduled.html
    │   ├── teleconsult_reminder_24h.html
    │   └── teleconsult_reminder_15min.html
    └── messages/
        ├── wa_scheduled.txt
        ├── wa_reminder_24h.txt
        ├── wa_reminder_15min.txt
        └── sms_*.txt            # SMS variants (shorter)
```

Blueprint factory pattern matches the existing `call_logs` and `saranam` modules in this repo.

## Service layer — `SessionOrchestrator` (single facade)

Routes call **only** this class — never adapters directly. Keeps mocking and provider-swap trivial.

```python
class SessionOrchestrator:

    @staticmethod
    def schedule(*, patient_id, provider_id, channel, scheduled_at,
                 record_call=False, notes=None, linked_visit_id=None,
                 created_by=None) -> TeleSession:
        """Create a scheduled session, fan out scheduling notifications +
        seed 24h and 15min reminders into tele_notifications queue."""

    @staticmethod
    def initiate_now(*, patient_id, provider_id, channel,
                     record_call=False, notes=None, created_by=None) -> TeleSession:
        """Ad-hoc 'Call Now' — creates room/call immediately, no future
        reminders, only an immediate join-link notification."""

    @staticmethod
    def start(session_id) -> TeleSession:
        """Move scheduled→in_progress; for video this is a no-op (room already
        exists); for voice this triggers the dial."""

    @staticmethod
    def end(session_id) -> TeleSession:
        """End the room/call; mark completed; cancel any pending reminders."""

    @staticmethod
    def cancel(session_id, reason=None) -> TeleSession:
        """Cancel scheduled session + all pending notifications."""

    @staticmethod
    def list_sessions(*, patient_id=None, provider_id=None, week_of=None,
                      status=None, channel=None, limit=100) -> list[TeleSession]:
        ...

    @staticmethod
    def fetch_recording(session_id) -> str | None:
        """Pulls latest recording URL via adapter, persists, returns URL."""

    @staticmethod
    def handle_webhook(vendor, headers, body) -> dict:
        """Verify signature, route to adapter parser, update session."""

    @staticmethod
    def resend_join_link(session_id, recipient='patient') -> bool:
        ...
```

### Internal flow on `schedule(...)`

1. Reserve resource on provider (create video room *now*, even though scheduled — gives a stable join URL):
   - For video: call `EnableXAdapter.create_video_room(...)` → store `vendor_session_id`, tokens, URLs.
   - For voice: just persist intent — actual `connect` API fires at start time.
2. Insert `tele_sessions` row (`status='scheduled'`).
3. Enqueue **6 notifications** in `tele_notifications`:
   | Recipient | Channel | Template | scheduled_for |
   |---|---|---|---|
   | provider | email + .ics | `scheduled` | NOW |
   | provider | whatsapp | `scheduled` | NOW |
   | patient  | whatsapp (or sms) | `scheduled` | NOW |
   | provider | whatsapp | `reminder_24h` | scheduled_at − 24h |
   | patient  | whatsapp (or sms) | `reminder_24h` | scheduled_at − 24h |
   | provider | whatsapp | `reminder_15min` | scheduled_at − 15min |
   | patient  | whatsapp (or sms) | `reminder_15min` | scheduled_at − 15min |
4. Reminder-scheduler picks them up at the right time.
5. Audit log entry.

### Internal flow on `initiate_now(...)`

1. Create video room / voice call **immediately**.
2. Insert `tele_sessions` row (`status='in_progress'`, `started_at=NOW`).
3. Enqueue **2 immediate notifications** (provider + patient, with join link).
4. No 24h / 15min reminders.
5. Frontend opens iframe / shows ringing UI.

## Provider abstraction — adapter ABC

See `05_PROVIDER_ADAPTERS.md` for the full contract. Routes/orchestrator depend only on the ABC; concrete implementations are dependency-injected via `ProviderRegistry.get(vendor, channel)`.

## Routes

All routes prefixed `/api/teleconsult`. All non-webhook routes `@jwt_required()`.

```
POST   /sessions/schedule              → orchestrator.schedule(...)
POST   /sessions/initiate-now          → orchestrator.initiate_now(...)
GET    /sessions                       → list (filters: patient_id, provider_id, week_of, status, channel)
GET    /sessions/this-week             → convenience: scheduled_at within current monday-sunday
GET    /sessions/:id                   → detail
POST   /sessions/:id/start             → start scheduled session
POST   /sessions/:id/end               → end
DELETE /sessions/:id                   → cancel + cancel pending notifications
POST   /sessions/:id/resend-link       → resend scheduling notification
GET    /sessions/:id/recording         → recording URL (lazy-fetched)

GET    /providers                      → list active HealthcareProviders for dropdown
                                         (proxy to existing providers_bp; thin wrapper for RBAC)

POST   /webhooks/enablex               → public; HMAC verified
POST   /webhooks/exotel                → public; placeholder (Phase 7)
```

## Webhook handler skeleton

```python
@webhooks_bp.route('/webhooks/enablex', methods=['POST'])
def enablex_webhook():
    raw = request.get_data()
    if not EnableXAdapter.verify_webhook(request.headers, raw):
        return ('', 401)
    payload = request.get_json(silent=True) or {}
    parsed = EnableXAdapter.parse_webhook_event(payload)
    SessionOrchestrator._apply_webhook_event(parsed)
    return ('', 204)
```

`parse_webhook_event` returns a normalized dict:
```python
{
    'event_type': 'session.started' | 'session.ended' | 'recording.ready' | 'message.delivered' | 'message.failed' | 'call.ringing' | ...,
    'vendor_session_id': '...',
    'data': { ... },
    'occurred_at': datetime
}
```

## Permissions / RBAC

- **clinical_admin / doctor / nurse** → can list / schedule / initiate / end
- **read-only** → list + view only
- **admin** → all + audit log access
- Implementation: existing `@require_role(...)` pattern. Add a tiny `_require_clinical()` helper in `routes/__init__.py`.

## Audit logging

Every state-changing action writes to existing `audit_log` table:
- `entity_type='tele_session'`
- `entity_id=session.id`
- `action ∈ {'schedule','initiate_now','start','end','cancel','resend_link','fetch_recording'}`
- `actor_id=current_user.id`
- `metadata={channel, vendor, provider_id, patient_id}`

## Reminder scheduler

Hooks into the existing APScheduler instance from `app/reminders/scheduler.py`. New job:

```python
def teleconsult_reminder_tick(app):
    """Runs every minute. Picks pending notifications whose scheduled_for <= NOW
    and dispatches them. Idempotent via tele_notifications.sent_at check."""
```

Registered in `init_scheduler(app)` alongside the existing appointment reminder job. See `04_NOTIFICATIONS.md` for the dispatch logic.

## Configuration loading

Reuses `reminders.scheduler.get_settings()` pattern — DB `system_settings` table first, env fallback. New settings keys:

| key | default | description |
|---|---|---|
| `teleconsult_enabled` | `true` | Master kill switch |
| `teleconsult_default_provider_vendor` | `enablex` | `enablex` or `exotel` |
| `teleconsult_clinic_name` | "Saranam Palliative Care" | Used in templates |
| `teleconsult_clinic_email` | env `TELECONSULT_CLINIC_EMAIL` | Organizer in .ics |
| `teleconsult_timezone` | `Asia/Kolkata` | iCal TZID |

## Blueprint registration

Add to `app/__init__.py`:
```python
from app.teleconsult.routes import teleconsult_bp
app.register_blueprint(teleconsult_bp, url_prefix='/api/teleconsult')

from app.teleconsult.services.reminder_scheduler import init_teleconsult_scheduler
init_teleconsult_scheduler(app)
```

Add to `app/models.py`:
```python
from app.teleconsult.models.tele_session import TeleSession
from app.teleconsult.models.tele_notification import TeleNotification
```

## Testing strategy

- Unit tests for `SessionOrchestrator` use `MockAdapter` (no network).
- Integration tests run against EnableX trial creds in CI (gated, opt-in).
- One end-to-end test: schedule → reminder fires → recording URL retrieved.

## What we deliberately do NOT build (out of scope v1)

- Recurring weekly schedules (one-shot only)
- Provider availability calendar / conflict detection
- Multi-participant rooms (caregiver + patient + doctor) — single moderator + single participant only
- Patient-side mobile app — patient joins via web link
- Call-quality analytics / dashboards (later phase)
