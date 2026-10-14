# Database Plan — Teleconsult

## Tables

### `tele_sessions`

```sql
CREATE TABLE tele_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    patient_id          UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    provider_id         UUID REFERENCES healthcare_providers(id) ON DELETE SET NULL,
    linked_visit_id     UUID REFERENCES patient_visits(id) ON DELETE SET NULL,
    created_by          UUID REFERENCES users(id) ON DELETE SET NULL,

    channel             VARCHAR(16)  NOT NULL,      -- 'voice' | 'video'
    provider_vendor     VARCHAR(16)  NOT NULL DEFAULT 'enablex',  -- 'enablex' | 'exotel'

    vendor_session_id   VARCHAR(128) UNIQUE,        -- room_id (video) | call_sid (voice)
    vendor_room_name    VARCHAR(255),

    moderator_token     TEXT,
    participant_token   TEXT,
    moderator_join_url  TEXT,
    participant_join_url TEXT,

    status              VARCHAR(32)  NOT NULL DEFAULT 'scheduled',
    -- scheduled | ringing | in_progress | completed | failed | missed | cancelled

    scheduled_at        TIMESTAMP WITH TIME ZONE,
    started_at          TIMESTAMP WITH TIME ZONE,
    ended_at            TIMESTAMP WITH TIME ZONE,
    duration_seconds    INTEGER,

    record_call         BOOLEAN NOT NULL DEFAULT FALSE,
    recording_url       TEXT,
    recording_id        VARCHAR(128),

    cancel_reason       TEXT,
    notes               TEXT,
    raw_payload         JSONB,

    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_tele_sessions_patient
    ON tele_sessions(patient_id, scheduled_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_tele_sessions_provider
    ON tele_sessions(provider_id, scheduled_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_tele_sessions_active
    ON tele_sessions(scheduled_at)
    WHERE status IN ('scheduled', 'ringing', 'in_progress')
      AND deleted_at IS NULL;

CREATE INDEX idx_tele_sessions_visit
    ON tele_sessions(linked_visit_id)
    WHERE linked_visit_id IS NOT NULL;
```

### `tele_notifications`

Doubles as a queue for the reminder scheduler.

```sql
CREATE TABLE tele_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    session_id          UUID NOT NULL REFERENCES tele_sessions(id) ON DELETE CASCADE,

    recipient_type      VARCHAR(16) NOT NULL,    -- 'patient' | 'provider'
    recipient_user_id   UUID,                    -- nullable; users.id or healthcare_providers.id
    recipient_email     VARCHAR(255),
    recipient_phone     VARCHAR(32),

    channel             VARCHAR(16) NOT NULL,    -- 'email' | 'whatsapp' | 'sms'
    template_key        VARCHAR(64) NOT NULL,    -- 'scheduled' | 'reminder_24h' | 'reminder_15min' | 'cancelled' | 'rescheduled' | 'join_link_resend'

    scheduled_for       TIMESTAMP WITH TIME ZONE NOT NULL,
    sent_at             TIMESTAMP WITH TIME ZONE,

    status              VARCHAR(32) NOT NULL DEFAULT 'pending',
    -- pending | sent | failed | cancelled | skipped

    vendor_message_id   VARCHAR(128),
    error_message       TEXT,
    retry_count         INTEGER NOT NULL DEFAULT 0,
    raw_response        JSONB,

    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    UNIQUE (session_id, recipient_type, channel, template_key)
);

CREATE INDEX idx_tele_notif_due
    ON tele_notifications(scheduled_for)
    WHERE status = 'pending';

CREATE INDEX idx_tele_notif_session
    ON tele_notifications(session_id, recipient_type, channel);
```

The `UNIQUE` constraint guarantees idempotent enqueue: re-running `schedule(...)` on the same session won't create dupes.

## Migration

Filename: `<rev>_teleconsult_initial.py` (Alembic).

Use the project's existing Alembic conventions in `backend/migrations/versions/`. Naming follows `<6-char-rev>_<short_desc>.py`.

Up:
1. Create `tele_sessions`
2. Create `tele_notifications`
3. Create indexes (above)
4. Insert seed `system_settings` rows for teleconsult defaults

Down: drop in reverse order (no data preservation; this module is net-new).

## ORM models

### `TeleSession`

```python
# backend/app/teleconsult/models/tele_session.py
from sqlalchemy import Column, ForeignKey, DateTime, String, Text, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
from app.common.models import BaseModel


class TeleSession(BaseModel):
    __tablename__ = 'tele_sessions'

    patient_id          = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True)
    provider_id         = Column(UUID(as_uuid=True), ForeignKey('healthcare_providers.id', ondelete='SET NULL'), index=True)
    linked_visit_id     = Column(UUID(as_uuid=True), ForeignKey('patient_visits.id', ondelete='SET NULL'))
    created_by          = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'))

    channel             = Column(String(16), nullable=False)
    provider_vendor     = Column(String(16), nullable=False, default='enablex')

    vendor_session_id   = Column(String(128), unique=True, index=True)
    vendor_room_name    = Column(String(255))

    moderator_token     = Column(Text)
    participant_token   = Column(Text)
    moderator_join_url  = Column(Text)
    participant_join_url = Column(Text)

    status              = Column(String(32), nullable=False, default='scheduled')

    scheduled_at        = Column(DateTime(timezone=True))
    started_at          = Column(DateTime(timezone=True))
    ended_at            = Column(DateTime(timezone=True))
    duration_seconds    = Column(Integer)

    record_call         = Column(Boolean, nullable=False, default=False)
    recording_url       = Column(Text)
    recording_id        = Column(String(128))

    cancel_reason       = Column(Text)
    notes               = Column(Text)
    raw_payload         = Column(JSONB)

    deleted_at          = Column(DateTime(timezone=True))

    patient             = relationship('Patient', backref='tele_sessions')
    provider            = relationship('HealthcareProvider', backref='tele_sessions')
    visit               = relationship('PatientVisit', backref='tele_sessions')
    notifications       = relationship('TeleNotification', back_populates='session', cascade='all, delete-orphan')

    def to_dict(self):
        d = super().to_dict()
        for k in ('patient_id','provider_id','linked_visit_id','created_by'):
            d[k] = str(getattr(self, k)) if getattr(self, k) else None
        for k in ('scheduled_at','started_at','ended_at','deleted_at'):
            v = getattr(self, k)
            d[k] = v.isoformat() if v else None
        # Don't leak moderator token to non-owners; routes filter this.
        return d
```

### `TeleNotification`

```python
# backend/app/teleconsult/models/tele_notification.py
from sqlalchemy import Column, ForeignKey, DateTime, String, Text, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.common.models import BaseModel


class TeleNotification(BaseModel):
    __tablename__ = 'tele_notifications'
    __table_args__ = (
        UniqueConstraint('session_id', 'recipient_type', 'channel', 'template_key',
                         name='uq_tele_notif_dedup'),
    )

    session_id          = Column(UUID(as_uuid=True), ForeignKey('tele_sessions.id', ondelete='CASCADE'), nullable=False, index=True)

    recipient_type      = Column(String(16), nullable=False)
    recipient_user_id   = Column(UUID(as_uuid=True))
    recipient_email     = Column(String(255))
    recipient_phone     = Column(String(32))

    channel             = Column(String(16), nullable=False)
    template_key        = Column(String(64), nullable=False)

    scheduled_for       = Column(DateTime(timezone=True), nullable=False, index=True)
    sent_at             = Column(DateTime(timezone=True))

    status              = Column(String(32), nullable=False, default='pending')

    vendor_message_id   = Column(String(128))
    error_message       = Column(Text)
    retry_count         = Column(Integer, nullable=False, default=0)
    raw_response        = Column(JSONB)

    session             = relationship('TeleSession', back_populates='notifications')

    def to_dict(self):
        d = super().to_dict()
        d['session_id'] = str(self.session_id)
        if self.recipient_user_id:
            d['recipient_user_id'] = str(self.recipient_user_id)
        for k in ('scheduled_for','sent_at'):
            v = getattr(self, k)
            d[k] = v.isoformat() if v else None
        return d
```

## Visit-modal compatibility

Existing `patient_visits` table:
- `visit_type VARCHAR(30)` — currently allows `'initial' | 'follow_up' | 'emergency' | 'phone'`. **Add value `'teleconsult'`** in the data layer (no DB constraint exists; just a label change).
- `visit_location VARCHAR(50)` — add new allowed values `'video'`, `'voice'`. Old values `'opd'`, `'ipd'`, `'phone'` remain for legacy rows but are no longer offered in the UI.

No migration needed for `patient_visits` — the column is already free-form `VARCHAR`.

Backfill (optional, run as one-off SQL):
```sql
-- Move legacy phone-call visits onto the new model
UPDATE patient_visits
SET visit_type = 'teleconsult',
    visit_location = 'voice'
WHERE visit_type = 'phone';
```

Run only if Dr. Ashwini confirms — otherwise leave history untouched.

## Seed `system_settings`

```sql
INSERT INTO system_settings (key, value) VALUES
  ('teleconsult_enabled', 'true'),
  ('teleconsult_default_provider_vendor', 'enablex'),
  ('teleconsult_clinic_name', 'Saranam Palliative Care'),
  ('teleconsult_clinic_email', 'team@exatorial.com'),
  ('teleconsult_timezone', 'Asia/Kolkata'),
  ('teleconsult_reminder_24h_offset_min', '1440'),
  ('teleconsult_reminder_15m_offset_min', '15')
ON CONFLICT (key) DO NOTHING;
```

## Audit log

Reuse existing `audit_logs` table — no new schema. Entry shape:
```python
{
  "entity_type": "tele_session",
  "entity_id": "<uuid>",
  "action": "schedule" | "initiate_now" | "start" | "end" | "cancel"
            | "resend_link" | "fetch_recording" | "webhook_event",
  "actor_id": "<user uuid>",
  "metadata": {"channel": "video", "vendor": "enablex", "patient_id": "...", "provider_id": "..."}
}
```

## Data retention

- `tele_sessions` — keep forever (clinical record). Soft-delete via `deleted_at`.
- `tele_notifications` — purge `status IN ('sent','failed','cancelled')` AND `created_at < NOW() - 180 days` via nightly job (Phase 6).
- `recording_url` — recordings live in EnableX storage; we store URL only. EnableX retention follows their plan.
