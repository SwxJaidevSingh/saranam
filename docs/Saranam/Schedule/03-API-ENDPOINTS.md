# 03 - API Endpoints

Base URL: `/api/saranam/scheduling`

All endpoints require `@require_auth`. Role-specific access noted per endpoint.

---

## 1. Schedule Configuration

### `GET /api/saranam/scheduling/config`
- **Access**: Admin, Lead
- **Response**: Current schedule configuration
```json
{
  "config": {
    "visit_days": ["monday", "tuesday", "thursday", "friday"],
    "non_visit_day_labels": {"wednesday": "Case Review", "saturday": "Capacity Building"},
    "planning_day": "friday",
    "planning_deadline_time": "18:00",
    "approval_deadline_day": "saturday",
    "approval_deadline_time": "20:00",
    "max_patients_per_vehicle_per_day": 4,
    "recommended_patients_per_day": 3,
    "active_vehicles": 1,
    "cluster_efficiency_target": 50.0,
    "visit_gap_alert_threshold_days": 7,
    "notification_methods": ["in_app"],
    "proactive_call_days": ["wednesday", "saturday"],
    "auto_create_schedule": true
  }
}
```

### `PUT /api/saranam/scheduling/config`
- **Access**: Admin, Lead
- **Request Body**: Partial or full config object (only send changed fields)
- **Response**: Updated config

---

## 2. Geographic Clusters

### `GET /api/saranam/scheduling/clusters`
- **Access**: All authenticated
- **Response**: List of active clusters
```json
{
  "clusters": [
    {"id": "uuid", "name": "North", "color_hex": "#3B82F6", "pin_codes": ["560001"], "sort_order": 0}
  ]
}
```

### `POST /api/saranam/scheduling/clusters`
- **Access**: Admin, Lead
- **Request Body**: `{name, color_hex, pin_codes?, sort_order?}`

### `PUT /api/saranam/scheduling/clusters/{cluster_id}`
- **Access**: Admin, Lead

### `DELETE /api/saranam/scheduling/clusters/{cluster_id}`
- **Access**: Admin
- **Note**: Soft delete (set `is_active = false`)

---

## 3. Vehicles

### `GET /api/saranam/scheduling/vehicles`
- **Access**: All authenticated
- **Response**: List of active vehicles

### `POST /api/saranam/scheduling/vehicles`
- **Access**: Admin
- **Request Body**: `{name, registration_number?, vehicle_type?, capacity?}`

### `PUT /api/saranam/scheduling/vehicles/{vehicle_id}`
- **Access**: Admin

### `DELETE /api/saranam/scheduling/vehicles/{vehicle_id}`
- **Access**: Admin (soft delete)

---

## 4. Weekly Schedules (Core)

### `GET /api/saranam/scheduling/schedules`
- **Access**: All authenticated (Clinical Team sees only their assigned schedules)
- **Query Params**:
  - `vehicle_id` (optional) - filter by vehicle
  - `status` (optional) - filter by state
  - `week_start_date` (optional) - specific week
  - `from_date`, `to_date` (optional) - date range
  - `page`, `per_page` (pagination)
- **Response**:
```json
{
  "schedules": [
    {
      "id": "uuid",
      "week_start_date": "2026-03-30",
      "week_end_date": "2026-04-05",
      "vehicle": {"id": "uuid", "name": "Ambulance 1"},
      "status": "draft",
      "created_by": {"id": "uuid", "name": "PO-SW Name"},
      "submitted_at": null,
      "approved_at": null,
      "day_count": 4,
      "total_patients": 12,
      "bsc_patients": 8
    }
  ],
  "total": 15,
  "page": 1,
  "per_page": 10
}
```

### `POST /api/saranam/scheduling/schedules`
- **Access**: PO-SW, Lead, Admin (or System for auto-creation)
- **Request Body**:
```json
{
  "week_start_date": "2026-03-30",
  "vehicle_id": "uuid"
}
```
- **Logic**:
  1. Validate no existing DRAFT/SUBMITTED schedule for this vehicle
  2. Read `schedule_config` to determine visit days
  3. Create `WeeklySchedule` in DRAFT status
  4. Auto-create `ScheduleDay` rows for each visit day in the week
  5. Log `schedule_created` in audit log
- **Response**: Full schedule object with empty days

### `GET /api/saranam/scheduling/schedules/{schedule_id}`
- **Access**: All authenticated (role-filtered view)
- **Response**: Full schedule with days, slots, team assignments
```json
{
  "schedule": {
    "id": "uuid",
    "week_start_date": "2026-03-30",
    "week_end_date": "2026-04-05",
    "vehicle": {"id": "uuid", "name": "Ambulance 1"},
    "status": "draft",
    "created_by": {"id": "uuid", "name": "..."},
    "submitted_at": null,
    "submitted_note": null,
    "approved_at": null,
    "approval_note": null,
    "sent_back_reason": null,
    "review_metrics": null,
    "days": [
      {
        "id": "uuid",
        "date": "2026-03-30",
        "day_of_week": "monday",
        "day_note": null,
        "kit_ready": false,
        "cluster_efficiency": null,
        "slots": [
          {
            "id": "uuid",
            "patient": {"id": "uuid", "name": "...", "care_status": "bsc", "cluster": "North"},
            "slot_order": 0,
            "status": "scheduled",
            "is_adhoc": false,
            "exception_note": null,
            "visit_id": null
          }
        ],
        "team": [
          {"user_id": "uuid", "name": "Dr. Smith", "role": "physician"},
          {"user_id": "uuid", "name": "Nurse Joy", "role": "nurse"}
        ]
      }
    ],
    "audit_log": [...]
  }
}
```

### `DELETE /api/saranam/scheduling/schedules/{schedule_id}`
- **Access**: Admin, Lead (only if status is DRAFT)
- **Logic**: Soft delete the schedule and all related days/slots

---

## 5. Schedule State Transitions

### `POST /api/saranam/scheduling/schedules/{schedule_id}/submit`
- **Access**: PO-SW
- **Allowed From**: DRAFT
- **Request Body**: `{note?: "message to Lead"}`
- **Logic**:
  1. Validate schedule is in DRAFT
  2. Run pre-submit validations (return warnings, don't block)
  3. Set status = 'submitted', submitted_at, submitted_by, submitted_note
  4. Log `schedule_submitted` in audit
  5. Notify Lead
- **Response**:
```json
{
  "schedule": {...},
  "warnings": [
    {"type": "bsc_not_scheduled", "severity": "critical", "message": "BSC patient Manjulamma not scheduled", "patient_id": "uuid"},
    {"type": "over_capacity", "severity": "warning", "message": "Tuesday has 5 patients (max 4)"},
    {"type": "no_team", "severity": "warning", "message": "Thursday has no team assigned"},
    {"type": "low_cluster_efficiency", "severity": "info", "message": "Monday cluster efficiency: 40%"}
  ]
}
```

### `POST /api/saranam/scheduling/schedules/{schedule_id}/approve`
- **Access**: Lead
- **Allowed From**: SUBMITTED
- **Request Body**: `{note?: "approval note"}`
- **Logic**:
  1. Set status = 'approved', approved_at, approved_by, approval_note
  2. Log `schedule_approved`
  3. Auto-trigger notification sending (→ COMMUNICATED)
  4. Send notifications to all assigned team members
  5. Set status = 'communicated', communicated_at

### `POST /api/saranam/scheduling/schedules/{schedule_id}/send-back`
- **Access**: Lead
- **Allowed From**: SUBMITTED
- **Request Body**: `{reason: "explanation"}` (required)
- **Logic**:
  1. Set status = 'draft', sent_back_reason
  2. Log `schedule_sent_back`
  3. Notify PO-SW with the reason

### `POST /api/saranam/scheduling/schedules/{schedule_id}/activate`
- **Access**: System (auto-triggered) or Lead (manual)
- **Allowed From**: COMMUNICATED
- **Logic**: Set status = 'in_progress', log `schedule_activated`

### `POST /api/saranam/scheduling/schedules/{schedule_id}/complete-review`
- **Access**: Lead
- **Allowed From**: REVIEW_READY
- **Request Body**: `{review_notes?: "..."}`
- **Logic**:
  1. Set status = 'archived', review_completed_at, review_completed_by, review_notes
  2. Log `schedule_archived`

---

## 6. Schedule Day Operations

### `PUT /api/saranam/scheduling/days/{day_id}`
- **Access**: PO-SW (DRAFT), Lead (DRAFT/SUBMITTED/IN_PROGRESS)
- **Request Body**: `{day_note?: "...", kit_ready?: true}`
- **Logic**: Update day, log changes

### `PUT /api/saranam/scheduling/days/{day_id}/kit-ready`
- **Access**: PO-SW, Nurse
- **Request Body**: `{ready: true}`
- **Logic**: Set kit_ready, kit_ready_at, kit_ready_by, log `kit_marked_ready`

---

## 7. Schedule Slot Operations (Patient Assignment)

### `POST /api/saranam/scheduling/days/{day_id}/slots`
- **Access**: PO-SW (DRAFT), Lead (DRAFT/SUBMITTED/IN_PROGRESS)
- **Request Body**:
```json
{
  "patient_id": "uuid",
  "slot_order": 2,
  "exception_note": "Patient requested afternoon only",
  "is_adhoc": false,
  "adhoc_reason": null
}
```
- **Logic**:
  1. Validate patient not already scheduled on this day
  2. Create slot
  3. Recompute cluster_efficiency for the day
  4. Log `patient_added` (or `adhoc_visit_added` if is_adhoc)
  5. If ad-hoc (IN_PROGRESS), notify team members

### `PUT /api/saranam/scheduling/slots/{slot_id}`
- **Access**: PO-SW (DRAFT), Lead (DRAFT/SUBMITTED/IN_PROGRESS), Team (IN_PROGRESS - status only)
- **Request Body**: `{slot_order?, status?, exception_note?, missed_reason?, cancelled_reason?}`
- **Logic**:
  - Team can only update: status, missed_reason, cancelled_reason, started_at, completed_at
  - PO-SW/Lead can update all fields

### `POST /api/saranam/scheduling/slots/{slot_id}/move`
- **Access**: PO-SW (DRAFT), Lead (DRAFT/SUBMITTED/IN_PROGRESS)
- **Request Body**: `{to_day_id: "uuid", new_slot_order: 1}`
- **Logic**:
  1. Remove from current day
  2. Add to target day
  3. Reorder affected slots
  4. Recompute cluster efficiency for both days
  5. Log `patient_moved`

### `DELETE /api/saranam/scheduling/slots/{slot_id}`
- **Access**: PO-SW (DRAFT), Lead (DRAFT/SUBMITTED/IN_PROGRESS)
- **Request Body**: `{reason?: "..."}` (required if IN_PROGRESS)
- **Logic**: Remove slot, reorder remaining, recompute efficiency, log `patient_removed`

### `PUT /api/saranam/scheduling/slots/{slot_id}/status`
- **Access**: Clinical Team (IN_PROGRESS only)
- **Request Body**:
```json
{
  "status": "completed",
  "visit_id": "uuid"
}
```
- **Valid Transitions**: scheduled → in_progress → completed / missed / cancelled
- **Logic**:
  - If `completed`: Optionally link `visit_id` from PatientVisit
  - If `missed`: Require `missed_reason`
  - If `cancelled`: Require `cancelled_reason`

### `POST /api/saranam/scheduling/days/{day_id}/reorder`
- **Access**: PO-SW (DRAFT), Lead (DRAFT/SUBMITTED)
- **Request Body**: `{slot_ids: ["uuid1", "uuid2", "uuid3"]}` (ordered array)
- **Logic**: Update slot_order based on array position

---

## 8. Team Assignment Operations

### `PUT /api/saranam/scheduling/days/{day_id}/team`
- **Access**: PO-SW (DRAFT), Lead (DRAFT/SUBMITTED/IN_PROGRESS)
- **Request Body**:
```json
{
  "assignments": [
    {"user_id": "uuid", "role": "physician"},
    {"user_id": "uuid", "role": "nurse"},
    {"user_id": "uuid", "role": "counselor"}
  ]
}
```
- **Logic**:
  1. Replace all team assignments for the day
  2. Log `team_changed` with old and new assignments
  3. If IN_PROGRESS (ad-hoc), notify affected team members

---

## 9. Patient Pool

### `GET /api/saranam/scheduling/patient-pool`
- **Access**: PO-SW, Lead
- **Query Params**:
  - `cluster_id` (optional)
  - `care_status` (optional) - bsc, n_bsc
  - `complexity` (optional) - high, medium, low
  - `sort_by` (default: priority_score desc)
  - `exclude_scheduled_week` (optional) - week_start_date to exclude already-scheduled patients
  - `search` (optional) - patient name search
  - `page`, `per_page`
- **Response**:
```json
{
  "patients": [
    {
      "patient_id": "uuid",
      "name": "Patient Name",
      "age": 65,
      "gender": "F",
      "care_status": "bsc",
      "complexity": "high",
      "cluster": {"id": "uuid", "name": "North", "color_hex": "#3B82F6"},
      "last_visit_date": "2026-03-20",
      "days_since_last_visit": 6,
      "recommended_frequency_days": 7,
      "next_recommended_visit": "2026-03-27",
      "priority_score": 95,
      "special_notes": "Only morning visits",
      "lead_flagged": true,
      "lead_flag_reason": "Condition deteriorating",
      "recently_hospitalized": false,
      "is_overdue": false,
      "scheduled_this_week": false
    }
  ],
  "total": 45,
  "summary": {
    "total_active": 45,
    "bsc_count": 12,
    "n_bsc_count": 33,
    "overdue_count": 5,
    "flagged_count": 2
  }
}
```

### `GET /api/saranam/scheduling/patient-pool/{patient_id}`
- **Access**: PO-SW, Lead
- **Response**: Detailed patient scheduling info with visit history summary

### `PUT /api/saranam/scheduling/patient-pool/{patient_id}`
- **Access**: PO-SW, Lead
- **Request Body**: `{cluster_id?, complexity?, recommended_frequency_days?, special_notes?, scheduling_active?}`
- **Logic**: Update patient_scheduling_meta

### `POST /api/saranam/scheduling/patient-pool/{patient_id}/flag`
- **Access**: Lead
- **Request Body**: `{flagged: true, reason: "Condition deteriorating"}`

### `POST /api/saranam/scheduling/patient-pool/recalculate-priorities`
- **Access**: Admin, Lead, System
- **Logic**: Recalculate priority_score for all active patients

---

## 10. Notifications & Acknowledgments

### `GET /api/saranam/scheduling/schedules/{schedule_id}/acknowledgments`
- **Access**: PO-SW, Lead
- **Response**: List of team members with acknowledgment status

### `POST /api/saranam/scheduling/schedules/{schedule_id}/acknowledge`
- **Access**: Clinical Team (own acknowledgment only)
- **Logic**: Mark current user as having acknowledged the schedule

---

## 11. My Schedule (Team Member View)

### `GET /api/saranam/scheduling/my-schedule`
- **Access**: Clinical Team
- **Query Params**: `week_start_date` (optional, defaults to current week)
- **Response**: Only the days and patients assigned to the current user
```json
{
  "week": {
    "week_start_date": "2026-03-30",
    "status": "in_progress",
    "days": [
      {
        "date": "2026-03-30",
        "day_of_week": "monday",
        "patients": [
          {
            "slot_id": "uuid",
            "patient": {"id": "uuid", "name": "...", "address": "...", "phone": "...", "cluster": "North"},
            "slot_order": 0,
            "status": "scheduled",
            "exception_note": null,
            "last_visit_summary": "Visit 5 - stable condition",
            "alerts": ["BSC", "Catheter"]
          }
        ]
      }
    ]
  }
}
```

### `GET /api/saranam/scheduling/my-schedule/today`
- **Access**: Clinical Team
- **Response**: Today's patients in visit order (Daily Visit View)

---

## 12. Review & Metrics

### `GET /api/saranam/scheduling/schedules/{schedule_id}/review`
- **Access**: Lead
- **Response**: Review dashboard data with all metrics
```json
{
  "review": {
    "schedule_id": "uuid",
    "week": "2026-03-30 to 2026-04-05",
    "metrics": {
      "visit_completion_rate": 92.5,
      "bsc_coverage": 100,
      "cluster_efficiency": 68.3,
      "missed_visits": {"total": 2, "reasons": {"patient_unavailable": 1, "time_constraint": 1}},
      "adhoc_visits": 1,
      "team_acknowledgment_rate": 100,
      "patients_not_visited": {"total": 3, "patients": [...]},
      "avg_patients_per_day": 3.5,
      "schedule_turnaround_hours": 18.5
    },
    "day_breakdown": [
      {
        "date": "2026-03-30",
        "scheduled": 4,
        "completed": 3,
        "missed": 1,
        "cancelled": 0,
        "adhoc": 0,
        "cluster_efficiency": 75.0
      }
    ],
    "missed_details": [...],
    "adhoc_details": [...]
  }
}
```

---

## 13. Audit Log

### `GET /api/saranam/scheduling/schedules/{schedule_id}/audit-log`
- **Access**: Lead, Admin
- **Query Params**: `action` (optional filter), `page`, `per_page`
- **Response**: Chronological list of all changes

---

## 14. On-Call Roster

### `GET /api/saranam/scheduling/on-call`
- **Access**: All authenticated
- **Query Params**: `week_start_date`

### `POST /api/saranam/scheduling/on-call`
- **Access**: PO-SW, Lead
- **Request Body**: `{week_start_date, clinician_user_id, phone_numbers?, notes?}`

### `PUT /api/saranam/scheduling/on-call/{roster_id}`
- **Access**: PO-SW, Lead

### `DELETE /api/saranam/scheduling/on-call/{roster_id}`
- **Access**: PO-SW, Lead

---

## 15. Unscheduled Patient Alerts

### `GET /api/saranam/scheduling/alerts/unscheduled`
- **Access**: PO-SW, Lead
- **Query Params**: `week_start_date` (optional, defaults to current week)
- **Response**: Patients exceeding visit gap threshold who are NOT scheduled this week
```json
{
  "alerts": [
    {
      "patient_id": "uuid",
      "name": "...",
      "care_status": "bsc",
      "days_since_last_visit": 12,
      "recommended_frequency_days": 7,
      "days_overdue": 5,
      "cluster": "South",
      "priority_score": 95
    }
  ],
  "total": 5
}
```

---

## Backend File Structure

```
backend/app/saranam/
├── models/
│   ├── __init__.py              (add new model imports)
│   ├── schedule_config.py       (ScheduleConfig)
│   ├── geographic_cluster.py    (GeographicCluster)
│   ├── vehicle.py               (Vehicle)
│   ├── weekly_schedule.py       (WeeklySchedule)
│   ├── schedule_day.py          (ScheduleDay)
│   ├── schedule_slot.py         (ScheduleSlot)
│   ├── schedule_team_assignment.py (ScheduleTeamAssignment)
│   ├── patient_scheduling_meta.py  (PatientSchedulingMeta)
│   ├── schedule_audit_log.py    (ScheduleAuditLog)
│   ├── on_call_roster.py        (OnCallRoster)
│   └── schedule_notification.py (ScheduleNotification)
├── routes/
│   ├── schedule_config_routes.py
│   ├── cluster_routes.py
│   ├── vehicle_routes.py
│   ├── weekly_schedule_routes.py
│   ├── schedule_slot_routes.py
│   ├── team_assignment_routes.py
│   ├── patient_pool_routes.py
│   ├── my_schedule_routes.py
│   ├── review_routes.py
│   ├── on_call_routes.py
│   └── alert_routes.py
├── services/
│   ├── schedule_service.py       (Core schedule CRUD + state transitions)
│   ├── slot_service.py           (Patient slot management)
│   ├── team_service.py           (Team assignment logic)
│   ├── patient_pool_service.py   (Patient pool + priority scoring)
│   ├── review_service.py         (Metrics computation)
│   ├── notification_service.py   (Notification dispatch)
│   ├── cluster_service.py        (Cluster efficiency calculation)
│   └── audit_service.py          (Audit log writing)
```
