# Frontend Plan — Teleconsult

## File layout

```
frontend/src/pages/teleconsult/
├── TeleconsultPage.jsx              # main page, three-section layout
├── components/
│   ├── ScheduledThisWeekPanel.jsx
│   ├── ThisWeekSessionCard.jsx
│   ├── PatientDirectory.jsx
│   ├── PatientRow.jsx
│   ├── SessionHistoryPanel.jsx
│   ├── HistoryRow.jsx
│   ├── SessionStatusBadge.jsx
│   ├── ScheduleSessionDialog.jsx    # opens from "Schedule" button or visit modal
│   ├── CallNowDialog.jsx            # opens from PatientRow [Voice]/[Video] buttons
│   ├── VideoCallRoom.jsx            # full-page route, EnableX iframe wrapper
│   ├── VoiceCallStatus.jsx          # ringing/connected modal
│   ├── ProviderSelect.jsx           # autocomplete provider dropdown
│   ├── ChannelToggle.jsx            # Voice/Video radio
│   ├── DateTimePicker.jsx           # paired Date + Time inputs
│   ├── PreCallCheck.jsx             # mic/camera test before iframe
│   └── JoinLinkShareDialog.jsx      # copy / WhatsApp / SMS / email
└── hooks/
    ├── useTeleSessions.js
    ├── useTeleProviders.js
    └── useEnableXToolkit.js         # encapsulates iframe lifecycle

frontend/src/api/
└── teleconsult.js                   # all teleconsult REST calls

frontend/src/pages/patients/tabs/
└── VisitsTab.jsx                    # MODIFIED — replace Phone Call type, dynamic Location, add Time + Provider when teleconsult
```

## Routing

Add to top-level router:
```jsx
<Route path="/teleconsult" element={<TeleconsultPage />} />
<Route path="/teleconsult/sessions/:id" element={<VideoCallRoom />} />
```

Sidebar entry (whichever sidebar component exists in this repo — search & inject):
- Label: "Teleconsult"
- Icon: `VideoCallOutlined` (MUI)
- Visible to clinical roles

## Page layout

```
┌─ TeleconsultPage ────────────────────────────────────────────────────┐
│ Header: "Teleconsult"           [+ Schedule New]                     │
│                                                                      │
│ ┌─ ScheduledThisWeekPanel ──────────────────────────────────────┐    │
│ │ This Week (Mon 28 Apr – Sun 4 May)             4 sessions     │    │
│ │ ┌─ ThisWeekSessionCard ──────────────────────────────────┐    │    │
│ │ │ Mon 28 Apr • 3:00pm   📹 Video                         │    │    │
│ │ │ Noorjan • UHID 2026010050                              │    │    │
│ │ │ Dr. Ashwini                                            │    │    │
│ │ │                          [Join] [Reschedule] [Cancel]  │    │    │
│ │ └────────────────────────────────────────────────────────┘    │    │
│ │ ...                                                            │    │
│ └────────────────────────────────────────────────────────────────┘    │
│                                                                      │
│ ┌─ PatientDirectory ────────────────────────────────────────────┐    │
│ │ Patients                              [🔍 search ___________]  │    │
│ │ Filters: [All Zones ▾] [Priority ▾]                            │    │
│ │ ┌─ PatientRow ───────────────────────────────────────────┐    │    │
│ │ │ Noorjan • 55F • South • Priority: Low                  │    │    │
│ │ │ +91 99941 87037                                        │    │    │
│ │ │                            [📞 Voice]  [📹 Video]      │    │    │
│ │ └────────────────────────────────────────────────────────┘    │    │
│ │ ...                                                            │    │
│ └────────────────────────────────────────────────────────────────┘    │
│                                                                      │
│ ┌─ SessionHistoryPanel (collapsible) ───────────────────────────┐    │
│ │ Recent Sessions                                                │    │
│ │ Mon 21 Apr • Video • Noorjan • Dr. Ashwini • 18m  ▶ recording │    │
│ └────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

## Key components

### `ScheduleSessionDialog`

Opened from:
- Header `[+ Schedule New]` button (no preselection)
- Visit modal save (preselected patient + visit_date)
- "Reschedule" on a session card (preselected with current values)

Fields:
| Field | Component | Required | Notes |
|---|---|---|---|
| Patient | `PatientPicker` (autocomplete) | yes | Disabled when prefilled from visit modal |
| Provider | `ProviderSelect` | yes | Active providers only |
| Channel | `ChannelToggle` (Voice/Video) | yes | Default: Video |
| Date | Date picker | yes | Default: today |
| Time | Time picker | yes | Default: now + 1h, snapped to :00/:30 |
| Record call | Switch | no | Default off |
| Notes | Textarea | no | Free text |

Submit → `POST /api/teleconsult/sessions/schedule`. On success: close dialog, optimistic-add to `ScheduledThisWeekPanel`, toast "Scheduled — invitations sent".

### `CallNowDialog`

Opened from `PatientRow` [Voice] or [Video] click.

Fields:
- Provider (required) — `ProviderSelect`
- Record call (default off)
- Notes (optional)

Submit → `POST /api/teleconsult/sessions/initiate-now` with patient + channel preset. On success:
- Video → navigate to `/teleconsult/sessions/:id` (full-page `VideoCallRoom`)
- Voice → open `VoiceCallStatus` modal, poll for status

### `VideoCallRoom`

Full-page route `/teleconsult/sessions/:id`. Loads session, embeds EnableX iframe.

```jsx
const VideoCallRoom = () => {
  const { id } = useParams();
  const { session, loading, error } = useTeleSession(id);
  const [confirmedReady, setConfirmedReady] = useState(false);

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen error={error} />;

  if (!confirmedReady) {
    return <PreCallCheck onReady={() => setConfirmedReady(true)} />;
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <CallHeader session={session} onEnd={...} />
      <iframe
        src={`${TOOLKIT_URL}/?token=${session.moderator_token}`}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        style={{ flex: 1, border: 'none' }}
        title="Video Consultation"
      />
      <CallFooter session={session} onShareLink={...} />
    </Box>
  );
};
```

`useEnableXToolkit` listens for `postMessage` events from the iframe — `roomConnected`, `roomDisconnected`, `recordingStarted` — and updates the session via API.

### `PreCallCheck`

Before joining, doctor sees:
- "Allow camera & mic" prompt + checklist
- Self-preview (`getUserMedia`)
- Audio level meter
- "I'm ready — Join call" button

Cuts ~80% of "I joined but no video" support tickets.

### `JoinLinkShareDialog`

Buttons:
- Copy participant link to clipboard
- "Send to patient via WhatsApp" — backend resends WA notification
- "Send to patient via SMS" — backend resends SMS
- "Send to patient via Email"

## VisitsTab.jsx changes

```diff
 const VISIT_TYPES = [
   { value: 'initial', label: 'Initial Visit' },
   { value: 'follow_up', label: 'Follow-Up' },
   { value: 'emergency', label: 'Emergency' },
-  { value: 'phone', label: 'Phone Call' },
+  { value: 'teleconsult', label: 'Teleconsult' },
 ];

-const VISIT_LOCATIONS = [
-  { value: 'home', label: 'Home' },
-  { value: 'opd', label: 'OPD' },
-  { value: 'ipd', label: 'IPD' },
-  { value: 'phone', label: 'Phone' },
-];
+const LOCATION_OPTIONS = {
+  default: [{ value: 'home', label: 'Home' }],
+  teleconsult: [
+    { value: 'video', label: 'Video Call' },
+    { value: 'voice', label: 'Voice Call' },
+  ],
+};
+
+const getLocationOptions = (visitType) =>
+  visitType === 'teleconsult' ? LOCATION_OPTIONS.teleconsult : LOCATION_OPTIONS.default;
```

New state:
```jsx
const [newVisit, setNewVisit] = useState({
  visit_type: 'follow_up',
  visit_date: today,
  visit_time: '10:00',          // NEW
  visit_location: 'home',
  provider_id: null,            // NEW — required when teleconsult
  record_call: false,           // NEW — only used when teleconsult+video
  notes: '',                    // NEW
  vitals_*: '',                  // existing
});
```

When `visit_type` changes to `teleconsult`:
- Reset `visit_location` to `'video'`
- Show `<ProviderSelect>` (required)
- Show `<TimePicker>` (required)
- Show "Record call" switch (only if location=video)

When `visit_type` changes back from `teleconsult`:
- Reset `visit_location` to `'home'`
- Hide provider/time/record fields

Submit:
```jsx
const handleCreateVisit = async () => {
  // 1. Existing: create patient_visit
  const visit = await saranamApi.createVisit(patientId, visitData);

  // 2. NEW: if teleconsult, schedule the tele_session
  if (newVisit.visit_type === 'teleconsult') {
    const scheduledAt = combineDateTime(newVisit.visit_date, newVisit.visit_time);
    await teleconsultApi.scheduleSession({
      patient_id: patientId,
      provider_id: newVisit.provider_id,
      channel: newVisit.visit_location, // 'video' or 'voice'
      scheduled_at: scheduledAt,
      record_call: newVisit.record_call,
      notes: newVisit.notes,
      linked_visit_id: visit.id,
    });
  }
  // 3. close + reload
};
```

Validation:
- If `visit_type='teleconsult'` and `provider_id` is null → block submit, inline error
- If `visit_time` empty → block submit
- Date+time must be in the future (allow ad-hoc immediate via separate button)

Dialog title changes:
- `visit_type='teleconsult'` → "Schedule Teleconsult"
- else → "New Visit"

## API client (`frontend/src/api/teleconsult.js`)

```js
import apiClient from './client';

export const teleconsultApi = {
  scheduleSession: (data) => apiClient.post('/teleconsult/sessions/schedule', data).then(r => r.data),
  initiateNow:     (data) => apiClient.post('/teleconsult/sessions/initiate-now', data).then(r => r.data),
  listSessions:    (params) => apiClient.get('/teleconsult/sessions', { params }).then(r => r.data),
  thisWeek:        () => apiClient.get('/teleconsult/sessions/this-week').then(r => r.data),
  getSession:      (id) => apiClient.get(`/teleconsult/sessions/${id}`).then(r => r.data),
  startSession:    (id) => apiClient.post(`/teleconsult/sessions/${id}/start`).then(r => r.data),
  endSession:      (id) => apiClient.post(`/teleconsult/sessions/${id}/end`).then(r => r.data),
  cancelSession:   (id) => apiClient.delete(`/teleconsult/sessions/${id}`).then(r => r.data),
  resendLink:      (id, recipient) => apiClient.post(`/teleconsult/sessions/${id}/resend-link`, { recipient }).then(r => r.data),
  getRecording:    (id) => apiClient.get(`/teleconsult/sessions/${id}/recording`).then(r => r.data),
  listProviders:   () => apiClient.get('/teleconsult/providers').then(r => r.data),
};
export default teleconsultApi;
```

## State management

- React Query (if already in repo) for `useTeleSessions`, `useTeleProviders`. If not present, plain `useEffect` + `useState` matching the existing `VisitsTab` pattern.
- Optimistic updates on schedule/cancel; revert on failure.

## Empty / error states

- No sessions this week → friendly empty state with `[+ Schedule New]` CTA
- No matching patients in search → "No patients match '<query>'"
- API error → inline alert with retry button
- iframe failure → fallback "Open in new tab" button with participant URL

## EnableX iframe sandbox

iframe `sandbox` attribute is intentionally **not** set, since EnableX needs `getUserMedia`. Required `allow`:
```
camera; microphone; fullscreen; display-capture; autoplay
```

CSP / `Permissions-Policy` headers must include `https://video.enablex.io` for `camera` and `microphone`. Update `vite.config.js` dev proxy / production CSP accordingly.

## Mobile responsiveness

- Page is desktop-first (clinical staff use laptops). On mobile (<768px):
  - PatientDirectory becomes list-only (no inline buttons; tap row → action sheet)
  - VideoCallRoom uses 100vh; PreCallCheck uses single-column
- Patient *receivers* on mobile use the EnableX-hosted page (not our app); their UX is provided by EnableX.

## Accessibility

- All buttons have `aria-label`
- ColorBlind-safe status badges (icons + text, not colour alone)
- Tab order: search → first patient → buttons
- iframe has `title="Video Consultation"`
