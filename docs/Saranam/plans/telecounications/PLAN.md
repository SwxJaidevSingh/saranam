# Teleconsult Module — Master Plan

**Date:** 2026-04-29
**Status:** Decisions locked. Ready to start Phase 0.
**Demo target:** Thu/Fri week of 2026-05-04 (Phases 0–4).

---

## Locked decisions

| # | Decision |
|---|---|
| Module name | **`teleconsult`** |
| Recording | Off by default; per-call toggle |
| Visit modal | Replace "Phone Call" type with "Teleconsult". Location dropdown is dynamic (Voice / Video when type=Teleconsult, Home otherwise). Add **Time** field next to Date. |
| Provider abstraction | EnableX is **primary** for Voice / Video / WhatsApp / SMS. Exotel is **fallback** (parked behind KYC). |
| Visit-date semantics | `patient_visits.visit_date` stays as DATE. Precise date+time lives on `tele_sessions.scheduled_at` (DateTime). Non-breaking. |
| Patient notifications | (a) WhatsApp/SMS at scheduling with join link **+** (b) reminder 24h before **+** (c) reminder 15 min before |
| Provider notifications | Same three points + email with **.ics calendar invite** + WhatsApp |
| Ad-hoc "Call Now" | Requires provider selection (does not assume logged-in user) |
| Dev environment | EnableX-only for now. Exotel adapter is a stub. |

---

## Document index

This plan is split for readability:

| File | Scope |
|---|---|
| `PLAN.md` *(this file)* | Executive summary, decisions, phasing, risks |
| `01_BACKEND.md` | Module layout, services, routes, audit, permissions |
| `02_FRONTEND.md` | Page layout, components, dialogs, state, EnableX iframe wiring |
| `03_DATABASE.md` | Schema, indexes, migration, seed data |
| `04_NOTIFICATIONS.md` | Templates, .ics generation, reminder scheduling, dispatcher |
| `05_PROVIDER_ADAPTERS.md` | Adapter ABC, EnableX/Exotel/Mock implementations, registry pattern |
| `06_PHASING.md` | Phase-by-phase tasks, files to touch, acceptance criteria |

Read in order if onboarding; otherwise jump to the relevant subdoc.

---

## High-level architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│ Frontend (React)                                                    │
│  pages/teleconsult/                                                 │
│    ┌─────────────────────────────────────────────────────────────┐  │
│    │ TeleconsultPage                                             │  │
│    │  ┌────────────────────────┐                                 │  │
│    │  │ ScheduledThisWeekPanel │ ← GET /sessions?week=current    │  │
│    │  ├────────────────────────┤                                 │  │
│    │  │ PatientDirectory       │ ← GET /patients (search)        │  │
│    │  │  [Voice] [Video] btns  │ → opens CallNowDialog           │  │
│    │  ├────────────────────────┤                                 │  │
│    │  │ SessionHistoryPanel    │ ← GET /sessions?status=completed│  │
│    │  └────────────────────────┘                                 │  │
│    └─────────────────────────────────────────────────────────────┘  │
│    VideoCallRoom (iframe) ← EnableX Web Toolkit                     │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ REST
┌──────────────────────────────────▼──────────────────────────────────┐
│ Backend (Flask)                                                     │
│  app/teleconsult/                                                   │
│    routes/  →  services/orchestrator.SessionOrchestrator            │
│                  │                                                  │
│                  ├──→ ProviderRegistry → EnableXAdapter (primary)   │
│                  │                       ExotelAdapter (fallback)   │
│                  │                       MockAdapter (tests)        │
│                  │                                                  │
│                  ├──→ NotificationService → EmailService            │
│                  │                          WhatsAppService (EnableX)│
│                  │                          SMSService (EnableX)    │
│                  │                          ICSGenerator            │
│                  │                                                  │
│                  └──→ ReminderScheduler (APScheduler job)           │
│                                                                     │
│  Database:                                                          │
│    tele_sessions       — main session record                        │
│    tele_notifications  — notification log + reminder queue          │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ HTTPS
                ┌──────────────────┼──────────────────┐
                ▼                  ▼                  ▼
         EnableX Video API   EnableX Voice API   EnableX WA/SMS API
         api.enablex.io      api.enablex.io      api.enablex.io
```

Single facade (`SessionOrchestrator`) — routes never call adapters directly. Lets us:
- Mock providers in dev/CI (`ENABLEX_MOCK=true`)
- Swap EnableX↔Exotel per channel later via config
- Add new providers (Twilio, Plivo) without touching routes

---

## Channels supported (via EnableX)

| Channel | Used for | Phase |
|---|---|---|
| **Video** | Patient teleconsult, recorded if toggled | 1 |
| **Voice** | Patient teleconsult voice calls | 5 |
| **WhatsApp** | Scheduling notifications, reminders, join links | 4 |
| **SMS** | Fallback when patient has no WhatsApp | 4 |
| Email | Provider scheduling email + .ics invite (existing SMTP infra) | 4 |

---

## Phasing — full effort

| Phase | Scope | Days | Blockers |
|---|---|---|---|
| **0** | Skeleton: module dirs, env vars, DB migration, blueprint reg, mock adapter, base ABC | 0.5 | none |
| **1** | EnableX Video — create-room, tokens, iframe, end-call, webhook, recording fetch, pre-call check | 2.0 | trial credits ✅ |
| **2** | Teleconsult page UI — ScheduledThisWeek, PatientDirectory, search, ad-hoc CallNowDialog, sidebar entry | 1.5 | needs Phase 1 |
| **3** | Visit-modal integration — replace Phone Call with Teleconsult, dynamic Location, Time field, provider select, auto-create tele_session on save | 0.5 | none |
| **4** | Notifications + reminders — Email + .ics + WA + SMS templates, NotificationService, APScheduler reminder job, send + 24h + 15min flow | 2.0 | EnableX WhatsApp template approval (Meta WABA, ~24–48h) |
| **5** | EnableX Voice — initiate, ringing UI, end, recording fetch | 1.5 | EnableX Voice number purchase |
| **6** | Polish — audit logging, RBAC, error/empty states, E2E test on trial credits | 1.0 | none |
| **7** *(parked)* | Exotel adapter + automatic failover wiring | 1.5 | Exotel KYC |

**Critical path for next-week demo (Thu/Fri 2026-05-08/09):** Phases 0 → 1 → 2 → 3 → 4 = **6.5 days**. WhatsApp template approval starts Day 1 in parallel.

If WhatsApp template doesn't clear by demo day, fallback: provider gets email + .ics; patient gets email or copy-link button only.

---

## Top 10 risks

1. **EnableX WhatsApp template approval lag** — Meta/WABA can take 24–48h per template. Submit Day 1; have email-only fallback.
2. **EnableX Voice API maturity** — needs verification; spec may differ from Exotel. Phase 5 estimate may stretch.
3. **EnableX wallet** — ₹375 trial covers ~30 video tests + WA messages. Top-up before demo.
4. **Calendar invite rendering** — Gmail handles `.ics` inline; Outlook native; mobile clients vary. Test across.
5. **Time-zone bugs** — store UTC, render IST, .ics MUST include `TZID:Asia/Kolkata`.
6. **Patient without WhatsApp** — auto-fallback to SMS via EnableX; needs `prefer_sms` flag on patient model.
7. **Recording consent (DPDPA)** — record toggle should also surface in-call consent banner. Note for v2; v1 ships consent in scheduling email/WA.
8. **APScheduler at-least-once delivery** — duplicate sends if pod restarts mid-job. `tele_notifications` row uniqueness + `sent_at` check guards this.
9. **Webhook signature verification** — verify EnableX provides HMAC; if not, IP-allowlist + secret-token query param.
10. **Browser camera/mic permission UX** — first-time flow scary. PreCallCheck screen on doctor side, simple "Allow" doc on patient side.

---

## Acceptance criteria (next-week demo)

- [ ] `Teleconsult` menu entry visible to clinical roles
- [ ] Page loads with three sections (This Week / Patients / History)
- [ ] Patient search returns matches; Voice/Video buttons visible
- [ ] Click Video → CallNowDialog → pick provider → backend creates EnableX room → iframe opens, doctor sees own video
- [ ] End → status `completed`, `duration_seconds` populated
- [ ] Visit modal: type=Teleconsult → Location is Voice/Video, Time visible, Provider dropdown shows
- [ ] On save: `tele_session` row exists, `linked_visit_id` set, scheduled WA + email + .ics dispatched
- [ ] Provider receives email with calendar invite that opens correctly in Gmail
- [ ] Provider receives WhatsApp at scheduling, 24h before, 15min before (mocked recipient if not whitelisted)
- [ ] Patient receives WA/SMS at same three checkpoints
- [ ] No regressions in existing `call_logs` (Smart Outreach) page
- [ ] Audit log entries for create / end / cancel / recording-fetch

---

## Env-var summary

```env
# EnableX (primary)
ENABLEX_APP_ID=69f0e3ed2fef01a8b902cb9d
ENABLEX_APP_KEY=yeUajuda5uXuvuHaMeAeay4asapyuuTaXesy
ENABLEX_BASE_URL=https://api.enablex.io
ENABLEX_VIDEO_PATH=/video/v1
ENABLEX_VOICE_PATH=/voice/v1
ENABLEX_WA_PATH=/whatsapp/v1
ENABLEX_SMS_PATH=/sms/v1
ENABLEX_TOOLKIT_URL=https://video.enablex.io
ENABLEX_WEBHOOK_SECRET=
ENABLEX_MOCK=false

# Exotel (fallback — parked)
EXOTEL_ENABLED=false
ACCOUNT_SID=
API_KEY=
API_TOKEN=
EXOTEL_CALLER_ID=
EXOTEL_REGION=in

# Teleconsult
TELECONSULT_REMINDER_24H_OFFSET_MINUTES=1440
TELECONSULT_REMINDER_15M_OFFSET_MINUTES=15
TELECONSULT_TIMEZONE=Asia/Kolkata
TELECONSULT_CLINIC_NAME=Saranam Palliative Care
TELECONSULT_CLINIC_EMAIL=team@exatorial.com
```

Frontend:
```env
VITE_ENABLEX_TOOLKIT_URL=https://video.enablex.io
```

---

## Reference

- EnableX dev portal: https://developer.enablex.io/
- EnableX Video: https://developer.enablex.io/docs/video
- EnableX Web Toolkit: https://developer.enablex.io/docs/video/uikit/web-toolkit
- EnableX WhatsApp: https://developer.enablex.io/docs/whatsapp
- EnableX Voice: https://developer.enablex.io/docs/voice
- EnableX Auth: https://developer.enablex.io/docs/references/authentication
- iCalendar (RFC 5545): https://datatracker.ietf.org/doc/html/rfc5545
- Meeting changes doc: `CHANGES_2026-04-28.md`
