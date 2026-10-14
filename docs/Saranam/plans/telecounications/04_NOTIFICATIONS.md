# Notifications & Reminders Plan — Teleconsult

## Goals

For every scheduled teleconsult, fan out:

| Recipient | Channel | When |
|---|---|---|
| Provider | Email + .ics calendar invite | Immediately on schedule |
| Provider | WhatsApp | Immediately + 24h before + 15min before |
| Patient | WhatsApp (or SMS fallback) | Immediately + 24h before + 15min before |
| Patient | Email *(optional)* | Immediately, only if patient has email on file |

For ad-hoc "Call Now": just one immediate notification per recipient (no reminders).

## Architecture

```
SessionOrchestrator.schedule(...)
   │
   ├─→ inserts 6–8 rows into tele_notifications (status=pending)
   │
   └─→ (no immediate send; the "send-now" rows have scheduled_for = NOW
        and the next reminder-tick picks them up within ≤60s)

ReminderScheduler.tick()  (APScheduler, every 60s)
   │
   ├─→ SELECT * FROM tele_notifications
   │     WHERE status='pending' AND scheduled_for <= NOW()
   │     LIMIT 50
   │
   └─→ for each row:
        NotificationService.dispatch(row)
          ├─ email    → EmailService (existing) + ICSGenerator
          ├─ whatsapp → EnableXAdapter.send_whatsapp(...)
          └─ sms      → EnableXAdapter.send_sms(...)
```

The `scheduled_for = NOW()` row is the immediate "you've been scheduled" message. The 24h and 15min rows have `scheduled_for = scheduled_at − offset`. One uniform pipeline.

## Templates

### Email — `teleconsult_scheduled.html`

Variables: `clinic_name`, `provider_name`, `patient_name`, `patient_uhid`, `scheduled_at_local`, `channel_label`, `join_url`, `notes`, `cancel_url`.

```
Subject: Teleconsult scheduled — {{patient_name}} on {{scheduled_at_local}}

Dear Dr. {{provider_name}},

A {{channel_label}} teleconsult has been scheduled.

Patient:    {{patient_name}} (UHID {{patient_uhid}})
When:       {{scheduled_at_local}} (Asia/Kolkata)
Channel:    {{channel_label}}
Notes:      {{notes}}

Join link:  {{join_url}}
Cancel:     {{cancel_url}}

A calendar invite is attached.

— {{clinic_name}}
```

Attachment: `event.ics` (see ICSGenerator below).

### Email — `teleconsult_reminder_24h.html` / `teleconsult_reminder_15min.html`

Same vars, shorter copy:
```
Subject: Reminder — teleconsult tomorrow / in 15 min

Dr. {{provider_name}}, your teleconsult with {{patient_name}}
starts at {{scheduled_at_local}}.

Join: {{join_url}}
```

### WhatsApp — `wa_scheduled.txt` (template registered with Meta)

WhatsApp Business templates are pre-approved. Body (placeholders are positional):

```
Hi {{1}}, your teleconsult with {{2}} is scheduled for {{3}}.
Join here: {{4}}
— Saranam Palliative Care
```

Three template variants needed:
- `teleconsult_scheduled` — placeholders 1=name, 2=other_party, 3=time, 4=link
- `teleconsult_reminder_24h` — same shape, "tomorrow at..." copy
- `teleconsult_reminder_15min` — same shape, "in 15 minutes..." copy

Submit all three to Meta on Day 1 (Phase 0). Approval typically 24–48h.

### SMS — `sms_*.txt` (fallback when no WA)

Single-line:
```
Saranam: Teleconsult with {provider} on {time}. Join: {short_url} -Saranam
```

Use `tinyurl` or our own short-link service for the URL — SMS char limit.

## ICSGenerator

```python
# backend/app/teleconsult/services/calendar_invite.py
from datetime import datetime, timedelta
import uuid

def build_ics(*, session, clinic_name, clinic_email,
              provider_email, provider_name, patient_name, tz='Asia/Kolkata') -> bytes:
    """Returns bytes of an iCal VEVENT with VALARMs at 24h and 15min."""
    uid = f"teleconsult-{session.id}@saranam"
    dtstart = session.scheduled_at  # tz-aware UTC stored, render w/ TZID
    dtend   = dtstart + timedelta(minutes=30)  # default 30min slot

    ics = f"""BEGIN:VCALENDAR
PRODID:-//Saranam Palliative Care//Teleconsult//EN
VERSION:2.0
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VTIMEZONE
TZID:{tz}
END:VTIMEZONE
BEGIN:VEVENT
UID:{uid}
DTSTAMP:{datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}
DTSTART;TZID={tz}:{dtstart.astimezone().strftime('%Y%m%dT%H%M%S')}
DTEND;TZID={tz}:{dtend.astimezone().strftime('%Y%m%dT%H%M%S')}
SUMMARY:Teleconsult — {patient_name}
DESCRIPTION:{session.channel.title()} consultation. Join: {session.moderator_join_url}
URL:{session.moderator_join_url}
LOCATION:Online ({session.channel})
ORGANIZER;CN={clinic_name}:mailto:{clinic_email}
ATTENDEE;CN={provider_name};RSVP=TRUE:mailto:{provider_email}
STATUS:CONFIRMED
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:Teleconsult tomorrow with {patient_name}
TRIGGER:-PT24H
END:VALARM
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:Teleconsult starting in 15 minutes
TRIGGER:-PT15M
END:VALARM
END:VEVENT
END:VCALENDAR
""".replace('\n', '\r\n')   # iCal must be CRLF
    return ics.encode('utf-8')
```

Notes:
- Google Calendar respects `VALARM` blocks → users get *native* Google Calendar reminders at 24h and 15min, **independent of our APScheduler**. So even if our scheduler skips a tick, the calendar will still notify.
- Our APScheduler-driven WA reminders are a *belt-and-suspenders* second layer.
- Outlook also honours VALARM. Mobile Calendar apps mostly do.

## NotificationService

```python
# backend/app/teleconsult/services/notifications.py
class NotificationService:

    @staticmethod
    def dispatch(notification: TeleNotification) -> None:
        """Render template + send via the right channel + update status."""
        try:
            ctx = NotificationService._build_context(notification)
            if notification.channel == 'email':
                rendered = render_template(f'email/teleconsult_{notification.template_key}.html', **ctx)
                attachments = []
                if notification.template_key == 'scheduled' and notification.recipient_type == 'provider':
                    ics = build_ics(...)
                    attachments.append(('event.ics', ics, 'text/calendar; method=REQUEST'))
                EmailService.send(
                    to_email=notification.recipient_email,
                    subject=ctx['subject'],
                    body_html=rendered,
                    attachments=attachments,
                    settings=get_settings(),
                )
            elif notification.channel == 'whatsapp':
                EnableXAdapter.send_whatsapp(
                    to=notification.recipient_phone,
                    template_key=f'teleconsult_{notification.template_key}',
                    params=NotificationService._wa_params(notification, ctx),
                )
            elif notification.channel == 'sms':
                body = render_template(f'messages/sms_{notification.template_key}.txt', **ctx)
                EnableXAdapter.send_sms(to=notification.recipient_phone, body=body)

            notification.status = 'sent'
            notification.sent_at = datetime.utcnow()
        except Exception as e:
            notification.status = 'failed' if notification.retry_count >= 3 else 'pending'
            notification.retry_count += 1
            notification.error_message = str(e)[:1000]
        finally:
            db.session.commit()
```

## Reminder scheduler tick

```python
# backend/app/teleconsult/services/reminder_scheduler.py
def teleconsult_reminder_tick(app):
    with app.app_context():
        rows = (TeleNotification.query
                .filter(TeleNotification.status == 'pending')
                .filter(TeleNotification.scheduled_for <= datetime.utcnow())
                .order_by(TeleNotification.scheduled_for.asc())
                .limit(50)
                .all())
        for row in rows:
            NotificationService.dispatch(row)


def init_teleconsult_scheduler(app):
    """Add a 60s job to the existing APScheduler instance."""
    from app.reminders.scheduler import _scheduler   # existing singleton
    _scheduler.add_job(
        func=lambda: teleconsult_reminder_tick(app),
        trigger='interval',
        seconds=60,
        id='teleconsult_reminder_tick',
        replace_existing=True,
    )
```

## Patient channel-preference logic

```python
def _patient_message_channel(patient) -> str:
    """Decide WhatsApp vs SMS for a given patient."""
    if patient.prefer_sms_only:        # opt-out flag (add column or system_setting)
        return 'sms'
    if not patient.phone:
        return None
    return 'whatsapp'                  # default; EnableX will fail-over inside if no WA registered
```

If WhatsApp send fails with "recipient not on WhatsApp", the dispatcher schedules an SMS retry on the same row (template_key=same, channel=sms) and marks the WA row `failed`.

## Cancellation flow

When `SessionOrchestrator.cancel(...)`:
```python
# 1. mark session cancelled
# 2. cancel pending notifications
TeleNotification.query.filter_by(session_id=session.id, status='pending')\
    .update({'status': 'cancelled', 'updated_at': datetime.utcnow()})
# 3. enqueue ONE 'cancellation' notification per recipient × channel
# 4. provider also gets an updated .ics with METHOD:CANCEL  (so calendar removes the event)
```

The cancel `.ics` looks the same but with `METHOD:CANCEL` and `STATUS:CANCELLED` — Google Calendar / Outlook auto-remove the event on receipt.

## Reschedule flow

Reschedule = cancel + create new session, OR mutate existing:
- v1: simple — cancel old, create new (sends fresh notifications)
- v2: in-place mutate, send `METHOD:REQUEST` ics with same UID → calendar updates

v1 ships now.

## Observability

- Every dispatch attempt logs to `tele_notifications.raw_response` (full vendor response).
- Errors bubble up to existing app-level error tracking.
- Add a simple admin page in Phase 6: `/admin/teleconsult/notifications` showing failure counts in last 24h.

## What we deliberately do NOT do (v1)

- Voice-call OTP / IVR pre-greetings (Phase 5)
- In-app push notifications (no PWA yet)
- Multi-language templates (English only; client can add Kannada/Hindi later)
- Provider DND / quiet-hours (no in-band silencing — they choose to be on-call)
