# Teleconsult — Setup & Operations

This is the runbook for getting Phases 0–4 fully live. Phases 0–4 are
implemented in code; the items below are operational settings that the
platform admin (you) need to configure outside the code.

---

## 1. Environment variables

Already set in `backend/.env` (project: **dev-saranam**):

```env
ENABLEX_APP_ID=69f1362d5132e46f4f015323
ENABLEX_APP_KEY=bara5yWaVeZe2yTytatuJaDumuSyQe6u7e9e
ENABLEX_VOICE_CALLER_ID=911169040030     # virtual number on the dev-saranam project
ENABLEX_BASE_URL=https://api.enablex.io
ENABLEX_TOOLKIT_URL=https://video.enablex.io
ENABLEX_WEBHOOK_SECRET=
ENABLEX_MOCK=false
TELECONSULT_TIMEZONE=Asia/Kolkata
TELECONSULT_CLINIC_NAME=Saranam Palliative Care
TELECONSULT_CLINIC_EMAIL=team@exatorial.com
```

To enable the **reminder dispatcher** (drains pending notifications every minute):

```env
SCHEDULER_ENABLED=true
TELECONSULT_TICK_INTERVAL_SECONDS=60
```

To run **without burning EnableX credits** in dev:

```env
ENABLEX_MOCK=true
```

---

## 2. SMTP (for provider scheduling email + .ics calendar invite)

The teleconsult notifier reuses the existing `EmailService` which reads SMTP
settings from the `system_settings` DB table or env. Confirm in DB:

```sql
SELECT key, value FROM system_settings
 WHERE key LIKE 'smtp_%';
```

Should contain `smtp_host`, `smtp_port`, `smtp_username`, `smtp_password`,
`smtp_from_name`. If empty, set them via `system_settings` (or env vars
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_NAME`).

Per the 2026-04-28 meeting, the eventual sender migrates from Farzan's
account to a Sharanam mailbox. Until then, email sends use whatever's in
`system_settings`.

---

## 3. EnableX webhook

In EnableX dashboard → Project → Webhooks, set:
- **URL:** `https://<your-public-host>/api/teleconsult/webhooks/enablex`
- **Secret:** any random string. Put the same value in `ENABLEX_WEBHOOK_SECRET`.

The signature scheme our verifier expects is HMAC-SHA256 of the raw body,
hex-encoded, in header `X-Enablex-Signature`. If EnableX uses a different
header / encoding, update `EnableXAdapter.verify_webhook` (one place to
change).

For local dev: leave `ENABLEX_WEBHOOK_SECRET` empty — the verifier will
accept any payload (logged a warning in the docstring).

---

## 4. WhatsApp templates (Meta WABA approval)

Submit these three templates in EnableX dashboard → WhatsApp → Templates.
Each takes ~24–48h for Meta approval.

### Template 1: `teleconsult_scheduled`
- **Category:** Utility
- **Language:** English
- **Body:** `Hi {{1}}, your teleconsult with {{2}} is scheduled for {{3}}. Join: {{4}} — Saranam Palliative Care`
- **Sample values:** Dr. Ashwini, Noorjan, Mon 5 May 2026 3:00 PM IST, https://video.enablex.io/?token=xyz

### Template 2: `teleconsult_reminder_24h`
- **Category:** Utility
- **Body:** `Reminder: teleconsult with {{2}} tomorrow at {{3}}. Join: {{4}} — Saranam Palliative Care`
- (placeholder {{1}} unused — keep order consistent with the dispatcher's positional params)

### Template 3: `teleconsult_reminder_15min`
- **Category:** Utility
- **Body:** `Your teleconsult with {{2}} starts in 15 minutes. Join: {{4}} — Saranam Palliative Care`

> The dispatcher passes positional params `[recipient_name, other_party, scheduled_at_local, join_url]` for all three templates — keep them in that order in the EnableX template definitions.

While templates are pending approval the WA notifications will fail and be
retried 3× then marked `failed`. Email + .ics still go through, so the
provider's calendar reminders (24h + 15min) work via Google Calendar's
native VALARM regardless of WhatsApp.

---

## 5. Smoke-test the full flow

1. Set `ENABLEX_MOCK=true`, `SCHEDULER_ENABLED=true` in `backend/.env`.
2. Restart backend.
3. In the UI, open any patient → Visits tab → New Visit:
   - Type = **Teleconsult**
   - Location = Video Call
   - Date = today, Time = +5 min from now
   - Pick a Provider with an email + phone on file
4. Save. Check the database:
   ```sql
   SELECT id, status, scheduled_at FROM tele_sessions ORDER BY created_at DESC LIMIT 1;
   SELECT recipient_type, channel, template_key, scheduled_for, status
     FROM tele_notifications ORDER BY created_at DESC LIMIT 10;
   ```
5. Within 60 seconds, the immediate-send rows (template_key=`scheduled`)
   should flip to `status='sent'`.
6. The 15-min and 24h rows wait for `scheduled_for <= NOW()`.
7. Open the patient's email — they get a Gmail "Yes/Maybe/No" RSVP card with
   the Saranam event; click yes → it lands on Google Calendar with two
   native reminders queued.
8. Watch the backend log for `teleconsult tick: dispatching N notification(s)`.

---

## 6. Operational dashboards (Phase 6)

There's no admin UI yet for failed notifications. Run this when troubleshooting:

```sql
SELECT n.id, s.id AS session_id, n.recipient_type, n.channel, n.template_key,
       n.status, n.retry_count, n.error_message, n.scheduled_for
  FROM tele_notifications n
  JOIN tele_sessions s ON s.id = n.session_id
 WHERE n.status = 'failed'
 ORDER BY n.updated_at DESC
 LIMIT 50;
```

Common failure modes:
- `no email on file for recipient` → set provider/patient email
- `no phone on file for recipient` → set provider/patient phone
- `WhatsApp not implemented for selected vendor` → ENABLEX_MOCK probably off but creds wrong; check ENABLEX_APP_ID/KEY
- `smtp: ...` → SMTP creds in `system_settings` invalid

---

## 6.5 EnableX dashboard checklist (REQUIRED before voice/inbound work)

The code is in place; these are one-time dashboard configurations you must
complete on https://portal.enablex.io for the dev-saranam project:

### a. Associate the virtual number with the Voice service ⚠️ blocker
**Symptom if missing:** `POST /voice/v1/call` returns
`"event_name":"service_not_associated_with_number"` (HTTP 405).

1. Voice → dev-saranam → **Number Settings** (or **Phone Numbers**).
2. Find +91 11690 40030 → click "Associate" / "Link to project" / "Assign Voice App".
3. Save.

Without this, no outbound or inbound voice call will go through.

### b. Create a Voice App for outbound bridge calls
The clean "ring patient → bridge to doctor" flow is built via EnableX's
dashboard Voice App. Our backend already passes the right
`action_on_connect.connect.{from,to}` payload. If you've enabled bridge
mode at the project level, no extra config needed — but the Voice App is
where you'd customize the greeting, retry behavior, fallback, etc.

### c. Create an Inbound Voice App
For inbound calls (a patient calling +91 11690 40030 directly):

1. Voice → Voice Apps → **Create App** (Inbound).
2. Step 1: Play a TTS greeting "Welcome to Saranam Palliative Care".
3. Step 2: Dial the on-duty doctor — either:
   - Hardcode a doctor's mobile number for v1 (simplest, demo-ready), or
   - Use a REST callback step pointing at `https://<ngrok>/api/teleconsult/webhooks/enablex/inbound` to dynamically dial whoever is currently on-duty.
4. Bind +91 11690 40030 to this Voice App.

### d. Set the Event URL
Voice → dev-saranam → Settings → **Event URL** → set to:
```
https://<ngrok-or-public-host>/api/teleconsult/webhooks/enablex/event
```
This delivers ringing/connected/disconnected events to our backend so
session rows update in real time.

### e. Whitelist test numbers (trial accounts only)
If your trial restricts outbound destinations, whitelist your mobile and
the test patient mobile in the dashboard before calling.

---

## 7. EnableX Voice — Phase 5 setup

### Project-side (EnableX dashboard)

1. Voice service is already activated on the **dev-saranam** project.
2. Virtual number purchased: **+91 11690 40030** (Shared / free tier).
3. Configure recording at the project level:
   - EnableX dashboard → Voice → Project Settings → Recording → toggle ON if you
     want recording across all calls. EnableX v2 doesn't expose a per-call
     `record:true` flag in the public API; the project setting decides.
4. **Event URL (webhook)** — EnableX dashboard → Voice → Project Settings →
   Event URL → set to:
   `https://<your-public-host>/api/teleconsult/webhooks/enablex`

   Local dev tip: tunnel with `ngrok http 5002` and use the ngrok URL. EnableX
   posts call lifecycle (ringing / connected / disconnected) here.

### Webhook payload encryption — known caveat

Per EnableX Voice v2 docs, voice webhook payloads are **encrypted using AppID**
with `x-algorithm`, `x-encoding`, `x-format` headers indicating the scheme. Our
adapter currently reads the *plain* payload (not decrypted) — this is fine for
dev when EnableX is configured to send plain payloads, but production needs:
- Either set "plain payload" mode in dashboard if available, OR
- Implement decryption in `EnableXAdapter.parse_webhook_event` matching the
  `x-algorithm` etc. headers.

Until that's resolved, the session may not auto-update on `disconnected` —
the user can hit **End call** in the modal to mark it completed manually.

### Voice flow in this build

1. User clicks **Voice** on a patient row (Teleconsult page) or schedules a
   teleconsult with channel=voice.
2. Backend calls `POST /voice/v1/call` with:
   - `from`: the EnableX virtual number (`+911169040030`)
   - `to`: patient's mobile (decrypted from `contact_encrypted`, with caregiver
     fallback)
   - `action_on_connect.play`: TTS announcement to identify Saranam
3. EnableX rings the patient. When they pick up, it plays the announcement
   then bridges to the doctor's leg (the IVR flow lives on the EnableX side —
   you'll configure the bridge target inside the Voice project's IVR app).
4. Frontend opens **VoiceCallStatus** modal that polls every 3s and shows
   ringing → connected → ended.
5. Doctor's mobile must be reachable; we pull provider phone via
   `HealthcareProvider.get_phone()`.

### What's still TODO (post-demo)

- **IVR bridge config**: the EnableX Voice project needs a one-time IVR app
  setup that takes "doctor's phone" as a parameter and dials it after the
  greeting. EnableX guides:
  https://developer.enablex.io/docs/guides/voice-guide/make-outbound-call/
- **Webhook decryption** — see caveat above.
- **Recording fetch endpoint** — not in v2 public docs; recording URL likely
  arrives in the `disconnected` webhook payload. Inspect a real disconnected
  payload and update `EnableXAdapter.parse_webhook_event` to extract.

---

## 8. Cancelling a teleconsult

`DELETE /api/teleconsult/sessions/:id` does:
1. Marks the session `status='cancelled'`.
2. Cancels any pending `tele_notifications` rows.
3. Enqueues a fresh "cancelled" notification immediately for both parties.
4. Provider gets an email with a `METHOD:CANCEL` .ics → Google Calendar
   auto-removes the event.

There's no UI button yet — call the API directly from devtools or the
patient detail page (Phase 6 will add a UI cancel button).
