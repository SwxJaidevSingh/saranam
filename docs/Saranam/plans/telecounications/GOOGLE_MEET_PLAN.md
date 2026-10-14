# Google Meet — Primary Video Provider with EnableX Fallback

## Goal

Replace EnableX as the **primary video provider** for teleconsults with **Google Meet via the Google Calendar API**, while keeping EnableX in the codebase as an automatic fallback. Voice calls remain entirely on EnableX.

EnableX has been unreliable for video (1161 cluster errors, signaling drops, SDK token burn). Google Meet sidesteps every one of those issues at near-zero cost.

## Why Google Meet

- **Reliability** — Meet's signaling is operated by Google at a scale we can't match; no cluster routing surprises.
- **Cost** — Calendar API is free. Consumer Gmail Meet is free with a 60-minute cap on 3+ participant calls (1:1 unlimited). Acceptable for palliative teleconsults that rarely exceed 60 min.
- **No SDK** — we generate a `meet.google.com/...` link and let Google host the meeting. No `EnxRtc.js`, no `joinRoom`, no token expiry mid-call.
- **Architecturally clean** — slots into the existing `ProviderAdapter` ABC + `ProviderRegistry` we built for EnableX. New adapter, registry pref change, done.

## Locked decisions

| Decision | Value |
|---|---|
| Provider preference for video | `google_meet` primary, `enablex` fallback |
| Auth model | Single shared scheduling account (Model A) — one OAuth, all meetings owned by the host email |
| Host email (dev) | `farzanmanzer@gmail.com` |
| Host email (prod) | Saranam's Gmail (consumer, not Workspace) |
| Account type | Consumer Gmail (no Workspace) |
| Recording | Not required (acceptable to skip) |
| Group meeting cap | 60 min for 3+ participants is acceptable |
| Meet link access | Open — anyone with link can join |
| Patients without email | Get link via WhatsApp + SMS only; not added as Calendar attendee |
| Provider as Calendar attendee | Yes (gets Google's native invite + reminders) |
| Native Google calendar invite | Enabled (`sendUpdates=all`); we suppress our own email channel for Meet sessions to avoid duplication |
| WhatsApp + SMS | Always fire alongside, regardless of provider |
| Reminders | Native Google Calendar (24h + 15min popup) |
| Auto-fallback to EnableX | Yes, silent (no UI toggle) |
| Voice channel | Stays on EnableX, untouched |

## Architecture — slots into existing pattern

```
SessionOrchestrator.{initiate_now, schedule}
    │
    ├── _create_video_room()    ← new helper with try/except fallback
    │     │
    │     ├─ try: ProviderRegistry.get("google_meet").create_video_room(...)
    │     │   └─ Calendar API: POST /calendars/<host>/events?conferenceDataVersion=1
    │     │
    │     └─ except: ProviderRegistry.get("enablex").create_video_room(...)
    │         └─ EnableX REST: POST /v1/rooms (existing path)
    │
    └── session.provider_vendor = "google_meet" | "enablex"  (whichever succeeded)
```

The orchestrator already routes voice → EnableX directly (unchanged). The fallback only applies to video.

## File changes

### New files
- `backend/app/teleconsult/services/adapters/google_meet.py` — `GoogleMeetAdapter(ProviderAdapter)`. Implements only video methods; voice/whatsapp/sms raise `NotImplementedError`.
- `backend/app/teleconsult/routes/google_oauth.py` — `/api/teleconsult/google/oauth/start` and `/callback` endpoints for the one-time refresh-token capture.
- `docs/Saranam/plans/telecounications/GOOGLE_MEET_PLAN.md` — this doc.

### Modified files
- `backend/requirements.txt` — add `google-auth`, `google-auth-oauthlib`, `google-api-python-client`.
- `backend/app/teleconsult/services/provider_registry.py` — register `google_meet` adapter; reorder `for_channel` to honor `TELECONSULT_VIDEO_PRIMARY` env.
- `backend/app/teleconsult/services/orchestrator.py` — wrap video room creation in try/fallback; for Meet sessions, skip `(provider, email)` notification row (Google's native invite covers it).
- `backend/app/teleconsult/routes/__init__.py` — register the new oauth blueprint.
- `backend/.env` / `.env.example` — add `GOOGLE_OAUTH_*`, `GOOGLE_MEET_HOST_EMAIL`, `TELECONSULT_VIDEO_PRIMARY`, `TELECONSULT_VIDEO_FALLBACK`. (Actual values stay out of this doc.)
- `frontend/src/pages/teleconsult/components/VideoCallRoom.jsx` — detect `provider_vendor === 'google_meet'` and render a clean "Join Google Meet" button that opens `participant_join_url` in a new tab. Skip EnableX SDK entirely for Meet sessions.
- `frontend/src/pages/teleconsult/PatientJoinPage.jsx` — same detection; for Meet sessions auto-redirect (`window.location.href`) to the Meet URL.

## Calendar event body (reference)

```http
POST https://www.googleapis.com/calendar/v3/calendars/<host_email>/events?conferenceDataVersion=1&sendUpdates=all
Authorization: Bearer <access_token_derived_from_refresh_token>

{
  "summary": "Saranam Teleconsult — <patient> with <provider>",
  "description": "Click the Meet link to join your video consultation.",
  "start": { "dateTime": "<ISO>", "timeZone": "Asia/Kolkata" },
  "end":   { "dateTime": "<ISO>", "timeZone": "Asia/Kolkata" },
  "attendees": [
    { "email": "<provider_email>" },
    { "email": "<patient_email>" }   // omitted if patient has no email
  ],
  "conferenceData": {
    "createRequest": {
      "requestId": "saranam-<uuid>",
      "conferenceSolutionKey": { "type": "hangoutsMeet" }
    }
  },
  "reminders": {
    "useDefault": false,
    "overrides": [
      { "method": "popup", "minutes": 1440 },
      { "method": "popup", "minutes": 15 }
    ]
  },
  "guestsCanInviteOthers": false,
  "guestsCanModify": false
}
```

Response includes `id` (calendar event ID — stored as `vendor_session_id`) and `hangoutLink` (the Meet URL — stored as both `moderator_join_url` and `participant_join_url` since Meet uses one URL for everyone).

## OAuth flow

One-time human-in-the-loop step at deployment / first run:

1. Operator visits `http://localhost:5002/api/teleconsult/google/oauth/start` in a browser.
2. Backend redirects to Google's consent screen (scope: `calendar.events`).
3. Operator (signed in as `GOOGLE_MEET_HOST_EMAIL`) clicks Allow.
4. Google redirects browser to `/oauth/callback?code=<code>`.
5. Backend exchanges code for tokens, persists the refresh token in `system_settings` row (key: `google_oauth_refresh_token`).
6. Done. From here on, the adapter mints fresh access tokens from the stored refresh token without any human interaction.

## Notification policy for Meet sessions

Existing template fan-out enqueues `(provider, email)`, `(provider, whatsapp)`, `(patient, whatsapp)`. For Meet sessions:

- **Skip** `(provider, email)` — Google's native invite covers it, in a much nicer format with a "Join" button.
- **Keep** WhatsApp rows for both parties — patients especially rely on chat-channel pings.
- Add `(patient, sms)` if patient has a phone but no WhatsApp opt-in (existing template registration handles this).

EnableX-routed sessions keep the old behavior — our notifier sends everything because EnableX has no native invite.

## Testing checklist

1. Run OAuth dance: visit `/start`, complete consent, confirm refresh token stored in `system_settings`.
2. Schedule a teleconsult via Visit modal.
3. Verify `tele_sessions` row has `provider_vendor='google_meet'` and `participant_join_url` matches `meet.google.com/...`.
4. Check operator's Gmail — Google Calendar invite should arrive within ~30s with a Join button.
5. Provider's Gmail — same.
6. Click the link — Meet opens, joins as guest works for both parties.
7. WhatsApp + SMS rows should fire from `tele_notifications` (idempotently scheduled).
8. **Fallback test**: temporarily set `GOOGLE_OAUTH_REFRESH_TOKEN` system_setting to a bad value → schedule again → confirm session falls back to EnableX (`provider_vendor='enablex'`) and EnableX URL is generated.
9. Voice call — confirm unchanged: still routed to EnableX.

## Known caveats

- **Host-email self-suppression**: Google silently does NOT email an invite to an attendee whose address matches the calendar owner / organizer. If a patient's email happens to equal `GOOGLE_MEET_HOST_EMAIL`, the invite to that patient is dropped (provider still gets theirs because their email is different). In production this never matters because the host email is a dedicated scheduling account no real patient shares. In dev with the host = personal email, use plus-aliases (`me+patient@gmail.com`) or a separate account for testing patient-side delivery.


- **Refresh token expiry on Testing-mode OAuth apps**: Google expires refresh tokens after 7 days when the consent screen is in "Testing" status. For development this means re-running the OAuth dance weekly. To eliminate this, publish the OAuth app to "In production" (Google Auth Platform → Branding/Verification — the app may show an "unverified app" warning until full verification, but works). Verification for sensitive scopes (calendar) takes 2–14 days.
- **No recording on consumer Gmail**: by design. If recording becomes a hard requirement, switch to Google Workspace Business Standard ($12/seat/mo) or Workspace for Nonprofits (free if Saranam qualifies as a registered nonprofit).
- **60-min cap with 3+ participants**: 1:1 doctor-patient calls are unlimited. If a caregiver/family member also joins (3 people), the call cuts at 60 min. The user has confirmed this is acceptable.
- **Patient waiting-room behavior**: Google Meet on consumer Gmail puts uninvited (no email on calendar event) joiners through a "knock to join" flow by default. For a v1, the doctor admits the patient on join. Acceptable workaround.
- **OAuth consent screen verification**: while in "Testing" status, only test users (added under Audience tab) can authorize. Add `GOOGLE_MEET_HOST_EMAIL` as a test user.

## Future work (not in v1)

- Apply for **Google Workspace for Nonprofits** if Saranam is registered (12A/80G) — gets us Business Standard tier free, lifts the 60-min cap, and adds recording.
- Publish the OAuth app to "In production" to remove the 7-day refresh token expiry.
- Per-provider OAuth (Model B) — let each doctor own their own meetings on their own calendar — only if/when the central calendar becomes noisy.
- Optional manual override toggle in the schedule UI (force EnableX for a specific session) — only if a clinical reason emerges.

## Cost summary

- Google Calendar API: **free**, 1M req/day quota (we'll never approach it)
- Consumer Gmail Meet: **free**
- 1:1 calls: unlimited duration
- 3+ participant calls: capped at 60 min (acceptable)
- Per-month total: **$0**

Compared to EnableX's per-minute pricing (~$500–1500/month at clinic scale), this is approximately a 100× cost reduction.
