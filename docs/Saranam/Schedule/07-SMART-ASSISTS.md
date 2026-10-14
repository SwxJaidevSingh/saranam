# 07 - Smart Assists, Warnings & Alerts

---

## Philosophy

Smart assists are **hints, not rules**. They help the PO-SW make better decisions without blocking them. The system warns; the human decides.

---

## 1. Planning Board Warnings (S2/S3)

These appear in the Warnings Banner at the top of the Planning Board.

### Critical Warnings (Red)

| Warning | Trigger | Message |
|---------|---------|---------|
| BSC not scheduled | Active BSC patient not in any day this week | "BSC patient {name} not scheduled (last visit {N} days ago)" |
| BSC patient missed | BSC patient's slot status is 'missed' (during execution) | "BSC patient {name} visit missed on {day}" |

### Standard Warnings (Yellow)

| Warning | Trigger | Message |
|---------|---------|---------|
| Over capacity | Day has more patients than `max_patients_per_vehicle_per_day` | "{Day} has {N} patients (max is {max})" |
| No team assigned | Day has scheduled patients but no team assignments | "{Day} has no team assigned" |
| No physician | Day has team but no physician role | "{Day} has no physician assigned" |
| No nurse | Day has team but no nurse role | "{Day} has no nurse assigned" |
| Visit overdue | Patient in sidebar with days_since > recommended_frequency + 3 | "{name}: {N} days since last visit (recommended every {freq} days)" |

### Info Notices (Blue)

| Notice | Trigger | Message |
|--------|---------|---------|
| Low cluster efficiency | Day's cluster efficiency < target | "{Day} cluster efficiency: {N}% (target {target}%)" |
| Patient marked "cannot visit" | PO-SW marked a patient as cannot visit this week | "{name} marked as cannot visit: {reason}" |
| Ad-hoc visit added | Lead added an ad-hoc visit (during execution) | "Ad-hoc visit added: {name} on {day} by {lead_name}" |

---

## 2. Pre-Submit Validation

When PO-SW clicks "Submit for Approval", a validation dialog shows a summary before confirming.

### Validation Checks

```python
def validate_schedule(schedule_id: str) -> dict:
    """Run all pre-submit validations. Returns warnings, never blocks."""
    warnings = []

    # 1. BSC patients not scheduled
    unscheduled_bsc = get_unscheduled_bsc_patients(schedule_id)
    for patient in unscheduled_bsc:
        warnings.append({
            "type": "bsc_not_scheduled",
            "severity": "critical",
            "message": f"BSC patient {patient.name} not scheduled "
                       f"(last visit {patient.days_since_last_visit} days ago)",
            "patient_id": str(patient.id)
        })

    # 2. Days exceeding capacity
    for day in schedule.days:
        slot_count = len(day.slots)
        if slot_count > config.max_patients_per_vehicle_per_day:
            warnings.append({
                "type": "over_capacity",
                "severity": "warning",
                "message": f"{day.day_of_week.title()} has {slot_count} patients "
                           f"(max is {config.max_patients_per_vehicle_per_day})"
            })

    # 3. Days with no team
    for day in schedule.days:
        if len(day.slots) > 0 and len(day.team_assignments) == 0:
            warnings.append({
                "type": "no_team",
                "severity": "warning",
                "message": f"{day.day_of_week.title()} has no team assigned"
            })

    # 4. Cluster efficiency below target
    for day in schedule.days:
        if day.cluster_efficiency and day.cluster_efficiency < config.cluster_efficiency_target:
            warnings.append({
                "type": "low_cluster_efficiency",
                "severity": "info",
                "message": f"{day.day_of_week.title()} cluster efficiency: "
                           f"{day.cluster_efficiency}% (target {config.cluster_efficiency_target}%)"
            })

    # 5. Patients marked "cannot visit"
    cannot_visit = get_cannot_visit_patients(schedule_id)
    for entry in cannot_visit:
        warnings.append({
            "type": "cannot_visit",
            "severity": "info",
            "message": f"{entry.patient_name} cannot visit this week: {entry.reason}"
        })

    return {
        "valid": True,  # Always true - warnings don't block
        "warnings": warnings,
        "summary": {
            "total_patients": total_scheduled,
            "bsc_scheduled": bsc_count,
            "bsc_total": total_bsc,
            "bsc_coverage": f"{bsc_count}/{total_bsc}",
            "avg_cluster_efficiency": avg_efficiency
        }
    }
```

### Pre-Submit Dialog UI

```
┌──────────────────────────────────────────────────────────┐
│ Submit Schedule for Approval                              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ Summary                                                  │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Total patients: 14                                   │ │
│ │ BSC coverage: 8/10 (80%)                             │ │
│ │ Average cluster efficiency: 62%                      │ │
│ │ Days planned: 4                                      │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ 🔴 Critical Issues (2)                                   │
│ • BSC patient Manjulamma not scheduled (12 days ago)     │
│ • BSC patient Ramesh not scheduled (9 days ago)          │
│                                                          │
│ 🟡 Warnings (1)                                          │
│ • Tuesday has 5 patients (max is 4)                      │
│                                                          │
│ ℹ Info (2)                                               │
│ • Monday cluster efficiency: 40% (target 50%)           │
│ • Patient Suresh marked cannot visit: on vacation        │
│                                                          │
│ Note to Lead (optional):                                 │
│ [____________________________________________]           │
│                                                          │
│ [Cancel]                          [Submit Anyway]        │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Real-Time Drag Assists

### Cluster Highlighting
When PO-SW starts dragging a patient card:
1. Identify the patient's cluster
2. In the sidebar, add a subtle glow/border to all other patients from the same cluster
3. In the day columns, highlight any day that already has patients from the same cluster
4. This helps PO-SW naturally group patients by geography

### Capacity Indicator
- Day column header shows `3/4 pts` — current vs max
- When dragging a patient over a day that's at/over capacity, the header turns amber/red
- Drop is still allowed (warnings, not blocks)

### Conflict Detection
When PO-SW drags a patient into a day:
1. Check if patient has a teleconsult appointment on that date (from `encounters` table)
2. If conflict found, show a yellow tooltip: "Patient has teleconsult at 2:00 PM on this day"
3. Don't block — PO-SW can still schedule

---

## 4. BSC Coverage Tracker

A persistent progress bar at the top of the Planning Board.

```
BSC Coverage: ████████░░ 8/10 scheduled this week
```

- Updates in real-time as patients are added/removed
- Green when 100%, Yellow when 50-99%, Red when <50%
- Clicking it shows the list of unscheduled BSC patients

---

## 5. Execution-Phase Alerts

During IN_PROGRESS state:

### Kit Readiness Alert
- **Trigger**: It's 6 PM and tomorrow's kit is not marked as ready
- **Recipients**: PO-SW, Lead
- **Message**: "Kit for tomorrow ({day}, {date}) is not ready. Please prepare."

### Visit Reminder
- **Trigger**: Morning of a visit day
- **Recipients**: Assigned team members
- **Message**: "You have {N} visits today. First patient: {name} at {address}."

### Ad-Hoc Change Notification
- **Trigger**: Lead adds/cancels a visit during the week
- **Recipients**: Affected team members, PO-SW
- **Message**: "Schedule change: {patient_name} {added to / removed from} {day}. Reason: {reason}"

### Acknowledgment Reminder
- **Trigger**: 6 hours after schedule communicated, team member hasn't acknowledged
- **Recipients**: The unacknowledged team member
- **Message**: "Please acknowledge your schedule for {week_range}."

---

## 6. Unscheduled Patient Alerts (S12)

### Auto-Generated Alert List
- **Trigger**: After weekly schedule is finalized (APPROVED)
- **Logic**: Find all active patients who:
  - Are NOT scheduled in the current week
  - Have `days_since_last_visit > visit_gap_alert_threshold_days`
- **Sorted by**: days_since_last_visit descending (most overdue first)
- **Displayed on**: Dedicated alerts page (S12) + badge count on sidebar nav

### Proactive Call Integration
- On configured proactive call days (default: Wed, Sat), the alert list feeds into a proactive call workflow
- PO-SW can assign callers to each patient on the list
- If caller identifies urgent need, they can trigger an ad-hoc visit request

---

## 7. Smart Assist Roadmap

### V1 (Current Implementation)
- Warning banners (critical, warning, info)
- Pre-submit validation dialog
- Cluster color badges on patient cards
- BSC coverage progress bar
- Visit overdue badges in sidebar
- Capacity indicators on day headers

### V2 (Future)
- Cluster highlighting on drag
- Conflict detection (teleconsult overlap)
- Auto-suggest schedule based on priority + cluster algorithm
- Route optimization visualization
- Predictive visit frequency based on patient trajectory
