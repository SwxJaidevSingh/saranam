# Saranam India Health Care — Scheduling Module Test Plan

**Module:** Scheduling  **Module Code:** SCH  **Version:** 1.0
**Production URL:** https://saranam.fieldintel.ai
**Prepared:** 2026-06-01  **Test cycle / date executed:** _________________
**Tested by:** _________________  **Build / commit under test:** _________________

## Purpose & How to Use This Pack

This is a GO-LIVE manual test pack for the **Scheduling** module of the Saranam palliative / home health-care platform. Testers execute each case **manually in a browser** and record the outcome.

How to use:
1. Set up the prerequisite data in Section 5 first.
2. Work through the test cases in Section 6 top to bottom (they are grouped by screen/feature).
3. For each case, follow the numbered **Steps**, compare what you see against **Expected Result**, then fill in the last three columns: **Actual Result**, **Status** (Pass / Fail / Blocked / N/A) and **Remarks** (defect ID, screenshot ref, notes).
4. Use the API column to cross-check the network tab (DevTools) where a specific request/response must be verified.
5. Log every failure as a defect using the severity legend in Section 7 and obtain sign-off at the end.

The companion machine-readable file `scheduling_test_cases.json` contains the same cases for import into Excel / a test-management tool.

---

## 1. Scope

**Summary:** Go-live manual test pack for the Saranam India Health Care Scheduling module covering the weekly schedule lifecycle (draft -> submitted -> approved/communicated -> in_progress -> review_ready -> archived), weekly planning board with drag-and-drop visit assignment, route maps, vehicles/clusters/config settings, kit readiness, deviations, on-call roster, audit log, alerts, and the clinician My Visits / Today screens. Every screen, control, dialog, filter, map element and backend API call derived from the code is exercised, including validations, negative paths, empty/loading states, permissions/session and cross-module data integrity.

**In scope:**
- Schedule Calendar list view with status tabs (All/Draft/Submitted/Active/Archived) and ?status=pending deep link
- New Schedule and Quick Create flows + delete schedule
- Weekly Planning Board: patient pool sidebar, day columns, Add Patient modal, drag-and-drop move/reorder, route optimize, smart suggestions, team assignments, view toggles, route map
- Schedule lifecycle state transitions: submit / approve / send-back / activate / end-week-review / complete-review
- Validation on submit (warnings), capacity, time conflicts, travel warnings
- Schedule Settings: visit days, planning/approval deadlines, vehicle CRUD + add-hospital, cluster config
- Active Schedule Visits: per-day visit tracking (complete/missed/cancel), deviation reporting, route map, team & route segments
- My Visits (week) + acknowledge, Today's Visits (start/complete/missed)
- Kit Readiness per-day checklist, Deviation Report, Review Dashboard metrics, Audit Log, On-Call Roster CRUD, Unscheduled Alerts
- ScheduleDayMap rendering (markers, routes, hospital pins, zone overlay)
- All scheduling/* and visit API calls, auth/401 refresh handling
- PDF export (schedule PDF, weekly report)

**Out of scope:**
- Patient registration, demographics and UHID generation (covered by Patients module)
- Clinical assessment forms / AI summaries opened via Start Visit (covered by Visits module)
- Inventory, IPD/OPD, teleconsult, physiotherapy, homecare modules
- SMS/WhatsApp/email gateway delivery internals (only that approve triggers notification calls is verified)
- Backend route-optimization algorithm correctness beyond observable UI behaviour
- Zone wedge / pin-code mapping accuracy (pending client data per project memory)

**Test case count by section (118 total):**
- **Schedule Calendar** — 14
- **Weekly Planning Board** — 29
- **Lifecycle: Submit** — 3
- **Lifecycle: Approve** — 1
- **Lifecycle: Send Back** — 1
- **Lifecycle: Activate** — 1
- **Lifecycle: Review** — 1
- **Lifecycle: Disallowed transitions** — 1
- **Lifecycle: Status-gated controls** — 1
- **Schedule Settings** — 7
- **Active Schedule Visits** — 9
- **My Visits (clinician)** — 5
- **Today's Visits (clinician)** — 4
- **Kit Readiness** — 3
- **Deviation Report** — 3
- **Review Dashboard** — 3
- **Audit Log** — 5
- **On-Call Roster** — 4
- **Unscheduled Alerts** — 2
- **ScheduleDayMap** — 3
- **Permissions & Session** — 4
- **Validation & Negative** — 5
- **Data Integrity (cross-module)** — 4
- **Notifications & Acknowledgments** — 1
- **Patient Pool** — 2
- **Regression / Stability** — 2

---

## 2. Screens & Routes

| Screen | Route |
|--------|-------|
| Schedule Calendar (list) | `/saranam/scheduling` |
| Drafts & Approvals (Calendar, Submitted tab) | `/saranam/scheduling?status=pending` |
| Weekly Planning Board | `/saranam/scheduling/board/:scheduleId` |
| Schedule Settings | `/saranam/scheduling/settings` |
| My Visits (week) | `/saranam/scheduling/my-visits` |
| Today's Visits | `/saranam/scheduling/my-visits/today` |
| Active Schedule Visits | `/saranam/scheduling/active-visits` |
| Deviation Report | `/saranam/scheduling/deviation-report/:scheduleId` |
| Review Dashboard | `/saranam/scheduling/review-dashboard/:scheduleId` |
| Kit Readiness | `/saranam/scheduling/kit/:scheduleId` |
| Audit Log | `/saranam/scheduling/audit/:scheduleId` |
| On-Call Roster | `/saranam/scheduling/on-call` |
| Unscheduled Alerts | `/saranam/scheduling/alerts` |

> All routes are children of the app shell `/` and require an authenticated session. `:scheduleId` is a UUID. The "Drafts & Approvals" view is the Calendar with the `?status=pending` query (opens the Submitted tab).

---

## 3. Roles & Access

All scheduling routes are nested under <ProtectedRoute><DashboardLayout/></ProtectedRoute> in App.jsx with NO per-route requiredRole/requiredPermission attribute. Therefore any authenticated user (valid access_token in localStorage) can open every scheduling screen and call every scheduling endpoint; an unauthenticated user is redirected to /login by ProtectedRoute. There is no UI-level approver/planner role separation - the same user can submit AND approve a schedule (governance is by convention, not enforced). Every backend endpoint is decorated @jwt_required(); a missing/expired token returns 401 and the axios interceptor attempts a refresh, falling back to redirect to /login on failure. Note for testers: confirm with the client whether self-approval (planner approving own submission) should be blocked - currently it is allowed.

---

## 4. API Endpoints

All endpoints are prefixed with the API base (`VITE_API_URL`, default `/api`) and are JWT-protected. Bearer token is attached automatically by the axios request interceptor; a `401` triggers a token refresh then retry, or a redirect to `/login` if the refresh fails.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/saranam/scheduling/config` | Load schedule configuration (visit days, deadlines, capacity, thresholds) |
| PUT | `/api/saranam/scheduling/config` | Update schedule configuration |
| GET | `/api/saranam/scheduling/clusters` | List geographic clusters |
| POST | `/api/saranam/scheduling/clusters` | Create cluster (name required -> 400 if missing) |
| PUT | `/api/saranam/scheduling/clusters/{id}` | Update cluster (404 if not found) |
| DELETE | `/api/saranam/scheduling/clusters/{id}` | Deactivate cluster (404 if not found) |
| GET | `/api/saranam/scheduling/vehicles` | List vehicles |
| POST | `/api/saranam/scheduling/vehicles` | Create vehicle (name required -> 400; invalid -> 400 invalid_request) |
| PUT | `/api/saranam/scheduling/vehicles/{id}` | Update vehicle (404 if not found) |
| GET | `/api/saranam/scheduling/schedules` | List schedules (params: status, vehicle_id, week_start_date, from_date, to_date, page, per_page) |
| POST | `/api/saranam/scheduling/schedules` | Create schedule (week_start_date + vehicle_id required -> 400; ValueError -> 400) |
| GET | `/api/saranam/scheduling/schedules/{id}` | Get full schedule with days/slots/team/warnings (404 if not found) |
| DELETE | `/api/saranam/scheduling/schedules/{id}` | Delete schedule (404 if not found; 400 if not deletable) |
| GET | `/api/saranam/scheduling/schedules/{id}/validate` | Validate schedule, returns warnings/messages (404 if not found) |
| POST | `/api/saranam/scheduling/schedules/{id}/submit` | Submit draft for approval (body note; 400 on invalid transition) |
| POST | `/api/saranam/scheduling/schedules/{id}/approve` | Approve submitted schedule (body note; triggers team + patient notifications; 400 on invalid transition) |
| POST | `/api/saranam/scheduling/schedules/{id}/send-back` | Send schedule back to draft (reason required -> 400) |
| POST | `/api/saranam/scheduling/schedules/{id}/activate` | Activate communicated schedule (400 on invalid transition) |
| POST | `/api/saranam/scheduling/schedules/{id}/review-ready` | Transition in_progress -> review_ready (400 on invalid transition) |
| POST | `/api/saranam/scheduling/schedules/{id}/complete-review` | Complete review + archive (body review_notes; 400 on invalid transition) |
| PUT | `/api/saranam/scheduling/days/{dayId}` | Update day (e.g. kit_ready, day_note) (404 if not found) |
| POST | `/api/saranam/scheduling/days/{dayId}/slots` | Add patient slot to a day (patient_id required -> 400; ValueError -> 400) |
| PUT | `/api/saranam/scheduling/slots/{slotId}` | Update slot (status/time/duration/missed_reason/cancelled_reason) (404 if not found) |
| POST | `/api/saranam/scheduling/slots/{slotId}/move` | Move slot to another day (to_day_id required -> 400; ValueError -> 400) |
| DELETE | `/api/saranam/scheduling/slots/{slotId}` | Remove patient slot (body reason; ValueError -> 400) |
| POST | `/api/saranam/scheduling/days/{dayId}/reorder` | Reorder slots within a day (slot_ids required -> 400) |
| PUT | `/api/saranam/scheduling/days/{dayId}/team` | Set team assignments for a day/vehicle (assignments required -> 400; ValueError -> 400) |
| GET | `/api/saranam/scheduling/available-team` | List available providers (params date, role) |
| GET | `/api/saranam/scheduling/patient-pool` | List patient pool (params care_status, complexity, exclude_scheduled_week, search, sort_by, page, per_page) |
| PUT | `/api/saranam/scheduling/patient-pool/{patientId}` | Update patient scheduling meta (404 if meta missing) |
| POST | `/api/saranam/scheduling/patient-pool/{patientId}/flag` | Flag/unflag patient (body flagged, reason) (404 if meta missing) |
| POST | `/api/saranam/scheduling/patient-pool/recalculate-priorities` | Recalculate priority scores for all patients |
| POST | `/api/saranam/scheduling/patient-pool/ensure/{patientId}` | Ensure scheduling meta row exists for a patient (404 if patient missing) |
| GET | `/api/saranam/scheduling/my-schedule` | Get logged-in clinician's weekly schedule (param week_start_date; 404 if none) |
| GET | `/api/saranam/scheduling/my-schedule/today` | Get logged-in clinician's visits for today (200 with empty payload if none) |
| GET | `/api/saranam/scheduling/notifications` | List notifications (params schedule_id, unread_only, page, per_page) |
| GET | `/api/saranam/scheduling/notifications/unread-count` | Get unread notification count |
| PUT | `/api/saranam/scheduling/notifications/mark-all-read` | Mark all notifications read |
| PUT | `/api/saranam/scheduling/notifications/{id}/read` | Mark one notification read (404 if not found) |
| POST | `/api/saranam/scheduling/schedules/{id}/acknowledge` | Clinician acknowledges schedule |
| GET | `/api/saranam/scheduling/schedules/{id}/acknowledgments` | List acknowledgments for a schedule |
| GET | `/api/saranam/scheduling/schedules/{id}/review` | Get review metrics for a schedule (404 if not found) |
| POST | `/api/saranam/scheduling/days/{dayId}/deviations` | Create deviation (deviation_type + description required -> 400) |
| GET | `/api/saranam/scheduling/schedules/{id}/deviations` | List deviations for a schedule (404 if not found) |
| GET | `/api/saranam/scheduling/schedules/{id}/export-data` | Get decrypted full schedule data for PDF export (404 if not found) |
| GET | `/api/saranam/scheduling/schedules/{id}/audit-log` | Get audit log (params action, page, per_page) |
| GET | `/api/saranam/scheduling/on-call` | Get on-call roster (param week_start_date) |
| POST | `/api/saranam/scheduling/on-call` | Create on-call roster entry |
| PUT | `/api/saranam/scheduling/on-call/{id}` | Update on-call roster entry (404 if not found) |
| DELETE | `/api/saranam/scheduling/on-call/{id}` | Delete on-call roster entry (404 if not found) |
| GET | `/api/saranam/scheduling/alerts/unscheduled` | List unscheduled/overdue patient alerts (param week_start_date) |
| POST | `/api/auth/refresh` | Refresh access token on 401 (axios response interceptor) |

---

## 5. Test Data / Preconditions

- Valid login credentials for an authenticated Saranam user (token stored in localStorage as access_token + refresh_token)
- At least one Vehicle configured in Settings (e.g. 'Saranam Van 1', reg KA-01-AB-1234, base hospital KMIO) - required to create any schedule
- A second Vehicle (e.g. 'Saranam Van 2', base KCGH) to test multi-vehicle grouping, suggestions and map colours
- 20+ patients in the pool with mix of: BSC/non-BSC, Onco/Non-Onco, with GPS lat/lng, with address-only (no GPS), is_new=true, days_since_last_visit values 0/22/35 (for approaching/overdue badges), geographic_cluster set to North/South/East/West/Central
- At least one patient with NO GPS and NO address (to test map 'without location & address' state)
- Several providers/clinicians with specializations Physician, Nursing, Counselor, Physiotherapy, Driver
- One DRAFT schedule (with days/slots) for board, submit, delete, audit tests
- One SUBMITTED schedule for approve/send-back tests
- One COMMUNICATED schedule for Activate test
- One IN_PROGRESS / active schedule with slots for Active Visits, kit, deviation tests
- One REVIEW_READY schedule for Review Dashboard / complete-review test
- Known invalid scheduleId GUID (e.g. 00000000-0000-0000-0000-000000000000) and a malformed non-GUID id for negative URL tests
- Test dates around June 2026 (week start Mon 2026-06-01, 2026-06-08); a past week (2026-05-04) for past-scheduling test
- VITE_GOOGLE_MAPS_KEY configured so ScheduleDayMap renders (else map shows loading/blank)

---

## 6. Test Cases

> Steps are numbered within each cell. Fill **Actual Result**, **Status** and **Remarks** during execution. Status values: Pass / Fail / Blocked / N/A.

| ID | Section | Title | Priority | Type | Preconditions | Steps | Test Data | Expected Result | API | Actual Result | Status | Remarks |
|----|---------|-------|----------|------|---------------|-------|-----------|-----------------|-----|---------------|--------|---------|
| SCH-001 | Schedule Calendar | Calendar page loads with header, tabs and schedule list | High | Functional | Logged in; at least one schedule and one vehicle exist. | 1. Navigate to /saranam/scheduling<br>2. Wait for the spinner to finish | N/A | Header 'Schedule Calendar / Weekly schedule overview' shows with Calendar icon. Refresh, Quick Create and New Schedule buttons render. Five status tabs (All, Draft, Submitted, Active, Archived) each show a count badge. The schedule table lists Week, Status, Patients, Days, Actions columns sorted newest week first. | GET /api/saranam/scheduling/schedules?per_page=100 and GET /api/saranam/scheduling/vehicles |  |  |  |
| SCH-002 | Schedule Calendar | Status tab filtering segregates schedules correctly | High | Functional | Schedules exist in draft, submitted, approved/in_progress and archived statuses. | 1. On the calendar, click each tab: All, Draft, Submitted, Active, Archived | N/A | Draft tab shows only status=draft; Submitted only submitted; Active shows approved/communicated/in_progress/review_ready; Archived only archived; All shows everything. Counts in tab badges match the rows shown. | N/A (client-side filter of GET /schedules result) |  |  |  |
| SCH-003 | Schedule Calendar | Deep link ?status=pending opens the Submitted tab (Drafts & Approvals) | High | Functional | Logged in. | 1. Navigate directly to /saranam/scheduling?status=pending | URL query status=pending | Page opens with the Submitted tab pre-selected (activeTab index 1), listing only submitted schedules awaiting approval. | GET /api/saranam/scheduling/schedules?per_page=100 |  |  |  |
| SCH-004 | Schedule Calendar | Refresh button reloads schedules and vehicles | Medium | Functional | Calendar loaded. | 1. Create/modify a schedule in another tab<br>2. Click Refresh on the calendar | N/A | List re-fetches and reflects the latest data; spinner shows briefly during load. | GET /api/saranam/scheduling/schedules + GET /api/saranam/scheduling/vehicles |  |  |  |
| SCH-005 | Schedule Calendar | New Schedule dialog creates a schedule and opens the board | High | Functional | At least one vehicle configured. | 1. Click New Schedule<br>2. In the dialog pick Week Start Date 2026-06-08<br>3. Click Create | Week Start = 2026-06-08 | Schedule is created (uses vehicles[0]) and the app navigates to /saranam/scheduling/board/<newId>. Dialog closes and Create shows 'Creating...' while saving. | POST /api/saranam/scheduling/schedules {week_start_date, vehicle_id} |  |  |  |
| SCH-006 | Schedule Calendar | Create is disabled until a week start date is chosen | Medium | Validation | New Schedule dialog open. | 1. Open New Schedule dialog<br>2. Leave Week Start Date empty<br>3. Observe the Create button | Empty date | Create button is disabled while the date field is empty; enabling only after a date is selected. | N/A |  |  |  |
| SCH-007 | Schedule Calendar | Quick Create makes a schedule for the current week's Monday | Medium | Functional | At least one vehicle configured. | 1. Click Quick Create | N/A (today 2026-06-01 -> Monday 2026-06-01) | A schedule for the current week's Monday is created with vehicles[0] and the board opens. Button shows disabled state while creating. | POST /api/saranam/scheduling/schedules |  |  |  |
| SCH-008 | Schedule Calendar | Create blocked when no vehicles configured | High | Negative | No vehicles exist (delete/avoid configuring any). | 1. Click Quick Create (or New Schedule -> pick date -> Create) | N/A | An error banner shows 'No vehicles configured. Add a vehicle in Settings first.' and no schedule is created/navigation occurs. | N/A (guarded client-side before POST) |  |  |  |
| SCH-009 | Schedule Calendar | Open / View action navigates by status | Medium | Functional | Schedules in various statuses exist. | 1. Click a non-review_ready row (or its Open button)<br>2. Go back, click a review_ready row<br>3. Go back, observe an archived row's button label | N/A | Non review_ready rows open /board/:id. review_ready rows open /review-dashboard/:id. Archived rows show 'View' label (others show 'Open'). | N/A (navigation) |  |  |  |
| SCH-010 | Schedule Calendar | Schedule PDF download (Schedule button) | Medium | Functional | A schedule with patient slots exists. | 1. On a row click the 'Schedule' (Download) button | N/A | Export data is fetched and a schedule PDF is generated/downloaded. On a PDF generation error an error banner 'PDF generation failed: ...' is shown. | GET /api/saranam/scheduling/schedules/{id}/export-data |  |  |  |
| SCH-011 | Schedule Calendar | Weekly Report button only on active/completed schedules | Medium | Functional | An active/in_progress/review_ready/completed schedule with deviations exists; also a draft schedule exists. | 1. Locate an active schedule row -> click 'Report'<br>2. Locate a draft schedule row and confirm no Report button | N/A | Report button appears only for active/in_progress/review_ready/completed rows; clicking fetches schedule detail + deviations and generates the weekly report PDF. Draft/submitted rows have no Report button. On failure an alert 'Failed to generate report' shows. | GET /schedules/{id} + GET /schedules/{id}/deviations |  |  |  |
| SCH-012 | Schedule Calendar | Delete schedule with confirmation removes it | High | Functional | A deletable schedule exists. | 1. Click the red trash icon on a row<br>2. Confirm the browser confirm dialog warning about removing assignments, team and audit logs | N/A | On confirm the schedule is deleted and the list reloads without it. Cancelling the confirm leaves it intact. On backend error an error banner appears. | DELETE /api/saranam/scheduling/schedules/{id} |  |  |  |
| SCH-013 | Schedule Calendar | Empty state when no schedules in a tab | Low | UI/UX | A tab with zero matching schedules (e.g. Archived empty). | 1. Open a tab that has no schedules | N/A | A centred empty state with calendar icon, 'No schedules found' and a 'Create Schedule' button is shown. | N/A |  |  |  |
| SCH-014 | Schedule Calendar | List load failure shows error banner | Medium | Negative | Ability to simulate API failure (e.g. backend down / 500). | 1. With the schedules API failing, navigate to /saranam/scheduling | N/A | A dismissible error Alert 'Failed to load schedules' is shown; the page does not crash. | GET /api/saranam/scheduling/schedules |  |  |  |
| SCH-015 | Weekly Planning Board | Board loads draft schedule with sidebar, day columns and map | High | Functional | A draft schedule with days exists; patient pool populated. | 1. Open /saranam/scheduling/board/:scheduleId for a draft<br>2. Wait for schedule then pool to hydrate | N/A | Header shows 'Weekly Planning', vehicle chip, status badge (Draft) and week range. Patient pool sidebar (draft only), day columns and the right route map render in Split View. A LinearProgress saving bar appears only during saves. | GET /schedules/{id}; GET /patient-pool?per_page=150; GET /vehicles; GET /available-team; GET /config; POST /patient-pool/recalculate-priorities |  |  |  |
| SCH-016 | Weekly Planning Board | Loading and progressive hydration states | Medium | UI/UX | Draft schedule. | 1. Open the board and observe loading text<br>2. Observe the sidebar while pool loads | N/A | Full-page 'Loading schedule...' spinner with step text ('Fetching schedule' then 'Loading patient pool') until schedule lands; once board renders the sidebar shows its own 'Loading patient pool...' spinner until the pool fetch completes. | GET /schedules/{id}; GET /patient-pool |  |  |  |
| SCH-017 | Weekly Planning Board | Board load failure for missing/invalid scheduleId | High | Negative | Logged in. | 1. Open /saranam/scheduling/board/00000000-0000-0000-0000-000000000000 | Non-existent GUID | An error screen with AlertCircle icon, the error message and a 'Go Back' button is shown (backend returns 404 'Schedule not found'). | GET /api/saranam/scheduling/schedules/{id} -> 404 |  |  |  |
| SCH-018 | Weekly Planning Board | Board with malformed (non-GUID) scheduleId | Low | Negative | Logged in. | 1. Open /saranam/scheduling/board/not-a-guid | scheduleId = 'not-a-guid' | Backend route (uuid converter) does not match / returns error; the board surfaces a load error rather than crashing. | GET /schedules/{id} |  |  |  |
| SCH-019 | Weekly Planning Board | Patient pool search filters by name and zone | Medium | Functional | Draft board with multiple pool patients. | 1. Type a patient name fragment in the sidebar search<br>2. Clear and type a zone like 'North' | Search 'Lakshmi'; then 'North' | Sidebar list narrows to patients whose name or cluster matches (case-insensitive). The 'N patients in pool' count updates. | N/A (client filter of loaded pool) |  |  |  |
| SCH-020 | Weekly Planning Board | Patient pool filter chips (BSC/Onco combinations + NEW) | Medium | Functional | Pool has each combination of BSC/Onco and at least one is_new patient. | 1. Click each chip: All, BSC Onco, Non-BSC Onco, BSC Non-Onco, Non-BSC Non-Onco, NEW | N/A | List filters to the chosen segment; NEW shows only is_new patients. NEW patients render in a blue highlighted 'New - Needs First Visit' group, suggested ones in an orange 'Suggested for this week' group. | N/A (client filter) |  |  |  |
| SCH-021 | Weekly Planning Board | Pool 'Show more' pagination reveals additional patients | Low | Functional | More than 20 non-suggested patients in pool. | 1. Scroll the 'All Patients' section<br>2. Click 'Show more (N remaining)' | N/A | 20 more cards are appended each click; the remaining count decreases until all are shown. | N/A |  |  |  |
| SCH-022 | Weekly Planning Board | Quick add patient to a day via sidebar day buttons | High | Functional | Draft board. | 1. On a sidebar patient card click an unscheduled day button (e.g. 'Wed') | N/A | The Add Patient modal opens pre-filled with that patient and day. (Already-scheduled days show green and are disabled.) | N/A (opens modal) |  |  |  |
| SCH-023 | Weekly Planning Board | Add Patient modal adds a slot with time/duration/vehicle/notes | High | Functional | Draft board; vehicles configured. | 1. Click 'Add Patient to Day'<br>2. Search & select a patient, select a day<br>3. Pick a vehicle, set duration 45, select an available time slot, add a note<br>4. Click 'Add to Schedule' | Duration 45, time 10:00, note 'First visit, wound care' | Slot is created on the chosen day with the chosen vehicle/time/duration/note; the board refreshes and the slot card shows time, duration and vehicle. Modal closes. | POST /api/saranam/scheduling/days/{dayId}/slots {patient_id, scheduled_time, visit_duration_minutes, vehicle_id, exception_note} |  |  |  |
| SCH-024 | Weekly Planning Board | Add to Schedule disabled without patient and day | Medium | Validation | Add Patient modal open. | 1. Open modal but do not select a patient and/or day<br>2. Observe the Add to Schedule button | N/A | Add to Schedule button is disabled until both a patient and a day are selected. | N/A |  |  |  |
| SCH-025 | Weekly Planning Board | Visit duration is clamped to 15-180 minutes | Low | Validation | Add Patient modal open. | 1. Type 5 then 999 then 'abc' in the Visit Duration field | 5, 999, abc | Duration clamps to a minimum of 15 and maximum of 180; non-numeric input falls back to 60. | N/A |  |  |  |
| SCH-026 | Weekly Planning Board | Occupied time slots are disabled (double-book prevention) | High | Validation | A day already has a slot at e.g. 10:00 for 60 min on a vehicle. | 1. Open Add Patient modal, select that day and the same vehicle<br>2. Inspect the time slot grid | Existing 10:00 / 60 min visit | Times overlapping the existing visit (10:00, 10:30) appear struck-through and disabled for the same vehicle; selecting a different vehicle frees those slots (independent vehicle timelines). | N/A (client conflict check) |  |  |  |
| SCH-027 | Weekly Planning Board | Time conflict warning when overlapping an existing visit | Medium | Validation | Day with an existing visit. | 1. Pick a duration and a start time that overlaps the existing visit window | N/A | An amber warning Alert 'This time overlaps with an existing visit - there may be a conflict.' is shown. | N/A |  |  |  |
| SCH-028 | Weekly Planning Board | Travel-time warnings flag tight slots (red/amber) | Medium | Edge Case | Day already has GPS patients with scheduled times; selected patient has GPS far away. | 1. Select a far patient and day with existing timed visits<br>2. Hover time slots and observe markers + selecting a tight slot | Far-apart GPS patients | Time slots that cannot be reached in time show a red/amber dot and tooltip estimating travel minutes/distance; selecting one shows a 'Travel warning' Alert. | N/A (client haversine estimate) |  |  |  |
| SCH-029 | Weekly Planning Board | Distance-to-scheduled-patients and hospital distance display | Low | UI/UX | Selected patient and day have GPS; other timed patients on day have GPS. | 1. In Add Patient modal select a patient with GPS and a day with other GPS patients | N/A | Selected patient card shows distance from its linked hospital (green tick within radius / amber cross outside) and a list of km distances to other patients already scheduled that day. | N/A |  |  |  |
| SCH-030 | Weekly Planning Board | Smart vehicle suggestion appears in Add Patient modal | Low | Functional | Two+ vehicles; day has slots on one vehicle in the patient's zone. | 1. Select a patient whose zone matches a vehicle already routed that day | N/A | A blue 'Use <Vehicle>' suggestion banner appears explaining the vehicle already has same-zone patients; clicking it sets the vehicle dropdown. | N/A |  |  |  |
| SCH-031 | Weekly Planning Board | Drag-and-drop move slot across days | High | Functional | Draft board with a slot on Monday. | 1. Drag a slot card from the Monday column and drop it onto the Wednesday column | N/A | Slot moves to Wednesday; saving bar shows; board reloads with the slot now under Wednesday. | POST /api/saranam/scheduling/slots/{slotId}/move {to_day_id, new_slot_order:0} |  |  |  |
| SCH-032 | Weekly Planning Board | Drag-and-drop reorder slots within a day | High | Functional | Draft board with 2+ slots on the same day. | 1. Drag a slot above/below another within the same day column<br>2. Observe the live km preview while dragging then drop | N/A | Order changes and persists; during drag a route km preview (current -> preview, with delta) shows in the day header. Reorder is saved. | POST /api/saranam/scheduling/days/{dayId}/reorder {slot_ids:[...]} |  |  |  |
| SCH-033 | Weekly Planning Board | Drag-and-drop is disabled for non-draft schedules | Medium | Permission | A submitted/approved/in_progress schedule open on the board. | 1. Open a non-draft schedule and attempt to drag a slot | N/A | Slots are not draggable (no grip handle / drag ignored); sidebar pool is hidden; no move/reorder API fires. Slot remove (X) is also hidden. | N/A |  |  |  |
| SCH-034 | Weekly Planning Board | Remove a slot from a day (draft only) | High | Functional | Draft board with slots. | 1. Hover a slot card and click the X remove icon | Reason auto 'Removed from planning board' | Slot is removed; board reloads without it. Audit entry created server-side. | DELETE /api/saranam/scheduling/slots/{slotId} {reason} |  |  |  |
| SCH-035 | Weekly Planning Board | Optimize route button reorders by nearest-neighbour / Google | Medium | Functional | Draft day with 2+ GPS patients. | 1. Click the Route (optimize) icon in a day header | N/A | Slots reorder for shortest route; a flash badge shows before -> after km and km saved for ~5s. Uses Google Directions optimizeWaypoints when Maps loaded, else nearest-neighbour fallback. | POST /api/saranam/scheduling/days/{dayId}/reorder |  |  |  |
| SCH-036 | Weekly Planning Board | Suggest Patients on an empty day proposes zone-based assignments | Medium | Functional | Draft board; an empty day; unscheduled GPS patients in pool. | 1. On an empty day click 'Suggest Patients'<br>2. Review recommendation options | N/A | A Recommendations panel lists zone options each with estimated total km and per-vehicle patient breakdown, sorted by lowest km. 'All patients are scheduled' shows when none remain. Dismiss closes the panel. | N/A (client computation over pool) |  |  |  |
| SCH-037 | Weekly Planning Board | Accept a suggestion adds patients with sequential times | Medium | Functional | Suggestion panel open with at least one option. | 1. Click 'Accept (N patients, M vehicles)' on an option | N/A | Each suggested patient is added to the day with its vehicle, starting 09:00 and incrementing hourly, duration 60; board reloads and panel closes. | POST /api/saranam/scheduling/days/{dayId}/slots (one call per patient) |  |  |  |
| SCH-038 | Weekly Planning Board | Capacity indicator turns warning/error as day fills | Medium | UI/UX | Config max_patients_per_vehicle_per_day known; multiple vehicles. | 1. Add patients to a day until count equals then exceeds maxPatients (max_per_vehicle x vehicles) | N/A | The N/max chip is default below max, warning (amber) at max, and error (red) above max. The backend still accepts adds (soft limit / UI warning). | N/A |  |  |  |
| SCH-039 | Weekly Planning Board | Team assignment add/remove per day and vehicle | High | Functional | Board with slots; providers with specializations exist. | 1. Expand 'Team Assignments'<br>2. For a day/vehicle click 'Add Team Member', pick a specialization then a provider<br>3. Then remove one member via its X | Specialization 'Nursing' -> provider e.g. 'Sr. Mary Joseph' | Member is added under the day/vehicle and persists after reload; removing posts the updated assignments list. Each vehicle group shows its own team when multiple vehicles are used. | PUT /api/saranam/scheduling/days/{dayId}/team {assignments, vehicle_id} |  |  |  |
| SCH-040 | Weekly Planning Board | View toggle Split / Schedule Only / Map Only | Low | UI/UX | Board with days having patients. | 1. Click Split View, then Schedule Only, then Map Only | N/A | Split shows columns + side map; Schedule Only hides the map; Map Only shows a full-width route map. Active toggle is highlighted blue. | N/A |  |  |  |
| SCH-041 | Weekly Planning Board | Route map day navigation (prev/next) and day selection | Medium | Functional | Board with multiple days. | 1. Click a day column to select it (map updates)<br>2. Use the map's ChevronLeft/Right to step through days<br>3. Confirm arrows disable at first/last day | N/A | Map shows the selected day's slots; clicking a column or prev/next changes the mapped day; left arrow disabled on first day, right arrow on last. | N/A |  |  |  |
| SCH-042 | Weekly Planning Board | Stats bar: BSC coverage, scheduled count, cluster efficiency, overdue alerts | Medium | Functional | Pool with BSC patients and patients with days_since_last_visit >=20 and >=30. | 1. Observe the stats bar at the top of the board | N/A | Shows overdue (30d+) and approaching (20-29d) alert chips when present, BSC coverage progress + ratio %, total patients scheduled, average cluster efficiency %, and hospital/service-radius info. | N/A (derived from /schedules + /patient-pool) |  |  |  |
| SCH-043 | Weekly Planning Board | Refresh on board re-fetches schedule, pool and team | Low | Functional | Board open. | 1. Click the RefreshCw icon in the board header | N/A | Schedule, pool and team reload; saving/loading indicators show briefly; UI reflects latest data. | GET /schedules/{id}; GET /patient-pool; GET /available-team |  |  |  |
| SCH-044 | Lifecycle: Submit | Submit for Approval shows validation then submits (draft -> submitted) | High | Functional | Open a draft schedule with assignments. | 1. Click 'Submit for Approval'<br>2. Review validation warnings/messages in the dialog<br>3. Add an optional note<br>4. Click Submit | Note 'Ready for Dr. review' | Validation runs first; dialog lists warnings (or 'validation passed with no warnings'). On Submit the status changes to Submitted, header buttons switch to Approve/Send Back, and the board reloads. | GET /schedules/{id}/validate then POST /schedules/{id}/submit {note} |  |  |  |
| SCH-045 | Lifecycle: Submit | Submit validation warnings render with severity styling | Medium | Functional | Draft with conditions that trigger warnings (e.g. low BSC coverage, empty days). | 1. Click Submit for Approval and read the dialog | N/A | Each warning/message shows with critical/warning/info icon and colour from the validate response; empty validation shows a green success Alert. | GET /schedules/{id}/validate |  |  |  |
| SCH-046 | Lifecycle: Submit | Submit failure surfaces backend error | Medium | Negative | A schedule not in a submittable state (e.g. already submitted) or backend rejects. | 1. Trigger submit when backend returns 400 | N/A | Error banner shows the backend error message (e.g. invalid transition); status unchanged. | POST /schedules/{id}/submit -> 400 |  |  |  |
| SCH-047 | Lifecycle: Approve | Approve a submitted schedule (submitted -> approved/communicated) and notify | High | Functional | Open a submitted schedule on the board. | 1. Click Approve<br>2. Add optional approval note<br>3. Confirm Approve | Approval note 'Approved by lead' | Status advances (approved/communicated); team and patient notifications are triggered server-side; board reloads showing the new status and acknowledgments become available. | POST /schedules/{id}/approve {note} (triggers notify_team_on_approval + notify_patients_on_communication) |  |  |  |
| SCH-048 | Lifecycle: Send Back | Send Back requires a reason and returns to draft | High | Validation | Open a submitted schedule. | 1. Click Send Back<br>2. Leave reason empty and observe button<br>3. Enter a reason and confirm | Reason 'Tuesday over capacity, rebalance' | Send Back button is disabled while the reason is empty; with a reason the schedule returns to draft/sent_back and the board reloads. Backend returns 400 'Reason is required' if forced without reason. | POST /schedules/{id}/send-back {reason} |  |  |  |
| SCH-049 | Lifecycle: Activate | Activate a communicated schedule (communicated -> in_progress) | High | Functional | Open a communicated schedule. | 1. Click 'Activate Schedule' | N/A | Schedule becomes active/in_progress; the board reloads; an 'End Week & Review' button now appears for in_progress. | POST /schedules/{id}/activate |  |  |  |
| SCH-050 | Lifecycle: Review | End Week & Review transitions in_progress -> review_ready and navigates | High | Functional | Open an in_progress schedule. | 1. Click 'End Week & Review' | N/A | Status transitions to review_ready and the app navigates to /saranam/scheduling/review-dashboard/:scheduleId. | POST /schedules/{id}/review-ready |  |  |  |
| SCH-051 | Lifecycle: Disallowed transitions | Disallowed lifecycle transitions are blocked | High | Negative | Schedules in various statuses. | 1. Attempt to approve a draft (force POST /approve)<br>2. Attempt to activate a draft<br>3. Attempt to submit an already-submitted schedule | N/A | Each invalid transition returns 400 with an error message; status is unchanged. In the UI the corresponding buttons are not even shown for the wrong status (e.g. Approve only for submitted, Activate only for communicated). | POST /schedules/{id}/approve\|activate\|submit -> 400 |  |  |  |
| SCH-052 | Lifecycle: Status-gated controls | Header controls match schedule status | Medium | UI/UX | Schedules in draft, submitted, communicated, in_progress. | 1. Open each status on the board and note the action buttons | N/A | Draft: Add Patient + Submit for Approval. Submitted: Approve + Send Back. Communicated: Activate Schedule. In_progress: End Week & Review. Sidebar pool/DND only for draft & sent_back. | N/A |  |  |  |
| SCH-053 | Schedule Settings | Settings page loads config, vehicles (and cluster section) | High | Functional | Logged in. | 1. Navigate to /saranam/scheduling/settings | N/A | Config loads into Visit Days checkboxes and Planning & Approval fields; Vehicles list renders with base hospital chips. Save Settings button present. (Capacity/Threshold/Cluster panels are commented out in current build - confirm not visible.) | GET /config; GET /clusters; GET /vehicles |  |  |  |
| SCH-054 | Schedule Settings | Save scheduling config (visit days + deadlines) | High | Functional | Settings loaded. | 1. Toggle visit-day checkboxes<br>2. Set Planning Day, Planning Deadline Time, Approval Deadline Day & Time<br>3. Click Save Settings | Visit days Mon-Fri; Planning Day Thursday 17:00; Approval Sunday 12:00 | A green 'Settings saved successfully.' Alert shows (auto-dismiss ~3s); reloading the page retains the saved values. | PUT /api/saranam/scheduling/config |  |  |  |
| SCH-055 | Schedule Settings | Add a vehicle (name required) with base hospital | High | Functional | Settings loaded. | 1. Click Add Vehicle<br>2. Enter name + registration, choose Base Hospital<br>3. Click Create | Name 'Saranam Van 2', reg KA-05-CD-6789, base KCGH | Vehicle is created and appears in the list with a 'Base: KCGH' chip. Create button is disabled when name is empty; backend returns 400 if name missing. | POST /api/saranam/scheduling/vehicles |  |  |  |
| SCH-056 | Schedule Settings | Edit an existing vehicle | Medium | Functional | At least one vehicle exists. | 1. Click the pencil on a vehicle row<br>2. Change name/reg/base hospital<br>3. Click Update | Change base to KMIO | Vehicle updates and the row reflects the new values. 404 returned if the id no longer exists. | PUT /api/saranam/scheduling/vehicles/{id} |  |  |  |
| SCH-057 | Schedule Settings | Inline Add Hospital from vehicle dialog | Medium | Functional | Vehicle dialog open. | 1. Click the + next to Base Hospital<br>2. Enter Code 'MSR' (homecare prefix auto KAGBAMSR) and Name<br>3. Click Add | Code MSR, Name 'M.S. Ramaiah Memorial' | New hospital is added to the master list and selected as the vehicle's base; homecare prefix auto-derives as KAGBA+code unless edited. Add disabled until code+name present. | useHospitalOptions add (hospital master API) |  |  |  |
| SCH-058 | Schedule Settings | Cluster create/edit/delete (if cluster panel enabled) | Low | Functional | Cluster panel visible (currently commented out - verify build). | 1. If visible: Add Cluster with name/color/pin codes, then edit, then delete (confirm dialog) | Name 'North', color #3b82f6, pins 560001,560002 | Cluster CRUD works: create -> list; edit -> updated; delete (confirm) -> removed. Create disabled when name empty. If the panel is not rendered in this build, mark N/A. | POST/PUT/DELETE /api/saranam/scheduling/clusters |  |  |  |
| SCH-059 | Schedule Settings | Settings load failure shows error | Low | Negative | Simulate config/vehicles API failure. | 1. Open settings with the API failing | N/A | A red Alert 'Failed to load settings. <reason>' is shown; the page does not crash. | GET /config\|/clusters\|/vehicles |  |  |  |
| SCH-060 | Active Schedule Visits | Active Visits auto-selects the active/in_progress schedule | High | Functional | An active/in_progress schedule exists (else approved). | 1. Navigate to /saranam/scheduling/active-visits | N/A | The first active/in_progress schedule (or approved fallback) loads, showing header with week/vehicle/status, total patients and visit days, day tabs, the day's patient list and a route map. | GET /schedules?per_page=100 then GET /schedules/{id} + GET /schedules/{id}/deviations |  |  |  |
| SCH-061 | Active Schedule Visits | No active schedule empty state | Medium | UI/UX | No active/in_progress/approved schedules. | 1. Open /saranam/scheduling/active-visits | N/A | Empty state 'No Active Schedule' with explanation and a 'Go to Calendar' button is shown. | GET /schedules |  |  |  |
| SCH-062 | Active Schedule Visits | Day tabs switch the listed patients and route | Medium | Functional | Active schedule with multiple days having patients. | 1. Click different day tabs; use the map prev/next arrows | N/A | Patient list and route map update to the selected day; days with patients show a count; route total km and segments recompute. | N/A |  |  |  |
| SCH-063 | Active Schedule Visits | Complete a visit updates slot status | High | Functional | Active schedule with a scheduled/in_progress slot. | 1. On a slot click 'Complete' | N/A | Slot status becomes completed (green 'Visit completed' line with time if available); schedule reloads. | PUT /api/saranam/scheduling/slots/{slotId} {status:'completed'} |  |  |  |
| SCH-064 | Active Schedule Visits | Mark a visit missed with reason + notes | High | Functional | Active schedule slot. | 1. Click 'Missed'<br>2. Pick a reason (e.g. 'Patient not home'), add notes<br>3. Confirm Missed | Reason 'Patient not home', notes 'Door locked' | Confirm disabled until a reason is chosen; slot becomes missed showing the combined reason; schedule reloads. | PUT /slots/{slotId} {status:'missed', missed_reason} |  |  |  |
| SCH-065 | Active Schedule Visits | Cancel a visit with reason | Medium | Functional | Active schedule slot. | 1. Click 'Cancel', enter a cancellation reason, Confirm Cancel | Reason 'Patient admitted to IPD' | Confirm disabled until reason entered; slot becomes cancelled showing the reason; schedule reloads. | PUT /slots/{slotId} {status:'cancelled', cancelled_reason} |  |  |  |
| SCH-066 | Active Schedule Visits | Report Deviation (non-emergency) from a day | High | Functional | Active schedule day selected. | 1. Click 'Report Deviation'<br>2. Select type 'Route Order Changed', describe it, add time impact<br>3. Submit Deviation | Type route_change, desc 'Reversed afternoon route due to traffic' | Submit disabled until type+description set; deviation is created and appears under 'Deviations Reported' for that day after reload. | POST /api/saranam/scheduling/days/{dayId}/deviations {deviation_type, description, time_impact} |  |  |  |
| SCH-067 | Active Schedule Visits | Report Deviation (emergency patient) captures emergency fields | Medium | Functional | Active schedule day selected. | 1. Open Report Deviation, choose 'Emergency Patient Visited'<br>2. Fill emergency name/location/reason + description<br>3. Submit | Emergency 'Ramesh K', location 'Indiranagar', reason 'Breathlessness' | Emergency-specific fields appear when type=emergency_patient; deviation persists with emergency name/location and is displayed in the day's deviation list. | POST /days/{dayId}/deviations {deviation_type:'emergency_patient', emergency_patient_name, emergency_patient_location, emergency_reason} |  |  |  |
| SCH-068 | Active Schedule Visits | Team and route segments panels render | Low | Functional | Active schedule day with team assignments and GPS patients. | 1. Select a day with a team and routed patients | N/A | A 'Team for <day>' panel lists roles + provider names; a 'Route Segments' panel lists from->to legs with km and a total; numbered markers/route render on the map. | N/A (from /schedules/{id}) |  |  |  |
| SCH-069 | My Visits (clinician) | My Visits loads the logged-in clinician's week grouped by day | High | Functional | Logged-in clinician is assigned to an approved/active schedule this week. | 1. Navigate to /saranam/scheduling/my-visits | N/A | Shows 'My Visits', week label, day accordions (expanded by default) each listing the clinician's patients with UHID, cluster, address, phone, Navigate and Start Visit actions. | GET /api/saranam/scheduling/my-schedule |  |  |  |
| SCH-070 | My Visits (clinician) | Acknowledge schedule banner | High | Functional | My schedule not yet acknowledged. | 1. On My Visits click 'Acknowledge' | N/A | Acknowledge button shows a spinner then the warning banner disappears (acknowledged=true). On error 'Failed to acknowledge schedule' is shown. | POST /api/saranam/scheduling/schedules/{scheduleId}/acknowledge |  |  |  |
| SCH-071 | My Visits (clinician) | My Visits empty / no-schedule state (404 handled) | Medium | Edge Case | Clinician has no schedule for this week. | 1. Open /saranam/scheduling/my-visits | N/A | A 404 from my-schedule is treated as 'no schedule' (not an error): shows 'No schedule assigned for this week' empty state. | GET /my-schedule -> 404 |  |  |  |
| SCH-072 | My Visits (clinician) | Navigate link + tel link + Start Visit navigation | Medium | Functional | My Visits with a patient having address and phone. | 1. Click Navigate (opens Google Maps in new tab)<br>2. Click the phone link<br>3. Click Start Visit | N/A | Navigate opens maps.google.com search for the address in a new tab; phone uses tel:; Start Visit routes to /saranam/patients/{patientId}/visit. | N/A (links/navigation) |  |  |  |
| SCH-073 | My Visits (clinician) | My Visits load failure shows retry | Low | Negative | Simulate a non-404 failure (e.g. 500). | 1. Open My Visits with the API returning 500 | N/A | An error Alert 'Failed to load your schedule' with a Retry action button is shown. | GET /my-schedule -> 500 |  |  |  |
| SCH-074 | Today's Visits (clinician) | Today's Visits loads with completed counter | High | Functional | Clinician has visits scheduled for today. | 1. Navigate to /saranam/scheduling/my-visits/today | N/A | Shows 'Today's Visits', today's date, an 'X of Y completed' chip, and visit cards with status icon, BSC/Onco/Ad-hoc chips, cluster, address, phone and status-appropriate actions. | GET /api/saranam/scheduling/my-schedule/today |  |  |  |
| SCH-075 | Today's Visits (clinician) | Start -> Complete -> View flow on a visit | High | Functional | A scheduled visit today. | 1. Click Start Visit (scheduled->in_progress)<br>2. Click Mark Completed (in_progress->completed)<br>3. Click View Assessment | N/A | Status transitions optimistically per click; completed shows a View Assessment button linking to /saranam/patients/{patientId}/visit; completed counter increments. | PUT /slots/{slotId} {status:'in_progress'} then {status:'completed'} |  |  |  |
| SCH-076 | Today's Visits (clinician) | Mark Missed dialog with 'Other' free text | Medium | Validation | An in_progress visit today. | 1. Click Mark Missed<br>2. Select 'Other', enter details<br>3. Confirm Missed | Reason 'Other: Family requested reschedule' | Confirm disabled until a reason is chosen; with 'Other' the free-text is appended ('Other: ...'); slot becomes missed with that reason. | PUT /slots/{slotId} {status:'missed', missed_reason} |  |  |  |
| SCH-077 | Today's Visits (clinician) | Today's Visits empty state (no visits / 404) | Low | Edge Case | No visits today. | 1. Open Today's Visits | N/A | Shows 'No visits scheduled for today' empty state; a 404 is handled gracefully as empty, not an error. | GET /my-schedule/today |  |  |  |
| SCH-078 | Kit Readiness | Kit Readiness loads days with ready counter | High | Functional | A schedule with days/slots. | 1. Navigate to /saranam/scheduling/kit/:scheduleId | N/A | Header 'Kit Readiness', an 'X/Y days ready' badge (green when all ready else orange), day tabs each with check/warning icon, and the selected day's patient table (#, name, BSC/Active + Onco/Non-Onco, notes). | GET /api/saranam/scheduling/schedules/{id} |  |  |  |
| SCH-079 | Kit Readiness | Mark Kit Ready for a day | High | Functional | Kit page on a day with kit_ready=false. | 1. Click 'Mark Kit Ready' | N/A | Button shows 'Marking...', the day becomes Kit Ready (green badge + 'Marked ready at' timestamp), the X/Y counter updates, and the day tab shows a green check. | PUT /api/saranam/scheduling/days/{dayId} {kit_ready:true} |  |  |  |
| SCH-080 | Kit Readiness | Kit Readiness empty / no-days and back link | Low | UI/UX | A schedule with no days, plus any schedule. | 1. Open kit page for a schedule with no days<br>2. Click 'Back to Schedule' | N/A | Shows 'No days found in this schedule' card. Back to Schedule navigates to /saranam/scheduling/{scheduleId} (note: this path has no route - verify it 404s/redirects, log as a defect if broken). | GET /schedules/{id} |  |  |  |
| SCH-081 | Deviation Report | Deviation Report shows summary cards, compliance and per-day table | High | Functional | A schedule with completed/missed/cancelled/adhoc slots and deviations. | 1. Navigate to /saranam/scheduling/deviation-report/:scheduleId | N/A | Summary cards (Total, On Time, Late, Missed, Cancelled, Ad-hoc), a Compliance Rate bar (colour by threshold), a 'Reported Deviations' list, and a Daily Breakdown table with Patient/Scheduled/Actual/Status/Reason per slot. | GET /schedules/{id} + GET /schedules/{id}/deviations |  |  |  |
| SCH-082 | Deviation Report | Deviation Report load failure and not-found | Medium | Negative | Invalid scheduleId / API failure. | 1. Open deviation-report with a bad scheduleId or failing API | Non-existent GUID | On failure shows 'Failed to load report data' Alert; if schedule null shows 'Schedule not found' info Alert; no crash. | GET /schedules/{id} + GET /schedules/{id}/deviations |  |  |  |
| SCH-083 | Deviation Report | Compliance rate computation (late > 30 min) reflected | Medium | Data Integrity | Completed slots with started_at >30 min after scheduled_time. | 1. Open the report and compare Late count vs On Time and Compliance % | Slot scheduled 10:00 started 10:45 | Visits started >30 min late count as Late; On Time = completed - late; Compliance% = round(onTime/total*100). Bar colour: green >=80, amber >=50, red below. | N/A (client computed from slot data) |  |  |  |
| SCH-084 | Review Dashboard | Review Dashboard shows metric cards and day breakdown | High | Functional | A review_ready schedule. | 1. Navigate to /saranam/scheduling/review-dashboard/:scheduleId | N/A | Header 'Weekly Review' + week label; metric cards (Completion Rate, BSC Coverage, Cluster Efficiency, Missed Visits) coloured by target (Missed inverts: lower is better); Day Breakdown table; Missed Visit Details when present; Review Notes textarea. | GET /api/saranam/scheduling/schedules/{id}/review |  |  |  |
| SCH-085 | Review Dashboard | Complete Review & Archive | High | Functional | Review Dashboard open for a review_ready schedule. | 1. Enter review notes<br>2. Click 'Complete Review & Archive' | Notes 'Good week, 2 misses due to travel' | Button shows spinner; on success a 'Review Complete' confirmation screen replaces the page and the schedule moves to archived. Status now shows under the Archived tab on the calendar. | POST /api/saranam/scheduling/schedules/{id}/complete-review {review_notes} |  |  |  |
| SCH-086 | Review Dashboard | Review load failure shows retry | Low | Negative | Failing review API. | 1. Open review-dashboard with the API failing | N/A | Error Alert 'Failed to load review data' with Retry; metric cards show '--' for null values. | GET /schedules/{id}/review |  |  |  |
| SCH-087 | Audit Log | Audit Log lists entries with timestamp, action, actor, details | High | Functional | A schedule with audit activity (slot add/move/remove, submit, approve). | 1. Navigate to /saranam/scheduling/audit/:scheduleId | N/A | Table shows Timestamp, colour-coded Action badge, Actor and a Details summary; clicking a row expands a JSON detail block. Pagination appears when > 20 entries. | GET /api/saranam/scheduling/schedules/{id}/audit-log?page&per_page |  |  |  |
| SCH-088 | Audit Log | Audit Log action filter | Medium | Functional | Audit log with multiple action types. | 1. Open the Filter dropdown and select a specific action (e.g. 'Approve')<br>2. Then select 'All Actions' | Action filter | Selecting an action re-fetches filtered entries and resets to page 1; 'All Actions' clears the filter. Filter options derive from loaded entries. | GET /schedules/{id}/audit-log?action=<value> |  |  |  |
| SCH-089 | Audit Log | Audit Log pagination navigates pages | Medium | Functional | Schedule with > 20 audit entries. | 1. Click Next then Previous; observe page indicator and disabled states | N/A | Page increments/decrements fetch the matching page; Previous disabled on page 1, Next disabled on last page; 'Page X of Y' is accurate. | GET /schedules/{id}/audit-log?page=N&per_page=20 |  |  |  |
| SCH-090 | Audit Log | Audit Log empty state | Low | UI/UX | A schedule with no audit entries. | 1. Open audit page for it | N/A | 'No audit log entries found' empty state with history icon. | GET /schedules/{id}/audit-log |  |  |  |
| SCH-091 | Audit Log | Data integrity: planning actions create matching audit entries | High | Data Integrity | Draft schedule open in another tab. | 1. On the board: add a slot, move it, remove it, then submit<br>2. Open the Audit Log for that schedule | N/A | Audit log contains entries for each action (add/move/remove/submit) with correct actor and patient/day details; ordering newest first. | GET /schedules/{id}/audit-log |  |  |  |
| SCH-092 | On-Call Roster | On-Call Roster loads list (or empty state) | High | Functional | Logged in; team members exist. | 1. Navigate to /saranam/scheduling/on-call | N/A | Header 'On-Call Roster' with Refresh and Add On-Call buttons; a table of Week/Clinician/Phone/Notes/Actions or an empty state with an Add On-Call CTA. | GET /api/saranam/scheduling/on-call + GET /available-team |  |  |  |
| SCH-093 | On-Call Roster | Add on-call entry with auto week-end calculation | High | Functional | On-Call page open. | 1. Click Add On-Call<br>2. Pick Week Start Date (week end auto = start+6, disabled field)<br>3. Select a clinician, enter phone numbers, add notes<br>4. Click Create | Start 2026-06-08, clinician 'Dr. Anand', phones '+91 98765 43210, +91 90000 11111' | Week End auto-fills to 2026-06-14; Create disabled until week_start + clinician set; entry is created and appears in the table with comma-joined phones. | POST /api/saranam/scheduling/on-call {week_start_date, week_end_date, clinician_user_id, phone_numbers, notes} |  |  |  |
| SCH-094 | On-Call Roster | Edit an on-call entry | Medium | Functional | An on-call entry exists. | 1. Click the pencil, change clinician/phones/notes, click Update | Change phone list | Dialog pre-fills existing values; Update saves and the row reflects changes. 404 if the entry no longer exists. | PUT /api/saranam/scheduling/on-call/{id} |  |  |  |
| SCH-095 | On-Call Roster | Delete an on-call entry with confirmation | Medium | Functional | An on-call entry exists. | 1. Click the red trash icon<br>2. Confirm the deletion dialog | N/A | On confirm the entry is deleted and the list refreshes without it; cancel keeps it. On error an alert 'Failed to delete on-call entry'. | DELETE /api/saranam/scheduling/on-call/{id} |  |  |  |
| SCH-096 | Unscheduled Alerts | Alerts page lists overdue patients sorted by days overdue | High | Functional | Patients exceeding the visit-gap threshold and not scheduled this week. | 1. Navigate to /saranam/scheduling/alerts | N/A | Header 'Unscheduled Patient Alerts'; an orange count banner 'N patients need attention'; alert cards (sorted most overdue first) showing name, BSC/Onco badges, priority, last-visit days, frequency, cluster, and a days-overdue badge with severity colour. | GET /api/saranam/scheduling/alerts/unscheduled |  |  |  |
| SCH-097 | Unscheduled Alerts | Alerts all-clear empty state + Refresh | Medium | UI/UX | No overdue/unscheduled patients (all scheduled). | 1. Open alerts page<br>2. Click Refresh | N/A | Green 'All patients are scheduled - no alerts' card shown; Refresh re-fetches. Severity colours: >=14d red, >=7d orange, >=3d yellow. | GET /alerts/unscheduled |  |  |  |
| SCH-098 | ScheduleDayMap | Map renders hospital pins, patient markers and per-vehicle routes | High | Functional | Google Maps key configured; day with GPS patients across two vehicles. | 1. Open the board/active-visits map for a day with multi-vehicle GPS patients | N/A | Hospital pins (K, KC) always render; numbered patient markers per vehicle in distinct colours; coloured road polylines via Directions API with per-leg km/time labels; header total km + drive time; per-vehicle route summary and legend. | Google Maps JS Directions + patientsApi.getZoneBoundaries (zone overlay) |  |  |  |
| SCH-099 | ScheduleDayMap | Map geocodes address-only patients and flags location-less patients | Medium | Edge Case | Mix of GPS patients, address-only patients, and one with neither GPS nor address. | 1. Open the map for that day | N/A | Address-only patients are geocoded (header shows 'N geocoded from address', marker info window notes 'approx.'); patients with no GPS and no address show 'N without location & address' in red and are excluded from the route. | Google Geocoder |  |  |  |
| SCH-100 | ScheduleDayMap | Map empty state and missing Google key handling | Low | Edge Case | A day with no slots; separately an environment without a Maps key. | 1. Open the map for an empty day<br>2. Open a day's map when VITE_GOOGLE_MAPS_KEY is unset | N/A | Empty day shows 'No patients scheduled' overlay. Without a Maps key the map fails to load and shows 'Loading map...'/blank rather than crashing the page (log as a defect/environment note). | Google Maps JS |  |  |  |
| SCH-101 | Permissions & Session | Unauthenticated access redirects to login | High | Permission | No valid session (clear localStorage tokens). | 1. Clear access_token/refresh_token<br>2. Navigate to /saranam/scheduling (and a deep route like /board/:id) | N/A | ProtectedRoute redirects to /login; no scheduling data is loaded. | N/A (route guard) |  |  |  |
| SCH-102 | Permissions & Session | Expired access token triggers refresh then retry | High | Permission | Valid refresh_token but expired access_token. | 1. With an expired access token, perform an action that calls a scheduling API (e.g. open the calendar) | N/A | Axios interceptor catches 401, POSTs /auth/refresh, stores a new access_token and transparently retries the original request; data loads without a visible login redirect. | POST /api/auth/refresh then retry original |  |  |  |
| SCH-103 | Permissions & Session | Refresh failure logs out to login | High | Permission | Expired access token AND invalid/expired refresh token. | 1. With both tokens invalid, trigger any scheduling API call | N/A | Refresh fails; access_token/refresh_token/user are cleared from localStorage and the app redirects to /login. | POST /api/auth/refresh -> failure |  |  |  |
| SCH-104 | Permissions & Session | Any authenticated user can submit and approve (no role separation) - governance check | Medium | Permission | Logged in as a non-admin clinician user. | 1. Create/open a draft, Submit for Approval, then Approve the same schedule | N/A | Both actions succeed for the same user (no enforced approver role in code). FLAG to client/PM: confirm whether self-approval / role separation must be enforced before go-live; record as a governance finding. | POST /schedules/{id}/submit then /approve |  |  |  |
| SCH-105 | Validation & Negative | Scheduling for a past week is permitted by the date picker | Medium | Edge Case | Today is 2026-06-01. | 1. New Schedule -> pick a past week start (2026-05-04) -> Create | Week start 2026-05-04 | Document actual behaviour: the date field has no min so a past week can be entered; verify backend accepts or rejects (ValueError -> 400). If it creates a past-dated schedule, flag whether that is desired. | POST /schedules {week_start_date} |  |  |  |
| SCH-106 | Validation & Negative | Add slot without patient_id rejected | Medium | Negative | Draft schedule day. | 1. Force an add-slot request with no patient_id (e.g. via API or by submitting an empty modal selection) | Missing patient_id | Backend returns 400 'patient_id is required'; UI Add to Schedule stays disabled so the empty case is not normally reachable from the UI. | POST /days/{dayId}/slots -> 400 |  |  |  |
| SCH-107 | Validation & Negative | Move slot without to_day_id rejected | Low | Negative | A slot exists. | 1. Force a move request without to_day_id | Missing to_day_id | Backend returns 400 'to_day_id is required'. | POST /slots/{slotId}/move -> 400 |  |  |  |
| SCH-108 | Validation & Negative | Create deviation without type/description rejected | Medium | Negative | Active schedule day. | 1. In Report Deviation leave type or description empty and try to submit | Missing deviation_type/description | Submit button disabled until both set; a forced API call returns 400 'deviation_type and description are required'. | POST /days/{dayId}/deviations -> 400 |  |  |  |
| SCH-109 | Validation & Negative | Empty/no-assignment schedule can be submitted (no hard block) | Medium | Edge Case | A draft schedule with zero slots. | 1. Open the empty draft and click Submit for Approval | N/A | Validation likely returns warnings about empty days but the Submit action is still available; record whether the backend blocks an empty submit (400) or allows it with warnings, and flag if an empty publish should be prevented. | GET /schedules/{id}/validate then POST /submit |  |  |  |
| SCH-110 | Data Integrity (cross-module) | Approved schedule visits appear in My Visits / Active Visits | High | Data Integrity | A draft with the test clinician assigned, then approved & activated. | 1. Build a draft assigning the logged-in clinician to slots<br>2. Submit -> Approve -> Activate<br>3. Open My Visits and Active Visits | N/A | The same patients/days appear under My Visits (for the assigned clinician) and Active Schedule Visits; counts and patient names are consistent with the board. | GET /my-schedule + GET /schedules + /schedules/{id} |  |  |  |
| SCH-111 | Data Integrity (cross-module) | Completing a visit reflects in Deviation Report and Review metrics | High | Data Integrity | Active schedule with slots. | 1. Mark some visits completed/missed in Active Visits<br>2. Open the Deviation Report and (after review-ready) the Review Dashboard | N/A | Completed/missed counts and compliance % in the Deviation Report match the actions taken; Review metrics (completion rate, missed count) are consistent. | PUT /slots/{id}; GET /schedules/{id}/deviations; GET /schedules/{id}/review |  |  |  |
| SCH-112 | Data Integrity (cross-module) | Deviations persist and surface in both Active Visits and Deviation Report | Medium | Data Integrity | Active schedule. | 1. Create a deviation from Active Visits<br>2. Reload Active Visits and open the Deviation Report for the same schedule | N/A | The deviation persists and appears in the day's deviation list on Active Visits and under 'Reported Deviations' on the Deviation Report with matching type/description/reporter/time. | POST /days/{dayId}/deviations; GET /schedules/{id}/deviations |  |  |  |
| SCH-113 | Data Integrity (cross-module) | Scheduling a patient removes them from Unscheduled Alerts for that week | Medium | Data Integrity | An overdue patient appears on the Alerts page; a schedule for that same week exists. | 1. Note an overdue patient on /alerts<br>2. Add that patient to a slot in the schedule for the same week_start<br>3. Reopen /alerts (and refresh) | N/A | Once scheduled in that week, the patient no longer appears in the unscheduled alerts list (backend excludes patients with a slot in the week). | POST /days/{dayId}/slots; GET /alerts/unscheduled |  |  |  |
| SCH-114 | Notifications & Acknowledgments | Acknowledgments list reflects clinician acknowledgement | Medium | Data Integrity | An approved schedule acknowledged by the clinician. | 1. Acknowledge from My Visits (SCH-070)<br>2. View acknowledgments for that schedule (via API / any UI surface that calls it) | N/A | The acknowledgments endpoint returns the acknowledging user for that schedule; acknowledged state is consistent with My Visits banner being hidden. | POST /schedules/{id}/acknowledge; GET /schedules/{id}/acknowledgments |  |  |  |
| SCH-115 | Patient Pool | Recalculate priorities runs on board load (background) | Low | Functional | Open the board. | 1. Open a draft board and inspect network calls | N/A | A fire-and-forget POST recalculate-priorities is issued on load; priority scores shown on sidebar cards reflect (possibly next-refresh) recalculated values without blocking the UI. | POST /api/saranam/scheduling/patient-pool/recalculate-priorities |  |  |  |
| SCH-116 | Patient Pool | Add Patient modal lazy-loads the full patient list | Low | Functional | Draft board. | 1. Open the Add Patient modal for the first time and inspect network | N/A | The full patient search (up to 500) is fetched only when the modal first opens; the modal initially falls back to the already-loaded pool and is searchable. | patientsApi.search('',1,500) |  |  |  |
| SCH-117 | Regression / Stability | Rapid repeated actions do not corrupt schedule state | Medium | Edge Case | Draft board with slots. | 1. Quickly add, move, reorder and remove slots in succession<br>2. Observe the saving bar and final reloaded state | N/A | Each action serialises through the saving indicator and a reload; the final board state matches the last successful action with no duplicated/ghost slots. | POST /slots; POST /slots/{id}/move; POST /days/{id}/reorder; DELETE /slots/{id} |  |  |  |
| SCH-118 | Regression / Stability | Browser back/forward between scheduling screens preserves data | Low | UI/UX | Logged in. | 1. Calendar -> open a board -> browser Back -> Active Visits -> Back | N/A | Each screen reloads its own data cleanly on navigation; no stale data leaks between schedules; tab selection on the calendar is preserved per the URL/state. | N/A |  |  |  |

---

## 7. Defect Severity Legend & Sign-Off

### Defect Severity

| Severity | Definition | Example in Scheduling |
|----------|------------|------------------------|
| **S1 — Critical** | Blocks go-live; data loss, security/permission breach, or core flow unusable with no workaround. | Cannot create/approve a schedule; approved visits don't appear in My Visits; token refresh logs everyone out; one user can see/edit another clinician's schedule when they shouldn't. |
| **S2 — High** | Major function broken or wrong data, but a workaround exists. | Drag-and-drop move silently fails; deviation not persisted; compliance %/metrics computed incorrectly; disallowed lifecycle transition succeeds. |
| **S3 — Medium** | Function works but with noticeable issues / incorrect non-critical behaviour. | Time-conflict warning not shown; capacity chip colour wrong; pagination off-by-one; empty-state missing. |
| **S4 — Low** | Cosmetic / minor UX, copy, alignment, or rare edge case. | Tooltip wording, icon spacing, label casing, minor responsive glitch. |

### Governance Findings to Confirm Before Go-Live
- **Self-approval / role separation** (SCH-104): any authenticated user can both submit and approve. Confirm with client whether an approver role must be enforced.
- **Past-week scheduling** (SCH-105) and **empty-schedule submit/publish** (SCH-109): confirm intended backend behaviour.
- **Kit page "Back to Schedule"** target `/saranam/scheduling/{id}` (SCH-080) has no matching route — verify and raise if broken.
- **Google Maps key** dependency for all map screens (SCH-100).

### Execution Summary

| Metric | Count |
|--------|-------|
| Total test cases | 118 |
| Executed | |
| Passed | |
| Failed | |
| Blocked | |
| N/A | |
| Defects raised (S1 / S2 / S3 / S4) | / / / |

### Sign-Off

| Role | Name | Signature | Date | Decision (Go / No-Go) |
|------|------|-----------|------|------------------------|
| QA Engineer | | | | |
| QA Lead | | | | |
| Product Owner / PM | | | | |
| Client Representative | | | | |

---
*Generated for the Saranam go-live test effort. Keep this document and `scheduling_test_cases.json` in sync.*
