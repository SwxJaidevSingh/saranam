# 05 - Team Management

---

## Overview

The team management system handles:
1. **Care Teams** - Groups of healthcare professionals assigned to a vehicle
2. **Per-Day Assignment** - Which team members work on which day of the schedule
3. **Role-Based Composition** - Each team has defined roles (physician, nurse, counselor, etc.)
4. **On-Call Roster** - Weekly on-call clinician assignment for after-hours

---

## Team Roles

| Role | Code | Description | Required Per Day? |
|------|------|-------------|-------------------|
| Physician | `physician` | Doctor who conducts clinical assessments | Yes (at least 1) |
| Nurse | `nurse` | Nursing staff for wound care, vitals, etc. | Yes (at least 1) |
| Counselor | `counselor` | Psychological/social support | Recommended |
| Physiotherapist | `physio` | Physical therapy assessments | Optional |
| Social Worker | `social_worker` | Social support, family counseling | Optional |
| Driver | `driver` | Vehicle driver | Yes (at least 1) |
| PO-SW | `po_sw` | Program Officer / Social Worker (coordinator) | Optional on field |

---

## How Team Assignment Works

### During Planning (DRAFT State)

1. PO-SW opens the Weekly Planning Board (S2)
2. The **Team Panel** at the bottom shows one row per visit day
3. Each row has dropdown selectors for each role
4. Dropdowns show all users with the matching role who are **available** (not on leave, not assigned to another vehicle on the same day)
5. PO-SW selects team members per day

### Team Panel UI

```
┌──────────────────────────────────────────────────────────────────┐
│ TEAM ASSIGNMENTS                                                  │
├──────────┬──────────────┬──────────────┬───────────┬─────────────┤
│ Day      │ Physician    │ Nurse        │ Counselor │ Driver      │
├──────────┼──────────────┼──────────────┼───────────┼─────────────┤
│ Monday   │ [Dr.Smith ▼] │ [Nurse Joy▼] │ [-- ▼]   │ [Raju ▼]   │
│ Tuesday  │ [Dr.Smith ▼] │ [Nurse Joy▼] │ [Ram ▼]  │ [Raju ▼]   │
│ Thursday │ [Dr.Patel ▼] │ [Nurse Joy▼] │ [-- ▼]   │ [Raju ▼]   │
│ Friday   │ [Dr.Smith ▼] │ [Nurse Ami▼] │ [Ram ▼]  │ [Raju ▼]   │
└──────────┴──────────────┴──────────────┴───────────┴─────────────┘
```

### Validation Rules (Warnings, Not Blocks)

| Rule | Severity | Message |
|------|----------|---------|
| No physician assigned to a day | Warning | "Thursday has no physician assigned" |
| No nurse assigned to a day | Warning | "Monday has no nurse assigned" |
| No driver assigned to a day | Warning | "Tuesday has no driver assigned" |
| Same person assigned to multiple vehicles on same day | Error | "Dr.Smith is assigned to Ambulance 2 on Monday" |
| Person on leave assigned to a day | Warning | "Nurse Joy has approved leave on Friday" |

---

## User-Role Mapping

The existing `User` model has a `role` field (admin, data_entry, viewer). For scheduling, we need a **clinical role** concept. Two approaches:

### Approach: Use Existing HealthcareProvider Model

The codebase already has a `HealthcareProvider` model with:
- `user_id` (FK to User)
- `specialization` (physician, nurse, counselor, etc.)
- `hpr_id` (Healthcare Provider Registry ID)
- `is_active`

**This is the recommended approach.** Link scheduling team assignments to users who have a corresponding `HealthcareProvider` record.

```python
# In ScheduleTeamAssignment
user_id = Column(UUID, ForeignKey('users.id'))  # The user
role = Column(String(50))  # The clinical role for this assignment
# Role is stored per-assignment (not derived from provider) because
# a person might fill different roles on different days
```

### Team Member Availability Query

```sql
-- Get available physicians for a given date
SELECT u.id, u.name, hp.specialization
FROM users u
JOIN healthcare_providers hp ON hp.user_id = u.id
WHERE hp.specialization = 'physician'
  AND hp.is_active = true
  AND u.is_active = true
  AND u.id NOT IN (
    -- Already assigned to another vehicle on this date
    SELECT sta.user_id
    FROM schedule_team_assignments sta
    JOIN schedule_days sd ON sd.id = sta.schedule_day_id
    WHERE sd.date = :target_date
  )
ORDER BY u.name;
```

---

## On-Call Roster

### Purpose
- Track which clinician is on-call for after-hours emergencies each week
- Displayed on the team's schedule view
- Phone number readily accessible

### Management Flow
1. PO-SW opens On-Call Roster Manager (S11)
2. Selects the week
3. Assigns a clinician from the dropdown
4. Adds phone numbers (can be multiple)
5. Saves

### Display
- On-call info shown on:
  - My Visits This Week (S5) - top banner
  - Daily Visit View (S6) - accessible via info icon
  - Schedule Calendar (S4) - on week hover

---

## Team Notifications

When a schedule is approved (→ COMMUNICATED state):

1. **Each team member gets personalized notification** containing ONLY their assigned days:
   ```
   Your visits for Mar 30 - Apr 5:

   Monday, Mar 30:
   - Patient A (BSC, North cluster)
   - Patient B (N-BSC, North cluster)
   - Patient C (BSC, Central cluster)

   Thursday, Apr 2:
   - Patient G (BSC, East cluster)
   - Patient H (N-BSC, East cluster)
   ```

2. **Notification channels**: In-app (always), WhatsApp (if configured)

3. **Acknowledgment tracking**:
   - Each team member must tap "Acknowledge" within 12 hours
   - PO-SW and Lead can see acknowledgment status on a dedicated panel
   - Reminder notification sent if not acknowledged within 6 hours

---

## Team Performance Tracking (Future - V2)

Track per-team-member metrics over time:
- Visit completion rate per team member
- Average visits per week
- On-time acknowledgment rate
- Patient feedback (if captured)

This data feeds into the Review Dashboard (S8) and historical analytics.
