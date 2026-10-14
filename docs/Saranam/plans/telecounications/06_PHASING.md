# Phasing Plan — Teleconsult

Breakdown by phase with **specific files** and **acceptance criteria** so any engineer can pick up a phase and finish it.

---

## Phase 0 — Foundation (0.5 day)

### Tasks
- Create module skeleton:
  - `backend/app/teleconsult/__init__.py`
  - `backend/app/teleconsult/{models,services,routes,templates,services/adapters}/__init__.py`
- Add env vars to `backend/.env` and `backend/.env.example`:
  - `ENABLEX_APP_ID`, `ENABLEX_APP_KEY`, `ENABLEX_BASE_URL`, `ENABLEX_*_PATH`, `ENABLEX_TOOLKIT_URL`, `ENABLEX_WEBHOOK_SECRET`, `ENABLEX_MOCK=false`
  - `TELECONSULT_TIMEZONE`, `TELECONSULT_CLINIC_NAME`, `TELECONSULT_CLINIC_EMAIL`
- Add `VITE_ENABLEX_TOOLKIT_URL` to `frontend/.env`
- Create Alembic migration `<rev>_teleconsult_initial.py` — `tele_sessions`, `tele_notifications`, indexes, seed `system_settings`
- Implement ABC: `services/adapters/base.py`
- Implement `MockAdapter`: `services/adapters/mock.py`
- Stub `EnableXAdapter` (raise on real calls — Phase 1 fills it in)
- Implement `ProviderRegistry`: `services/provider_registry.py`
- Stub `SessionOrchestrator`: `services/orchestrator.py` with method signatures + NotImplementedError bodies
- Register blueprint placeholder + add models to `app/models.py` import list
- Smoke test: backend starts, `/api/teleconsult/health` returns 200

### Acceptance
- [ ] `python -m flask db upgrade` runs cleanly
- [ ] `import app.teleconsult` works in shell
- [ ] `ProviderRegistry.get('enablex')` returns `MockAdapter` when `ENABLEX_MOCK=true`
- [ ] No new test failures

### Files touched
```
backend/app/__init__.py                                                    (M)
backend/app/models.py                                                      (M)
backend/app/teleconsult/__init__.py                                        (A)
backend/app/teleconsult/models/{__init__,tele_session,tele_notification}.py (A)
backend/app/teleconsult/services/{__init__,orchestrator,provider_registry}.py (A)
backend/app/teleconsult/services/adapters/{__init__,base,enablex,exotel,mock}.py (A)
backend/app/teleconsult/routes/__init__.py                                 (A)
backend/migrations/versions/<rev>_teleconsult_initial.py                   (A)
backend/.env, backend/.env.example                                         (M)
frontend/.env                                                              (M)
```

---

## Phase 1 — EnableX Video (2 days)

### Tasks
- Implement `EnableXAdapter`:
  - `create_video_room`, `_issue_token`, `_toolkit_url`
  - `end_video_room`, `fetch_recording`
  - `verify_webhook`, `parse_webhook_event`
- Implement `SessionOrchestrator`:
  - `initiate_now(channel='video', ...)`
  - `end(...)`
  - `list_sessions(...)`, `get(id)`
  - `_apply_webhook_event(...)`
- Implement routes:
  - `POST /api/teleconsult/sessions/initiate-now`
  - `POST /api/teleconsult/sessions/:id/end`
  - `GET  /api/teleconsult/sessions`
  - `GET  /api/teleconsult/sessions/:id`
  - `GET  /api/teleconsult/sessions/:id/recording`
  - `POST /api/teleconsult/webhooks/enablex`
- Frontend:
  - `frontend/src/api/teleconsult.js`
  - `pages/teleconsult/components/VideoCallRoom.jsx`
  - `pages/teleconsult/components/PreCallCheck.jsx`
  - Route registration: `/teleconsult/sessions/:id`
- Test against EnableX trial creds:
  - Create a room, open iframe with moderator token, verify video preview works
  - End call, confirm session row updates
  - Manually POST a fake webhook → assert session status update

### Acceptance
- [ ] `curl -X POST .../sessions/initiate-now -d '{patient_id, provider_id, channel: "video"}'` returns 201 with `moderator_join_url`
- [ ] Open URL in browser → EnableX room loads, camera works
- [ ] Click End → session row `status='completed'`, `ended_at` set
- [ ] Webhook with `room.ended` payload + valid HMAC → 204; session updates
- [ ] Recording fetch returns URL within 2 min after end (when `record_call=true`)

---

## Phase 2 — Teleconsult page UI (1.5 days)

### Tasks
- Page shell:
  - `pages/teleconsult/TeleconsultPage.jsx` (three-section layout)
- Components:
  - `ScheduledThisWeekPanel`, `ThisWeekSessionCard`
  - `PatientDirectory`, `PatientRow`
  - `SessionHistoryPanel`, `HistoryRow`
  - `SessionStatusBadge`
  - `CallNowDialog` (provider select + record toggle + notes)
  - `ProviderSelect` (autocomplete)
  - `JoinLinkShareDialog`
- Sidebar entry — find existing sidebar, add `Teleconsult` link with `VideoCallOutlined` icon, role-gated
- Hooks:
  - `useTeleSessions({ weekOf, patientId, status })`
  - `useTeleProviders()`
- Top-level route: `/teleconsult`

### Acceptance
- [ ] Navigate to `/teleconsult` — page renders three sections
- [ ] Search "Noor" filters patients
- [ ] Click `[Video]` on a patient → CallNowDialog opens → pick provider → submit → navigates to VideoCallRoom
- [ ] "This Week" panel reads from API, shows scheduled sessions
- [ ] "Recent Sessions" collapses cleanly

---

## Phase 3 — Visit-modal integration (0.5 day)

### Tasks
- Modify `frontend/src/pages/patients/tabs/VisitsTab.jsx`:
  - Replace `phone` visit type with `teleconsult`
  - Add dynamic `getLocationOptions(visitType)` — Voice/Video when teleconsult, Home otherwise
  - Add `visit_time` field
  - Add `provider_id`, `record_call`, `notes` fields (visible only when teleconsult)
  - On submit: if teleconsult, call `teleconsultApi.scheduleSession({...})` after `createVisit`
  - Validation: provider+time required for teleconsult
  - Dialog title swap
- Backend:
  - `POST /api/teleconsult/sessions/schedule` route
  - Implement `SessionOrchestrator.schedule(...)` (see 04_NOTIFICATIONS.md for fan-out logic — even though notifications get fully wired in Phase 4, the *enqueue* step ships now so the queue exists)

### Acceptance
- [ ] Open New Visit dialog on a patient
- [ ] Type=Teleconsult → Location flips to Voice/Video, Time field appears, Provider dropdown appears
- [ ] Save → `patient_visits` row + `tele_sessions` row both exist; linked by `linked_visit_id`
- [ ] Pending notifications show up in `tele_notifications` queue (status=pending)
- [ ] Dialog title shows "Schedule Teleconsult"

---

## Phase 4 — Notifications + Reminders (2 days)

### Tasks
- Email templates:
  - `templates/email/teleconsult_scheduled.html`
  - `templates/email/teleconsult_reminder_24h.html`
  - `templates/email/teleconsult_reminder_15min.html`
  - `templates/email/teleconsult_cancelled.html`
- WhatsApp templates (text files for our store; actual templates submitted to Meta dashboard):
  - `templates/messages/wa_scheduled.txt`
  - `templates/messages/wa_reminder_24h.txt`
  - `templates/messages/wa_reminder_15min.txt`
- SMS templates:
  - `templates/messages/sms_*.txt`
- `services/calendar_invite.py` — `build_ics(...)` function
- `services/notifications.py` — `NotificationService.dispatch(...)`, `_build_context`, `_wa_params`
- Extend `EmailService.send` to accept attachments (verify existing API; if not, add)
- Implement EnableX adapter methods: `send_whatsapp`, `send_sms`
- `services/reminder_scheduler.py` — `teleconsult_reminder_tick`, `init_teleconsult_scheduler`
- Wire `init_teleconsult_scheduler(app)` in `app/__init__.py`
- Cancel flow: cancellation `.ics` with `METHOD:CANCEL`
- Resend-link route: `POST /sessions/:id/resend-link`
- **Day 1**: submit 3 WhatsApp templates to Meta WABA via EnableX dashboard

### Acceptance
- [ ] Schedule a session → 6 rows appear in `tele_notifications`, all `status=pending`
- [ ] Within 60s, the 2 immediate-send rows flip to `status=sent`
- [ ] Provider gets email with `event.ics` attached; opens in Gmail; clicking adds to Google Calendar
- [ ] Calendar shows VALARM reminders at 24h and 15min
- [ ] Mock 24h-from-now scheduled session: rewind clock or update `scheduled_for`, watch tick fire
- [ ] WhatsApp templates approved by Meta (check dashboard)
- [ ] Patient WA send works against a whitelisted number
- [ ] Cancel session → calendar event auto-removed in Gmail

---

## Phase 5 — EnableX Voice (1.5 days)

### Tasks
- Verify EnableX Voice API spec (read https://developer.enablex.io/docs/voice). Adjust `EnableXAdapter.initiate_voice_call` payload accordingly.
- Buy a virtual number from EnableX (or use trial number). Set as `ENABLEX_VOICE_CALLER_ID` env.
- Implement `SessionOrchestrator.initiate_now(channel='voice')`:
  - Call EnableX voice API with provider's mobile as `from`, patient's mobile as `to`
  - Recording on if toggle set
  - Set `StatusCallback` to webhook URL
- Frontend `VoiceCallStatus.jsx` — modal showing ringing → connected → ended, polls session every 3s
- Webhook event handlers for voice: `call.ringing`, `call.in_progress`, `call.completed`
- Recording fetch on `call.completed`

### Acceptance
- [ ] Click [Voice] on a patient → CallNowDialog → Voice channel → both phones ring
- [ ] Connect both → status `in_progress`
- [ ] Hang up → status `completed`, duration recorded
- [ ] Recording URL appears within 2 min (if record toggle on)

---

## Phase 6 — Polish (1 day)

### Tasks
- Audit log entries on every state-changing action
- RBAC: `@require_role` decorator on routes
- Empty states + error states across all components
- Permission-gated sidebar entry
- Notification failure dashboard (admin) — simple list view of `status=failed` rows
- E2E test: schedule → reminder fires → session ends → recording fetched
- Update `CHANGES_2026-04-28.md` with what shipped
- README in `app/teleconsult/`
- One-pager user-facing doc for Dr. Ashwini

### Acceptance
- [ ] All routes have `@jwt_required()`
- [ ] Non-clinical users do not see Teleconsult sidebar entry
- [ ] Admin can see notification failures list
- [ ] E2E test passes in CI

---

## Phase 7 — Exotel fallback (parked, post-KYC) — 1.5 days

### Tasks
- Fully implement `ExotelAdapter` (voice + SMS + WhatsApp)
- Add `VendorOutageError` exception
- Wrap orchestrator critical paths in `_with_failover(channel, fn)`
- Failover decision rule: 5xx or timeout from EnableX → retry on Exotel; 4xx → bubble up
- Test with EnableX manually disabled (mock outage)

### Acceptance
- [ ] Stop EnableX (set `ENABLEX_MOCK=true` to force errors), schedule a voice call → succeeds via Exotel
- [ ] EnableX restored → next call goes through EnableX again

---

## Parallel work that can start Day 1

- WhatsApp template submission to Meta (Phase 4 dep)
- EnableX trial wallet top-up if needed (Phase 1+ dep)
- Decide patient `prefer_sms` flag schema or use system_settings global
- Confirm clinic SMTP works for `.ics` attachments (test send to team@exatorial.com)

---

## Post-demo backlog

- Recurring weekly schedules
- Provider availability calendar / conflict detection
- Multi-participant rooms (caregiver + patient + doctor)
- Multi-language templates (Kannada / Hindi)
- In-call recording-consent banner
- Call quality analytics
- Patient-facing mobile-friendly join page (custom-branded)
