# 08 - Integration Points

---

## 1. Existing Saranam Visit System

### The Core Integration
The scheduling system **wraps around** the existing PatientVisit system. It does NOT replace it.

**Flow**:
```
Schedule Slot (scheduled)
  → Team starts visit
  → Schedule Slot (in_progress)
  → Team opens assessment forms
  → PatientVisit created (existing Saranam flow)
  → Assessments filled (nursing, doctor, psych, physio, ESAS, PPS, care plan)
  → PatientVisit completed
  → Schedule Slot (completed, visit_id = new_visit.id)
```

**Key Implementation Detail**:
When a team member marks a slot as "completed" and opens assessment forms:
1. Create a new `PatientVisit` with:
   - `patient_id` from the slot
   - `visit_type` = 'follow_up' (or 'initial' for first visit)
   - `visit_date` = today
   - `visit_location` = 'home'
   - `team_members` = JSON array from the day's team assignments
   - `vehicle_id` = from the weekly schedule's vehicle
   - `status` = 'in_progress'
   - `created_by` = current user
2. Link `schedule_slot.visit_id = new_visit.id`
3. Redirect to the existing assessment flow (`/saranam/patients/:patientId/visits/:visitId`)
4. When assessments are completed and visit is marked complete, the slot status auto-updates

### Updating Scheduling Meta After Visit
When a `PatientVisit` is created/completed:
1. Update `patient_scheduling_meta.last_visit_date`
2. Recalculate `days_since_last_visit`
3. Recalculate `priority_score`

This can be done via:
- **Option A**: SQLAlchemy event listener on PatientVisit insert/update
- **Option B**: Post-save hook in the visit service
- **Recommended**: Option B for clarity

```python
# In visit_service.py - after creating/completing a visit
def _update_scheduling_meta(patient_id: str):
    meta = PatientSchedulingMeta.query.filter_by(patient_id=patient_id).first()
    if meta:
        latest_visit = PatientVisit.query.filter_by(
            patient_id=patient_id, status='completed'
        ).order_by(PatientVisit.visit_date.desc()).first()

        if latest_visit:
            meta.last_visit_date = latest_visit.visit_date
            meta.days_since_last_visit = (date.today() - latest_visit.visit_date).days

        config = ScheduleConfig.query.first()
        meta.priority_score = calculate_priority_score(meta, config)
        db.session.commit()
```

---

## 2. Patient Module Integration

### Patient Registration Hook
When a new patient is created in the system:
1. Auto-create `patient_scheduling_meta` with defaults
2. Auto-assign cluster based on PIN code
3. Set `scheduling_active = True`

```python
# In patient creation flow
def _create_scheduling_meta(patient_id: str, pin_code: str = None):
    cluster_id = auto_assign_cluster(pin_code) if pin_code else None
    meta = PatientSchedulingMeta(
        patient_id=patient_id,
        cluster_id=cluster_id,
        complexity='medium',
        recommended_frequency_days=7,
        scheduling_active=True
    )
    db.session.add(meta)
    db.session.commit()
```

### Patient Status Changes
- **Patient marked inactive/deceased/transferred**: Set `scheduling_active = False`
- **Patient BSC status changes**: Update `care_status` in scheduling_meta, recalculate priority

---

## 3. Inventory Module Integration (Kit Readiness)

### Kit Preparation Flow

1. **When a day's schedule is finalized** (APPROVED state):
   - System generates a **kit preparation list** per visit day
   - Based on scheduled patients' known needs:
     - Wound dressing supplies (if patient has `wound_present = True` in latest nursing assessment)
     - Catheter equipment (if patient has `device_urinary_catheter` in latest nursing assessment)
     - Specific medicines from current prescriptions (from `plans_of_care.medications`)

2. **Kit Checklist Screen (S9)**:
   ```
   Kit for Monday, Mar 30

   Based on 4 scheduled patients:

   ✅ Wound dressing kit (x2) — Patient A, Patient C
      Stock: 5 available ✓

   ⬜ Catheter set (x1) — Patient A
      Stock: 2 available ✓

   ⬜ Paracetamol 500mg (x20) — Patient B, Patient C, Patient D
      Stock: 50 available ✓

   ⬜ Morphine 10mg (x10) — Patient A
      Stock: 3 available ⚠ (LOW)
      → [View in Inventory]

   [Mark Kit Ready]
   ```

3. **Integration Points with Inventory Module**:
   - Read `inventory_stock` for item availability
   - Read `medicine_master` for medicine details
   - Link to inventory module for reorder/requisition
   - `stock_alerts` for low-stock items

4. **Kit Ready Deadline Alert**:
   - If kit not marked ready by 6 PM the previous day → alert PO-SW and Lead
   - Uses existing `reminders` module infrastructure (APScheduler)

### Implementation Notes
- Kit items are **derived**, not manually entered
- Algorithm checks latest nursing assessment + care plan for each scheduled patient
- Items can be manually added/removed from the checklist by PO-SW

---

## 4. Notification System

### Notification Channels

| Channel | Implementation | When |
|---------|---------------|------|
| **In-App** | `schedule_notifications` table + frontend polling/websocket | Always |
| **WhatsApp** | External API (if configured) | On schedule approval, ad-hoc changes |
| **SMS** | Existing reminders module | Fallback if WhatsApp unavailable |

### In-App Notification Flow

```python
def send_schedule_notification(schedule_id, user_id, notification_type, content):
    notification = ScheduleNotification(
        weekly_schedule_id=schedule_id,
        user_id=user_id,
        notification_type=notification_type,
        channel='in_app',
        content=content,
        sent_at=datetime.utcnow()
    )
    db.session.add(notification)
    db.session.commit()
```

### Frontend Notification Display
- Add a notification bell icon in the DashboardLayout header
- Badge count for unread scheduling notifications
- Click to see notification list
- Notification types:
  - "Weekly schedule approved" → link to My Visits
  - "Schedule sent back" → link to Planning Board
  - "Ad-hoc visit added" → link to Daily View
  - "Kit not ready" → link to Kit Checklist

---

## 5. Proactive Call System

### Auto-Generated Call List
After weekly schedule is approved:

```python
def generate_proactive_call_list(week_start_date):
    """Find patients not scheduled who need attention."""
    config = ScheduleConfig.query.first()

    # All active patients with scheduling meta
    all_patients = PatientSchedulingMeta.query.filter_by(scheduling_active=True).all()

    # Patients scheduled this week
    scheduled_ids = db.session.query(ScheduleSlot.patient_id).join(
        ScheduleDay
    ).join(WeeklySchedule).filter(
        WeeklySchedule.week_start_date == week_start_date
    ).all()
    scheduled_set = {p[0] for p in scheduled_ids}

    # Unscheduled patients exceeding gap threshold
    call_list = []
    for meta in all_patients:
        if meta.patient_id not in scheduled_set:
            if meta.days_since_last_visit and \
               meta.days_since_last_visit > config.visit_gap_alert_threshold_days:
                call_list.append(meta)

    # Sort by days_since_last_visit descending
    call_list.sort(key=lambda m: m.days_since_last_visit or 0, reverse=True)
    return call_list
```

### Feedback Loop
- If a proactive call reveals urgent need → caller creates an **ad-hoc visit request**
- This appears in Lead's queue
- Lead can insert it into the active schedule (IN_PROGRESS → MODIFIED → IN_PROGRESS)

---

## 6. Homecare GPS Integration

The existing homecare module has GPS check-in functionality. Integration:

1. **Navigate button**: On Daily Visit View (S6), the "Navigate" button opens the patient's location in Google Maps (using existing Leaflet/React-Leaflet integration)
2. **GPS check-in**: When team starts a visit, GPS coordinates can be captured (existing homecare flow)
3. **Location verification**: Optional feature to verify team is at patient location

---

## 7. Analytics Integration

### Dashboard Metrics
Add scheduling metrics to the existing analytics dashboard:
- Weekly visit completion trends
- BSC coverage trends over time
- Cluster efficiency trends
- Average turnaround time (DRAFT → APPROVED)
- Team utilization rates

### Data Source
All metrics come from `weekly_schedules.review_metrics` (JSONB column populated when schedule enters REVIEW_READY state).

---

## 8. Background Jobs (APScheduler)

### New Scheduled Jobs

| Job | Frequency | Logic |
|-----|-----------|-------|
| Auto-create weekly schedule | Weekly (planning day) | Create DRAFT schedule for next week |
| Recalculate priority scores | Daily (midnight) | Update all patient_scheduling_meta.priority_score |
| Update days_since_last_visit | Daily (midnight) | Recompute for all active patients |
| Kit readiness alert | Daily (6 PM) | Check if tomorrow's kit is marked ready |
| Acknowledgment reminder | Hourly (after approval) | Check for unacknowledged team members |
| Auto-activate schedule | Daily (first visit day morning) | COMMUNICATED → IN_PROGRESS |
| Auto-review-ready | Daily (after last visit day) | IN_PROGRESS → REVIEW_READY |
| Generate proactive call list | Per config (default: Wed, Sat) | Create call list from unscheduled patients |

### APScheduler Configuration

```python
# In app/__init__.py or scheduler config
scheduler.add_job(
    'auto_create_schedule',
    func=schedule_service.auto_create_weekly_schedule,
    trigger='cron',
    day_of_week='fri',  # Read from config
    hour=8, minute=0
)

scheduler.add_job(
    'recalculate_priorities',
    func=patient_pool_service.recalculate_all_priorities,
    trigger='cron',
    hour=0, minute=30  # 12:30 AM daily
)

scheduler.add_job(
    'kit_readiness_alert',
    func=notification_service.check_kit_readiness,
    trigger='cron',
    hour=18, minute=0  # 6 PM daily
)
```
