# 01 - Schedule Lifecycle (State Machine)

## State Diagram

Based on the HLD, the schedule goes through these states:

```
                    ┌─────────────────────────────────────────┐
                    │                                         │
    [System]        ▼                                         │
  Planning Day  ┌───────┐   PO-SW    ┌───────────┐  Lead     │
  Triggers ───► │ DRAFT │──submits──►│ SUBMITTED │──sends───┘
                └───────┘            └───────────┘  back
                    ▲                      │
                    │                      │ Lead approves
                    │                      ▼
                    │               ┌───────────┐
                    │               │ APPROVED  │
                    │               └───────────┘
                    │                      │
                    │                      │ Team notified
                    │                      ▼
                    │               ┌──────────────┐
                    │               │ COMMUNICATED │
                    │               └──────────────┘
                    │                      │
                    │                      │ Visit week starts
                    │                      ▼
                    │               ┌──────────────┐◄─────────┐
                    │               │  IN_PROGRESS │          │
                    │               └──────────────┘          │
                    │                 │    │    │              │
                    │    Visits       │    │    │  Ad-hoc      │
                    │    executed     │    │    │  change      │
                    │    daily ───────┘    │    │  applied     │
                    │                     │    ▼              │
                    │                     │  ┌──────────┐    │
                    │                     │  │ MODIFIED │────┘
                    │                     │  └──────────┘
                    │                     │
                    │                     │ Week ends
                    │                     ▼
                    │               ┌──────────────┐
                    │               │ REVIEW_READY │
                    │               └──────────────┘
                    │                      │
                    │                      │ Review completed
                    │                      ▼
                    │               ┌───────────┐
                    │               │ ARCHIVED  │ (terminal)
                    │               └───────────┘
```

---

## State Definitions

### 1. DRAFT
- **Owner**: PO-SW
- **Entry**: System auto-creates on planning day OR Lead sends back from SUBMITTED
- **Actions Allowed**:
  - PO-SW adds/removes/reorders patients on day columns
  - PO-SW assigns team members per day
  - PO-SW adds day notes and patient exception notes
  - PO-SW can freely modify anything
- **Exit**: PO-SW clicks "Submit for Approval" → SUBMITTED
- **Rules**:
  - Only ONE schedule can be in DRAFT state per vehicle at a time
  - Pre-submit validation runs but doesn't block (warnings only)

### 2. SUBMITTED
- **Owner**: Lead (for review)
- **Entry**: PO-SW submits the draft
- **Actions Allowed**:
  - Lead views the full schedule with PO-SW's notes
  - Lead can modify: move patients, change order, change team, add patients
  - Lead modifications are highlighted (different color in UI)
  - PO-SW can view but NOT edit
- **Exit**:
  - Lead approves → APPROVED
  - Lead approves with changes → APPROVED (changes logged)
  - Lead sends back → DRAFT (must add comment explaining why)

### 3. APPROVED
- **Owner**: System
- **Entry**: Lead approves the schedule
- **Actions Allowed**:
  - System prepares notifications
  - Schedule is locked for PO-SW edits
  - No manual actions needed in this state (auto-transitions)
- **Exit**: System sends notifications to team → COMMUNICATED
- **Rules**:
  - This is a transient state - auto-transitions to COMMUNICATED once notifications are sent

### 4. COMMUNICATED
- **Owner**: System + Team
- **Entry**: Notifications sent to all assigned team members
- **Actions Allowed**:
  - Team members view their assigned visits
  - Team members acknowledge receipt ("Seen" button)
  - Track acknowledgment status (who has / hasn't acknowledged)
  - SOP: Acknowledgment required within 12 hours
- **Exit**: First visit day of the week arrives → IN_PROGRESS
- **Rules**:
  - Alert if not all team members have acknowledged by deadline
  - Schedule PDF download available

### 5. IN_PROGRESS
- **Owner**: Team + Lead
- **Entry**: Visit week starts (first visit day) OR returns from MODIFIED
- **Actions Allowed**:
  - Team executes visits daily
  - Team marks visit status: Not Started → In Progress → Completed / Missed / Cancelled
  - Team links visits to assessment forms
  - Lead can insert ad-hoc visits (get "Ad-Hoc" badge)
  - Lead can cancel scheduled visits (must provide reason)
  - All ad-hoc changes logged in audit trail
  - PO-SW gets notified of ad-hoc changes
- **Exit**:
  - Ad-hoc change applied → MODIFIED (temporary)
  - Last visit day of the week ends → REVIEW_READY
- **Loops**: "Visits executed daily" - loops back to IN_PROGRESS each day

### 6. MODIFIED
- **Owner**: Lead
- **Entry**: Lead applies an ad-hoc change during an active week
- **Actions Allowed**:
  - The modification is recorded in audit log
  - Affected team members are notified of the change
  - PO-SW is notified
- **Exit**: Change applied and notifications sent → IN_PROGRESS
- **Rules**:
  - This is a transient state for tracking purposes
  - Every transition through MODIFIED creates an audit log entry

### 7. REVIEW_READY
- **Owner**: Lead
- **Entry**: Week's last visit day ends (system auto-transitions)
- **Actions Allowed**:
  - System auto-generates review summary with metrics
  - Lead reviews during Wednesday case review meeting
  - Lead can add review notes and action items
  - Lead reviews missed visits and reasons
  - Insights feed into next week's planning
- **Exit**: Lead marks review as completed → ARCHIVED
- **Auto-Generated Metrics**:
  - Visit Completion Rate (target: >=90%)
  - BSC Coverage (target: 100%)
  - Cluster Efficiency (target: >=50%)
  - Missed Visits count + reasons breakdown
  - Ad-Hoc Visits count
  - Team Acknowledgment rate
  - Patients Not Visited + reasons
  - Average Patients Per Day
  - Schedule Turnaround time (DRAFT → APPROVED)

### 8. ARCHIVED
- **Owner**: System
- **Entry**: Lead completes the review
- **Actions Allowed**: Read-only. Searchable for reporting and historical trends.
- **Exit**: Terminal state - no further transitions
- **Rules**: Multiple schedules can be in ARCHIVED state

---

## Transition Rules Summary

| From | To | Trigger | Actor |
|------|----|---------|-------|
| (none) | DRAFT | Planning day triggers auto-creation | System |
| DRAFT | SUBMITTED | PO-SW clicks "Submit for Approval" | PO-SW |
| SUBMITTED | APPROVED | Lead approves | Lead |
| SUBMITTED | DRAFT | Lead sends back (with comment) | Lead |
| APPROVED | COMMUNICATED | Notifications sent to team | System |
| COMMUNICATED | IN_PROGRESS | First visit day of the week arrives | System |
| IN_PROGRESS | IN_PROGRESS | Visits executed daily | Team |
| IN_PROGRESS | MODIFIED | Ad-hoc change by Lead | Lead |
| MODIFIED | IN_PROGRESS | Change applied & team notified | System |
| IN_PROGRESS | REVIEW_READY | Last visit day of week ends | System |
| REVIEW_READY | ARCHIVED | Lead completes review | Lead |

---

## Constraints

1. **One DRAFT per vehicle** - Only one schedule can be in DRAFT or SUBMITTED state per vehicle
2. **One ACTIVE per vehicle** - Only one schedule can be in IN_PROGRESS/COMMUNICATED state per vehicle
3. **Multiple ARCHIVED** - Any number of schedules can be archived
4. **No skipping states** - Must follow the transition path (no jumping from DRAFT to IN_PROGRESS)
5. **Audit everything** - Every state transition is logged with actor, timestamp, and reason
