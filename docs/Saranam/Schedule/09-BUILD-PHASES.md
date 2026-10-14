# 09 - Build Phases

Phased implementation where each phase delivers **usable functionality**.

---

## Phase 1: Foundation & Core Planning

**Goal**: PO-SW can create a weekly schedule manually and Lead can approve it.

### Backend Tasks

1. **Database Models & Migration**
   - Create all 11 tables (single Alembic migration)
   - Seed `schedule_config` with defaults
   - Seed `geographic_clusters` with 5 default clusters
   - Seed at least 1 vehicle

2. **Schedule Config API**
   - `GET /config` - Read config
   - `PUT /config` - Update config (Admin/Lead)

3. **Cluster & Vehicle CRUD APIs**
   - Full CRUD for geographic_clusters
   - Full CRUD for vehicles

4. **Weekly Schedule Core APIs**
   - `POST /schedules` - Create schedule (auto-creates days)
   - `GET /schedules` - List with filters
   - `GET /schedules/:id` - Full schedule with days/slots/team
   - `DELETE /schedules/:id` - Delete (DRAFT only)

5. **State Transition APIs**
   - `POST /schedules/:id/submit` - DRAFT → SUBMITTED (with validation)
   - `POST /schedules/:id/approve` - SUBMITTED → APPROVED
   - `POST /schedules/:id/send-back` - SUBMITTED → DRAFT

6. **Slot Management APIs**
   - `POST /days/:id/slots` - Add patient to day
   - `PUT /slots/:id` - Update slot
   - `DELETE /slots/:id` - Remove patient from day
   - `POST /days/:id/reorder` - Reorder slots
   - `POST /slots/:id/move` - Move patient between days

7. **Patient Pool API (Basic)**
   - `GET /patient-pool` - List with filters, priority sorting
   - `PUT /patient-pool/:id` - Update scheduling metadata
   - One-time script to populate `patient_scheduling_meta` for existing patients

8. **Priority Scoring Service**
   - Implement `calculate_priority_score()`
   - Batch recalculate endpoint

### Frontend Tasks

9. **API Client**
    - Create `frontend/src/api/scheduling.js` with all API calls

10. **Schedule Settings Page (S1)**
    - Config form with all settings
    - Cluster management (add/edit/delete with color picker)
    - Vehicle management (add/edit)

11. **Schedule Calendar Page (S4)**
    - Month calendar view
    - Week bars with status colors
    - "New Schedule" dialog
    - Click week → navigate to board

12. **Weekly Planning Board (S2) - Basic Version**
    - Day columns with patient count
    - Patient pool sidebar (list view, sorted, filterable)
    - Add/remove patients via buttons (not drag-drop yet)
    - Team panel with dropdowns per day
    - Warnings banner
    - Stats bar (BSC coverage, totals)
    - Submit button with validation dialog

13. **Approval Review Board (S3) - Basic Version**
    - Same as S2 but in review mode
    - Approve / Send Back buttons
    - Review summary panel

14. **Patient Pool Manager (S7)**
    - Table with all patients and scheduling data
    - Edit drawer for scheduling metadata
    - Cluster filter
    - Priority score display

15. **Routing & Navigation**
    - Add all scheduling routes to App.jsx
    - Add "Scheduling" section to DashboardLayout sidebar

### Deliverables
- PO-SW can create a weekly schedule
- Add patients to specific days
- Assign team members per day
- Submit for Lead approval
- Lead can review, approve, or send back
- Basic patient pool management with priority sorting

---

## Phase 2: Team & Execution

**Goal**: Team members can see and execute their schedules. Visit status tracking works.

### Backend Tasks

1. **Team Assignment API**
   - `PUT /days/:id/team` - Set team for a day
   - `GET /available-team?date=&role=` - Available team members

2. **My Schedule API**
   - `GET /my-schedule` - Current user's assigned days/patients
   - `GET /my-schedule/today` - Today's visits only

3. **Visit Status Tracking**
   - `PUT /slots/:id/status` - Update slot status (scheduled → in_progress → completed/missed/cancelled)
   - Link to PatientVisit creation

4. **Notification Service (In-App)**
   - Create `schedule_notifications` records
   - Notification API: `GET /notifications`, `PUT /notifications/:id/read`
   - Acknowledgment: `POST /schedules/:id/acknowledge`

5. **Auto State Transitions**
   - APPROVED → COMMUNICATED (on notification send)
   - COMMUNICATED → IN_PROGRESS (on first visit day)
   - IN_PROGRESS → REVIEW_READY (after last visit day)

6. **Ad-Hoc Visit Support**
   - Lead can add slots with `is_adhoc = true` during IN_PROGRESS
   - Lead can cancel slots during IN_PROGRESS
   - Audit log entries for all ad-hoc changes

7. **Saranam Visit Integration**
   - When slot marked "completed", create/link PatientVisit
   - After visit creation, update scheduling_meta (last_visit_date, etc.)

### Frontend Tasks

8. **My Visits This Week (S5)**
   - Personal schedule view (mobile-friendly)
   - Acknowledge button
   - Day sections with patient cards

9. **Daily Visit View (S6)**
   - Today's patients in visit order
   - Status buttons: Start, Complete, Mark Missed
   - Navigate button (maps link)
   - Link to assessment forms
   - Missed reason dialog

10. **In-App Notifications**
    - Notification bell in DashboardLayout header
    - Notification dropdown/page
    - Badge count for unread
    - Scheduling-specific notification types

11. **Ad-Hoc Visit UI**
    - On planning board (when IN_PROGRESS): Lead can add patients with ad-hoc badge
    - Cancel visit dialog with reason

12. **Acknowledgment Tracking**
    - On approval review board: show who has/hasn't acknowledged
    - On My Visits: acknowledge button

### Deliverables
- Team members see their personalized schedule
- Daily visit execution with status tracking
- Visit completion links to Saranam assessment flow
- Lead can make ad-hoc changes mid-week
- In-app notifications on key events
- Schedule acknowledgment system

---

## Phase 3: Smart Assists & Review

**Goal**: System actively helps with scheduling quality. Weekly review cycle works.

### Backend Tasks

1. **Cluster Efficiency Computation**
   - Auto-calculate per day when slots change
   - Store in `schedule_days.cluster_efficiency`

2. **Advanced Warning System**
   - BSC coverage tracking
   - Capacity warnings
   - Visit gap alerts

3. **Weekly Review Service**
   - Auto-generate review metrics (all 10 metrics)
   - Store in `weekly_schedules.review_metrics`
   - Review completion endpoint

4. **Audit Log API**
   - `GET /schedules/:id/audit-log` - Full change history
   - Filter by action type

5. **Background Jobs**
   - Daily priority recalculation (APScheduler)
   - Daily days_since_last_visit update
   - Auto schedule creation on planning day

6. **Unscheduled Patient Alerts**
   - `GET /alerts/unscheduled` - Patients exceeding gap threshold

### Frontend Tasks

7. **Planning Board Upgrades**
   - Drag-and-drop (replace button-based add/remove with @dnd-kit)
   - Cluster color badges on patient cards
   - Cluster efficiency bars on day headers
   - Real-time cluster efficiency updates on drag
   - BSC coverage progress bar

8. **Weekly Review Dashboard (S8)**
   - Metric cards with targets
   - Day breakdown table
   - Missed visit details
   - Unvisited patient list
   - Review notes editor
   - Complete Review button

9. **Schedule Audit Log (S10)**
   - Chronological table
   - Filter by action type
   - Expandable details

10. **Unscheduled Patient Alerts (S12)**
    - Alert list sorted by urgency
    - Quick action buttons

### Deliverables
- Drag-and-drop scheduling
- Visual cluster efficiency feedback
- BSC coverage tracking
- Full warning system
- Weekly review dashboard with metrics
- Audit trail for all changes
- Unscheduled patient alerts

---

## Phase 4: Integrations & Polish

**Goal**: Everything connected. Kit readiness. Full notifications.

### Backend Tasks

1. **Kit Readiness Service**
   - Generate kit list from patient needs (nursing assessments + care plans)
   - Check inventory stock levels
   - Kit ready marking endpoint
   - 6 PM deadline alert

2. **Proactive Call List Generation**
   - Auto-generate from unscheduled patients
   - Configurable call days

3. **WhatsApp Notification Integration** (if configured)
   - Send schedule summaries via WhatsApp API
   - Delivery tracking

4. **On-Call Roster API**
   - Full CRUD for on-call assignments

5. **Schedule PDF Export**
   - Generate weekly schedule PDF for download
   - Per-team-member PDF

### Frontend Tasks

6. **Kit Readiness Checklist (S9)**
   - Per-day item list from patient needs
   - Stock status indicators
   - Mark Ready button
   - Link to inventory for low-stock items

7. **On-Call Roster Manager (S11)**
   - Calendar view for weekly assignments
   - Assignment form

8. **WhatsApp Configuration UI** (in settings)

9. **PDF Download Button**
   - On approval review board
   - On My Visits page

10. **Polish & UX**
    - Loading states
    - Error handling
    - Empty states
    - Mobile responsiveness for team views
    - Keyboard shortcuts on planning board

### Deliverables
- Kit readiness workflow integrated with inventory
- On-call roster management
- WhatsApp notifications (if configured)
- PDF export of schedules
- Proactive call list auto-generation
- Polished UX across all screens

---

## Phase 5: Future (V2)

Not in current scope, but planned for future:

- **Auto-suggest schedule**: Algorithm distributes patients based on priority + cluster
- **Route optimization**: Maps API integration for optimal visit ordering
- **Multi-vehicle scheduling**: Parallel boards for multiple ambulances
- **Offline schedule sync**: Service worker for field teams with spotty connectivity
- **Recurring templates**: "This patient always on Mondays"
- **Team performance analytics**: Per-team-member metrics over time
- **Patient feedback integration**: Post-visit satisfaction tracking

---

## Phase Summary

| Phase | Focus | Key Screens | Key APIs |
|-------|-------|-------------|----------|
| 1 | Foundation | S1, S2, S3, S4, S7 | Config, Schedules, Slots, Patient Pool |
| 2 | Execution | S5, S6 | My Schedule, Status, Notifications, Acknowledge |
| 3 | Intelligence | S8, S10, S12 | Review, Audit, Alerts, Background Jobs |
| 4 | Integration | S9, S11 | Kit, On-Call, WhatsApp, PDF |
| 5 | Advanced | - | Auto-suggest, Route Optimization |
