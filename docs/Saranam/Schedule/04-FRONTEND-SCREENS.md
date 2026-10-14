# 04 - Frontend Screens & Components

---

## Screen Inventory

| # | Screen | Route | Primary User | Purpose |
|---|--------|-------|-------------|---------|
| S1 | Schedule Settings | `/saranam/scheduling/settings` | Admin, Lead | Configure all scheduling parameters |
| S2 | Weekly Planning Board | `/saranam/scheduling/board/:scheduleId` | PO-SW | Main scheduling screen - drag-drop patients into days |
| S3 | Approval Review Board | `/saranam/scheduling/review/:scheduleId` | Lead | Same as S2 but in review mode |
| S4 | Schedule Calendar | `/saranam/scheduling` | All | Month view showing week statuses |
| S5 | My Visits This Week | `/saranam/scheduling/my-visits` | Clinical Team | Personal view of assigned visits |
| S6 | Daily Visit View | `/saranam/scheduling/my-visits/today` | Clinical Team | Today's patients in visit order |
| S7 | Patient Pool Manager | `/saranam/scheduling/patient-pool` | PO-SW, Lead | All patients with priority, cluster, frequency |
| S8 | Weekly Review Dashboard | `/saranam/scheduling/review-dashboard/:scheduleId` | Lead | Post-week metrics and review |
| S9 | Kit Readiness Checklist | `/saranam/scheduling/kit/:dayId` | PO-SW, Nurse | Per-day kit preparation |
| S10 | Schedule Audit Log | `/saranam/scheduling/audit/:scheduleId` | Lead, Admin | Full change history |
| S11 | On-Call Roster Manager | `/saranam/scheduling/on-call` | PO-SW | Weekly on-call assignment |
| S12 | Unscheduled Patient Alerts | `/saranam/scheduling/alerts` | PO-SW, Lead | Patients exceeding visit gap |

---

## S1: Schedule Settings

**Route**: `/saranam/scheduling/settings`
**Access**: Admin, Lead

### Layout
```
┌─────────────────────────────────────────────────────────┐
│ Schedule Settings                              [Save]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Visit Configuration                                     │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Visit Days: [✓Mon] [✓Tue] [Wed] [✓Thu] [✓Fri] [Sat]│ │
│ │ Non-Visit Labels:                                   │ │
│ │   Wednesday: [Case Review_____]                     │ │
│ │   Saturday:  [Capacity Building]                    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Planning & Approval                                     │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Planning Day: [Friday ▼]  Deadline: [18:00]         │ │
│ │ Approval Deadline: [Saturday ▼] [20:00]             │ │
│ │ Auto-create schedule: [✓]                           │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Capacity                                                │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Max Patients/Vehicle/Day: [4]                       │ │
│ │ Recommended/Day: [3]                                │ │
│ │ Active Vehicles: [1]                                │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Clustering                                              │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Efficiency Target: [50] %                           │ │
│ │ Clusters:                                           │ │
│ │   [■] North  #3B82F6  PINs: 560001, 560002  [Edit] │ │
│ │   [■] South  #22C55E  PINs: 560003          [Edit] │ │
│ │   [+ Add Cluster]                                   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Alerts & Notifications                                  │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Visit Gap Alert: [7] days                           │ │
│ │ Notifications: [✓ In-App] [WhatsApp]                │ │
│ │ Proactive Call Days: [✓Wed] [✓Sat]                  │ │
│ │ Call Window: [14:00] - [17:00]                      │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Vehicles                                                │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Ambulance 1  |  KA-01-1234  |  Active   [Edit]     │ │
│ │ [+ Add Vehicle]                                     │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Components
- `ScheduleSettingsPage` - Main page container
- `VisitDaySelector` - Multi-select checkboxes for days
- `ClusterManager` - CRUD list for clusters with color pickers
- `VehicleManager` - CRUD list for vehicles

---

## S2: Weekly Planning Board (Main Scheduling Screen)

**Route**: `/saranam/scheduling/board/:scheduleId`
**Access**: PO-SW (edit in DRAFT), Lead (edit in DRAFT/SUBMITTED)

This is the most complex and critical screen.

### Layout
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Weekly Schedule: Mar 30 - Apr 5, 2026  │ Ambulance 1  │ Status: DRAFT      │
│ [Submit for Approval]                                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│ ⚠ WARNINGS                                                                  │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ 🔴 BSC patient Manjulamma not scheduled (last visit 12 days ago)        │ │
│ │ 🟡 Tuesday has 5 patients (max is 4)                                    │ │
│ │ 🟡 Monday cluster efficiency: 40% (target 50%)                          │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────┤
│ BSC Coverage: ████████░░ 8/10  │  Avg Efficiency: 62%  │  Scheduled: 14    │
├────────────┬─────────────────────────────────────────────────────────────────┤
│            │                      DAY COLUMNS                                │
│  PATIENT   │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  POOL      │ │ MONDAY   │ │ TUESDAY  │ │ THURSDAY │ │ FRIDAY   │          │
│            │ │ Mar 30   │ │ Mar 31   │ │ Apr 2    │ │ Apr 3    │          │
│ Search:    │ │ 3/4 pts  │ │ 5/4 pts⚠│ │ 3/4 pts  │ │ 3/4 pts  │          │
│ [________] │ │ Eff: 40% │ │ Eff: 80% │ │ Eff: 60% │ │ Eff: 67% │          │
│            │ │ ■■□□□    │ │ ■■■■□    │ │ ■■■□□    │ │ ■■□□□    │          │
│ Filter:    │ ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤          │
│ [All    ▼] │ │┌────────┐│ │┌────────┐│ │┌────────┐│ │┌────────┐│          │
│ [BSC only] │ ││Patient A││ ││Patient D││ ││Patient G││ ││Patient J││          │
│            │ ││BSC 🔴   ││ ││N-BSC   ││ ││BSC 🔴   ││ ││BSC 🔴   ││          │
│ ┌────────┐ │ ││North 🔵 ││ ││South 🟢││ ││East 🟠 ││ ││West 🟣 ││          │
│ │Patient X│ │ ││Last: 5d ││ ││Last: 3d ││ ││Last: 6d ││ ││Last: 4d ││          │
│ │BSC 🔴   │ │ │└────────┘│ │└────────┘│ │└────────┘│ │└────────┘│          │
│ │North 🔵 │ │ │┌────────┐│ │┌────────┐│ │┌────────┐│ │┌────────┐│          │
│ │Last: 8d │ │ ││Patient B││ ││Patient E││ ││Patient H││ ││Patient K││          │
│ │Score: 95│ │ ││N-BSC   ││ ││BSC 🔴   ││ ││N-BSC   ││ ││N-BSC   ││          │
│ │OVERDUE  │ │ ││North 🔵 ││ ││South 🟢││ ││East 🟠 ││ ││North 🔵││          │
│ │⚑ Flagged│ │ │└────────┘│ │└────────┘│ │└────────┘│ │└────────┘│          │
│ └────────┘ │ │          │ │          │ │          │ │          │          │
│ ┌────────┐ │ │┌────────┐│ │┌────────┐│ │┌────────┐│ │┌────────┐│          │
│ │Patient Y│ │ ││Patient C││ ││Patient F││ ││Patient I││ ││Patient L││          │
│ │N-BSC    │ │ ││BSC 🔴   ││ ││N-BSC   ││ ││BSC 🔴   ││ ││N-BSC   ││          │
│ │South 🟢 │ │ ││Central ││ ││North 🔵││ ││West 🟣 ││ ││South 🟢││          │
│ │Last: 3d │ │ │└────────┘│ │└────────┘│ │└────────┘│ │└────────┘│          │
│ │Score: 40│ │ │          │ │          │ │          │ │          │          │
│ └────────┘ │ └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│ ...        │                                                               │
│            ├───────────────────────────────────────────────────────────────┤
│ 45 patients│ TEAM PANEL                                                    │
│ 12 BSC     │ Mon: Dr.Smith(physician), Nurse Joy(nurse), -(counselor)     │
│ 5 overdue  │ Tue: Dr.Smith(physician), Nurse Joy(nurse), Ram(counselor)   │
│            │ Thu: Dr.Patel(physician), Nurse Joy(nurse), -(counselor)     │
│            │ Fri: Dr.Smith(physician), Nurse Ami(nurse), Ram(counselor)   │
└────────────┴───────────────────────────────────────────────────────────────┘
```

### Interactions
1. **Drag & Drop** - Drag patient card from sidebar into a day column (uses @dnd-kit)
2. **Drag between days** - Move patient from one day column to another
3. **Reorder within day** - Drag to reorder visit sequence
4. **Click patient card** - Expand to see full profile, last visit summary, notes
5. **Right-click / long-press** - Context menu: Remove, Mark "Cannot Visit" (requires reason), Flag for Lead
6. **Cluster highlighting** - When dragging a patient, same-cluster patients in sidebar get highlighted
7. **Real-time updates** - Cluster efficiency bars update on every drag action

### Components
- `WeeklyPlanningBoard` - Main page component
- `PatientPoolSidebar` - Left sidebar with search, filters, patient cards
- `PatientCard` - Draggable card showing patient summary
- `DayColumn` - Droppable column for a visit day
- `DayHeader` - Day name, date, count, cluster efficiency bar
- `ClusterBar` - Visual cluster breakdown (mini stacked bar)
- `TeamPanel` - Bottom panel for per-day team assignment
- `WarningsBanner` - Top banner showing active warnings
- `StatsBar` - Bottom bar with BSC coverage, efficiency, totals
- `SubmitDialog` - Pre-submit validation summary + confirm
- `PatientDetailDrawer` - Side drawer showing full patient info on click

---

## S3: Approval Review Board

**Route**: `/saranam/scheduling/review/:scheduleId`
**Access**: Lead

Same layout as S2 with these differences:
- **Review Summary Panel** at top showing: total patients, BSC coverage, cluster stats, PO-SW's notes, flagged patients
- Lead modifications highlighted in a different color (e.g., amber background)
- Three action buttons: **[Approve]** **[Approve with Changes]** **[Send Back]**
- Send Back requires a comment in a dialog
- Read-only for PO-SW if they navigate here

### Additional Components
- `ReviewSummaryPanel` - Top panel with submission summary
- `LeadChangeHighlight` - Visual indicator for Lead-modified slots
- `ApprovalDialog` - Approve confirmation with optional note
- `SendBackDialog` - Send back with required comment

---

## S4: Schedule Calendar View

**Route**: `/saranam/scheduling`
**Access**: All roles

### Layout
```
┌──────────────────────────────────────────────────────────────┐
│ Schedule Calendar                     [+ New Schedule]       │
│ ◄ February 2026        March 2026        April 2026 ►       │
├──────────────────────────────────────────────────────────────┤
│  Mon  │  Tue  │  Wed  │  Thu  │  Fri  │  Sat  │  Sun        │
├───────┼───────┼───────┼───────┼───────┼───────┼──────┤      │
│  2    │  3    │  4    │  5    │  6    │  7    │  8   │      │
│ ┌───────────────────────────────────────────────────┐│      │
│ │ Week Mar 2-8  │  ARCHIVED  │  12 pts  │ 92% comp ││      │
│ └───────────────────────────────────────────────────┘│      │
├───────┼───────┼───────┼───────┼───────┼───────┼──────┤      │
│  9    │  10   │  11   │  12   │  13   │  14   │  15  │      │
│ ┌───────────────────────────────────────────────────┐│      │
│ │ Week Mar 9-15 │ IN_PROGRESS│  14 pts  │ 8/14 done││      │
│ └───────────────────────────────────────────────────┘│      │
├───────┼───────┼───────┼───────┼───────┼───────┼──────┤      │
│  16   │  17   │  18   │  19   │  20   │  21   │  22  │      │
│ ┌───────────────────────────────────────────────────┐│      │
│ │ Week Mar 16-22│   DRAFT    │  0 pts   │ Planning  ││      │
│ └───────────────────────────────────────────────────┘│      │
└──────────────────────────────────────────────────────────────┘
```

### Interactions
- Click a week → opens the Planning Board (S2) or Review Board (S3) based on status and role
- Color-coded week bars by status: Draft (gray), Submitted (yellow), Approved (blue), In Progress (green), Review Ready (orange), Archived (slate)
- **+ New Schedule** button to manually create a schedule for a specific week

### Components
- `ScheduleCalendarPage` - Main page
- `CalendarGrid` - Month calendar with week overlays
- `WeekBar` - Colored bar spanning Mon-Sun showing schedule info
- `NewScheduleDialog` - Create schedule for a specific week + vehicle

---

## S5: My Visits This Week

**Route**: `/saranam/scheduling/my-visits`
**Access**: Clinical Team

### Layout (Mobile-Friendly)
```
┌──────────────────────────────────────┐
│ My Visits This Week                  │
│ Mar 30 - Apr 5, 2026                │
│ [Acknowledge ✓]                      │
├──────────────────────────────────────┤
│                                      │
│ Monday, Mar 30                       │
│ ┌──────────────────────────────────┐ │
│ │ 1. Patient A                     │ │
│ │    BSC | North | 📍 123 Main St  │ │
│ │    📞 +91-XXXXXXXXXX             │ │
│ │    Last: Visit 5 - stable        │ │
│ │    [Navigate] [Start Visit]      │ │
│ ├──────────────────────────────────┤ │
│ │ 2. Patient B                     │ │
│ │    N-BSC | North | 📍 456 Oak Ln │ │
│ │    📞 +91-XXXXXXXXXX             │ │
│ │    Last: Visit 3 - wound care    │ │
│ │    [Navigate] [Start Visit]      │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Thursday, Apr 2                      │
│ ┌──────────────────────────────────┐ │
│ │ 1. Patient G                     │ │
│ │    BSC | East | 📍 789 Park Ave  │ │
│ │    ⚠ Catheter | Bed bound        │ │
│ │    [Navigate] [Start Visit]      │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

### Components
- `MyVisitsPage` - Main page
- `DaySection` - Collapsible day section
- `VisitCard` - Patient card with address, phone, alerts, actions
- `AcknowledgeButton` - One-tap schedule acknowledgment

---

## S6: Daily Visit View

**Route**: `/saranam/scheduling/my-visits/today`
**Access**: Clinical Team

### Layout (Mobile-Optimized)
```
┌──────────────────────────────────────┐
│ Today's Visits - Monday, Mar 30      │
│ 1 of 3 completed                     │
├──────────────────────────────────────┤
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ ✅ 1. Patient A (Completed)      │ │
│ │    Completed at 10:30 AM         │ │
│ │    [View Assessment]             │ │
│ ├──────────────────────────────────┤ │
│ │ 🔄 2. Patient B (In Progress)   │ │
│ │    BSC | North                   │ │
│ │    📍 456 Oak Ln, Bangalore      │ │
│ │    📞 +91-9876543210             │ │
│ │    ⚠ Wound dressing needed       │ │
│ │    Last visit: stable, continue  │ │
│ │    wound care protocol           │ │
│ │                                  │ │
│ │  [🗺 Navigate]                   │ │
│ │  [Mark Completed] [Mark Missed]  │ │
│ │  [Open Assessment Forms]         │ │
│ ├──────────────────────────────────┤ │
│ │ ⏳ 3. Patient C (Scheduled)     │ │
│ │    BSC | Central                 │ │
│ │    📍 101 Temple St, Bangalore   │ │
│ │    📞 +91-9876543211             │ │
│ │    [Start Visit]                 │ │
│ └──────────────────────────────────┘ │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ 🆕 Ad-Hoc: Patient M            │ │
│ │ Added by Lead at 11:15 AM       │ │
│ │ Reason: Urgent follow-up needed  │ │
│ │ [Start Visit]                    │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

### Interactions
- **Start Visit** → marks slot as `in_progress`
- **Mark Completed** → marks slot as `completed`, prompts to open assessment forms
- **Mark Missed** → opens dialog requiring reason selection
- **Navigate** → opens Google Maps / Leaflet map to patient address
- **Open Assessment Forms** → links to existing Saranam assessment flow

### Components
- `DailyVisitPage` - Main page
- `VisitProgressCard` - Expandable card with status indicators
- `MissedReasonDialog` - Reason selection dialog
- `NavigateButton` - Opens maps with patient location

---

## S7: Patient Pool Manager

**Route**: `/saranam/scheduling/patient-pool`
**Access**: PO-SW, Lead

### Layout
```
┌──────────────────────────────────────────────────────────────┐
│ Patient Pool                              [Recalculate]      │
├──────────┬───────────────────────────────────────────────────┤
│ Filters  │ Patient List                                      │
│          │                                                   │
│ Status:  │ # │ Name        │BSC │Cluster│Last  │Freq │Score │
│ [All ▼]  │ 1 │ Manjulamma  │ 🔴 │North  │12d   │7d   │ 95  │
│          │ 2 │ Ramesh K    │ 🔴 │South  │ 8d   │7d   │ 85  │
│ Cluster: │ 3 │ Lakshmi P   │ 🔴 │East   │ 5d   │7d   │ 70  │
│ [All ▼]  │ 4 │ Suresh M    │    │North  │ 3d   │14d  │ 40  │
│          │ 5 │ Anita R     │    │West   │ 2d   │7d   │ 35  │
│ Complex: │   │ ...         │    │       │      │     │      │
│ [All ▼]  │                                                   │
│          │ Click a patient to edit scheduling metadata        │
│ Overdue  │                                                   │
│ only: [ ]│                                                   │
│          │                                                   │
│ Flagged  │                                                   │
│ only: [ ]│                                                   │
└──────────┴───────────────────────────────────────────────────┘
```

### Interactions
- Click patient row → opens edit drawer to set: cluster, complexity, frequency, special notes
- Lead can flag/unflag patients
- "Recalculate" button triggers priority score recalculation
- Sort by any column

### Components
- `PatientPoolPage` - Main page
- `PatientPoolTable` - Sortable, filterable data table
- `PatientSchedulingEditDrawer` - Edit scheduling metadata
- `FlagPatientDialog` - Lead flag with reason

---

## S8: Weekly Review Dashboard

**Route**: `/saranam/scheduling/review-dashboard/:scheduleId`
**Access**: Lead

### Layout
```
┌──────────────────────────────────────────────────────────────────┐
│ Weekly Review: Mar 30 - Apr 5, 2026      [Complete Review]      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐   │
│  │Completion │  │BSC Cover  │  │Cluster Eff│  │Missed     │   │
│  │  92.5%    │  │  100%     │  │  68.3%    │  │    2      │   │
│  │ target≥90 │  │ target100 │  │ target≥50 │  │ target: 0 │   │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘   │
│                                                                  │
│  Day Breakdown                                                   │
│  ┌────────┬──────────┬─────────┬────────┬────────┬──────────┐  │
│  │ Day    │Scheduled │Complete │Missed  │Adhoc   │Efficiency│  │
│  ├────────┼──────────┼─────────┼────────┼────────┼──────────┤  │
│  │ Mon    │    4     │    3    │   1    │   0    │  75%     │  │
│  │ Tue    │    4     │    4    │   0    │   1    │  80%     │  │
│  │ Thu    │    3     │    3    │   0    │   0    │  60%     │  │
│  │ Fri    │    3     │    2    │   1    │   0    │  67%     │  │
│  └────────┴──────────┴─────────┴────────┴────────┴──────────┘  │
│                                                                  │
│  Missed Visit Details                                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Patient A (Mon) - Reason: Patient unavailable               ││
│  │ Patient K (Fri) - Reason: Time constraint                   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Patients Not Visited This Week                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Patient Z (BSC) - 14 days since last visit                  ││
│  │ Patient W (N-BSC) - 9 days since last visit                 ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Review Notes                                                    │
│  [______________________________________________]                │
│  [______________________________________________]                │
│                                                                  │
│  [Complete Review & Archive]                                     │
└──────────────────────────────────────────────────────────────────┘
```

### Components
- `ReviewDashboardPage` - Main page
- `MetricCard` - Individual metric with target comparison
- `DayBreakdownTable` - Per-day statistics
- `MissedVisitList` - Missed visits with reasons
- `UnvisitedPatientList` - Patients not scheduled/visited
- `ReviewNotesEditor` - Text area for Lead's review notes

---

## S9-S12: Supporting Screens

### S9: Kit Readiness Checklist
- Per-day checklist of items needed based on scheduled patients
- Checkbox for each item, "Mark Ready" button
- Alert indicator if not ready by deadline
- Link to inventory module for stock issues

### S10: Schedule Audit Log
- Chronological table of all changes
- Columns: Timestamp, Action, Actor, Details
- Filter by action type
- Expandable details column for JSON data

### S11: On-Call Roster Manager
- Calendar-style view for weekly assignments
- Assign clinician + phone numbers per week
- History of past assignments

### S12: Unscheduled Patient Alerts
- List of patients exceeding visit gap threshold
- Not scheduled for current/upcoming week
- Quick action: "Add to current schedule" or "Create proactive call"

---

## Frontend File Structure

```
frontend/src/
├── api/
│   └── scheduling.js                  (All scheduling API calls)
│
├── components/
│   └── scheduling/
│       ├── PatientCard.jsx            (Draggable patient card)
│       ├── DayColumn.jsx              (Droppable day column)
│       ├── DayHeader.jsx              (Day header with stats)
│       ├── ClusterBar.jsx             (Visual cluster breakdown)
│       ├── PatientPoolSidebar.jsx     (Left sidebar patient pool)
│       ├── TeamPanel.jsx              (Bottom team assignment)
│       ├── WarningsBanner.jsx         (Active warnings)
│       ├── StatsBar.jsx               (Bottom stats bar)
│       ├── SubmitDialog.jsx           (Pre-submit validation)
│       ├── ApprovalDialog.jsx         (Approve/send-back)
│       ├── SendBackDialog.jsx         (Send back with reason)
│       ├── ReviewSummaryPanel.jsx     (Lead review summary)
│       ├── PatientDetailDrawer.jsx    (Patient detail side drawer)
│       ├── VisitCard.jsx              (Visit card for team view)
│       ├── VisitProgressCard.jsx      (Daily visit with status)
│       ├── MissedReasonDialog.jsx     (Reason selection)
│       ├── MetricCard.jsx             (Review metric card)
│       ├── WeekBar.jsx                (Calendar week bar)
│       ├── NewScheduleDialog.jsx      (Create new schedule)
│       ├── KitChecklist.jsx           (Kit readiness items)
│       ├── AuditLogTable.jsx          (Audit log display)
│       └── OnCallEditor.jsx           (On-call assignment)
│
├── pages/
│   └── saranam/
│       └── scheduling/
│           ├── ScheduleCalendarPage.jsx    (S4 - main calendar)
│           ├── WeeklyPlanningBoard.jsx     (S2 - planning board)
│           ├── ApprovalReviewBoard.jsx     (S3 - lead review)
│           ├── MyVisitsPage.jsx            (S5 - team member view)
│           ├── DailyVisitPage.jsx          (S6 - today's visits)
│           ├── PatientPoolPage.jsx         (S7 - patient pool)
│           ├── ReviewDashboardPage.jsx     (S8 - weekly review)
│           ├── KitReadinessPage.jsx        (S9 - kit checklist)
│           ├── AuditLogPage.jsx            (S10 - audit log)
│           ├── OnCallRosterPage.jsx        (S11 - on-call)
│           ├── AlertsPage.jsx             (S12 - unscheduled alerts)
│           └── ScheduleSettingsPage.jsx    (S1 - settings)
│
├── context/
│   └── SchedulingContext.jsx          (Scheduling state management)
│
└── hooks/
    └── useScheduling.js               (Scheduling-specific hooks)
```
