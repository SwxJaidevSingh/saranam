# 02 - Database Models

All models follow the existing codebase pattern: SQLAlchemy ORM, UUID primary keys, `BaseModel` inheritance (provides id, created_at, updated_at), soft deletes via `is_active`.

---

## Table Relationship Diagram

```
schedule_config (singleton)
geographic_clusters ◄───────── patient_scheduling_meta
                                       │
                                       │ patient_id
                                       ▼
vehicles ◄────── weekly_schedules ──► patients (existing)
                       │
                       │ 1:N
                       ▼
                 schedule_days
                    │       │
              1:N   │       │  1:N
                    ▼       ▼
            schedule_slots  schedule_team_assignments
                 │                    │
                 │ visit_id           │ user_id
                 ▼                    ▼
           patient_visits        users (existing)
             (existing)

schedule_audit_log ──► weekly_schedules
on_call_roster ──► users (existing)
schedule_notifications ──► users (existing)
```

---

## 1. `schedule_config` - Global Configuration

Single-row table. All scheduling logic reads from this config.

```python
class ScheduleConfig(BaseModel):
    __tablename__ = 'schedule_config'

    # Visit day configuration
    visit_days = Column(JSONB, nullable=False, default=["monday", "tuesday", "thursday", "friday"])
    # e.g., ["monday", "tuesday", "thursday", "friday"]

    non_visit_day_labels = Column(JSONB, default={})
    # e.g., {"wednesday": "Case Review", "saturday": "Capacity Building"}

    # Planning configuration
    planning_day = Column(String(20), nullable=False, default="friday")
    planning_deadline_time = Column(Time, nullable=False)  # e.g., 18:00
    approval_deadline_day = Column(String(20), nullable=False, default="saturday")
    approval_deadline_time = Column(Time, nullable=False)  # e.g., 20:00

    # Capacity
    max_patients_per_vehicle_per_day = Column(Integer, nullable=False, default=4)
    recommended_patients_per_day = Column(Integer, nullable=False, default=3)
    active_vehicles = Column(Integer, nullable=False, default=1)

    # Clustering
    cluster_efficiency_target = Column(Numeric(5, 2), nullable=False, default=50.0)  # percentage

    # Alerts
    visit_gap_alert_threshold_days = Column(Integer, nullable=False, default=7)

    # Notifications
    notification_methods = Column(JSONB, default=["in_app"])
    # e.g., ["in_app", "whatsapp"]

    # Proactive calls
    proactive_call_days = Column(JSONB, default=["wednesday", "saturday"])
    proactive_call_window_start = Column(Time)
    proactive_call_window_end = Column(Time)

    # Auto-schedule creation
    auto_create_schedule = Column(Boolean, default=True)

    # Updated by
    updated_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))
```

**Notes**:
- Only ONE row should exist. Enforce via application logic or unique constraint on a sentinel column.
- All scheduling code reads from this table, never from hardcoded values.
- Admin/Lead can update via Settings UI.

---

## 2. `geographic_clusters` - Cluster Definitions

```python
class GeographicCluster(BaseModel):
    __tablename__ = 'geographic_clusters'

    name = Column(String(100), nullable=False, unique=True)
    color_hex = Column(String(7), nullable=False)  # e.g., "#3B82F6"
    pin_codes = Column(JSONB, default=[])  # e.g., ["560001", "560002"]
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
```

**Default Clusters**:
| Name | Color | Purpose |
|------|-------|---------|
| North | #3B82F6 (blue) | Northern service area |
| South | #22C55E (green) | Southern service area |
| East | #F97316 (orange) | Eastern service area |
| West | #A855F7 (purple) | Western service area |
| Central | #14B8A6 (teal) | Central service area |

---

## 3. `vehicles` - Ambulance / Vehicle Registry

```python
class Vehicle(BaseModel):
    __tablename__ = 'vehicles'

    name = Column(String(100), nullable=False)  # e.g., "Ambulance 1"
    registration_number = Column(String(50))
    vehicle_type = Column(String(50), default="ambulance")
    capacity = Column(Integer, default=6)  # max team members
    is_active = Column(Boolean, default=True)
    notes = Column(Text)

    # Relationships
    weekly_schedules = relationship('WeeklySchedule', backref='vehicle', lazy='dynamic')
```

---

## 4. `weekly_schedules` - The Core Schedule Entity

One per week per vehicle. This is the state machine entity.

```python
class WeeklySchedule(BaseModel):
    __tablename__ = 'weekly_schedules'

    # Time range
    week_start_date = Column(Date, nullable=False)  # Monday of the week
    week_end_date = Column(Date, nullable=False)    # Sunday of the week

    # Vehicle assignment
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey('vehicles.id'), nullable=False)

    # State machine
    status = Column(
        String(20),
        nullable=False,
        default='draft',
        # Valid: draft, submitted, approved, communicated, in_progress, modified, review_ready, archived
    )

    # Draft phase
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)

    # Submission phase
    submitted_at = Column(DateTime)
    submitted_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    submitted_note = Column(Text)  # PO-SW's note to Lead

    # Approval phase
    approved_at = Column(DateTime)
    approved_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    approval_note = Column(Text)  # Lead's approval note
    sent_back_reason = Column(Text)  # If Lead sends back to DRAFT

    # Communication phase
    communicated_at = Column(DateTime)

    # Review phase
    review_started_at = Column(DateTime)
    review_completed_at = Column(DateTime)
    review_completed_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    review_notes = Column(Text)

    # Computed metrics (populated when entering REVIEW_READY)
    review_metrics = Column(JSONB)
    # {
    #   "visit_completion_rate": 92.5,
    #   "bsc_coverage": 100,
    #   "cluster_efficiency": 68.3,
    #   "missed_visits": 2,
    #   "adhoc_visits": 1,
    #   "team_acknowledgment_rate": 100,
    #   "patients_not_visited": 3,
    #   "avg_patients_per_day": 3.5,
    #   "turnaround_hours": 18.5
    # }

    # Relationships
    schedule_days = relationship('ScheduleDay', backref='weekly_schedule',
                                  cascade='all, delete-orphan', order_by='ScheduleDay.date')
    audit_logs = relationship('ScheduleAuditLog', backref='weekly_schedule',
                               cascade='all, delete-orphan', order_by='ScheduleAuditLog.created_at')

    # Constraints
    __table_args__ = (
        UniqueConstraint('week_start_date', 'vehicle_id', name='uq_weekly_schedule_vehicle_week'),
    )
```

**Key Rules**:
- One schedule per vehicle per week (enforced by unique constraint)
- Only one can be in DRAFT/SUBMITTED per vehicle at a time (enforced by application logic)
- Only one can be in COMMUNICATED/IN_PROGRESS per vehicle at a time

---

## 5. `schedule_days` - Individual Day Slots

One row per visit day within a weekly schedule.

```python
class ScheduleDay(BaseModel):
    __tablename__ = 'schedule_days'

    weekly_schedule_id = Column(UUID(as_uuid=True), ForeignKey('weekly_schedules.id'), nullable=False)
    date = Column(Date, nullable=False)
    day_of_week = Column(String(20), nullable=False)  # "monday", "tuesday", etc.

    # Day-level notes
    day_note = Column(Text)  # e.g., "Traffic expected on Ring Road, start early"

    # Kit readiness tracking
    kit_ready = Column(Boolean, default=False)
    kit_ready_at = Column(DateTime)
    kit_ready_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))

    # Cluster efficiency for this day (computed)
    cluster_efficiency = Column(Numeric(5, 2))

    # Relationships
    schedule_slots = relationship('ScheduleSlot', backref='schedule_day',
                                   cascade='all, delete-orphan', order_by='ScheduleSlot.slot_order')
    team_assignments = relationship('ScheduleTeamAssignment', backref='schedule_day',
                                     cascade='all, delete-orphan')

    __table_args__ = (
        UniqueConstraint('weekly_schedule_id', 'date', name='uq_schedule_day_date'),
    )
```

---

## 6. `schedule_slots` - Patient-Day Assignments

Each slot = one patient scheduled for one day. This is the core scheduling unit.

```python
class ScheduleSlot(BaseModel):
    __tablename__ = 'schedule_slots'

    schedule_day_id = Column(UUID(as_uuid=True), ForeignKey('schedule_days.id'), nullable=False)
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id'), nullable=False)

    # Ordering (determines visit sequence for the day)
    slot_order = Column(Integer, nullable=False, default=0)

    # Execution status
    status = Column(String(20), nullable=False, default='scheduled')
    # Valid: scheduled, in_progress, completed, missed, cancelled

    # Reasons for missed/cancelled
    missed_reason = Column(Text)
    cancelled_reason = Column(Text)

    # Ad-hoc tracking
    is_adhoc = Column(Boolean, default=False)
    adhoc_reason = Column(Text)
    adhoc_added_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))

    # Link to actual visit record (set when visit is recorded in Saranam module)
    visit_id = Column(UUID(as_uuid=True), ForeignKey('patient_visits.id'))

    # Patient-specific notes for this visit
    exception_note = Column(Text)  # e.g., "Patient requested afternoon visit only"

    # Time tracking
    started_at = Column(DateTime)
    completed_at = Column(DateTime)

    # Relationships
    patient = relationship('Patient')
    visit = relationship('PatientVisit')

    __table_args__ = (
        UniqueConstraint('schedule_day_id', 'patient_id', name='uq_schedule_slot_patient_day'),
    )
```

---

## 7. `schedule_team_assignments` - Team Per Day

Which team members are assigned to which day.

```python
class ScheduleTeamAssignment(BaseModel):
    __tablename__ = 'schedule_team_assignments'

    schedule_day_id = Column(UUID(as_uuid=True), ForeignKey('schedule_days.id'), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    role = Column(String(50), nullable=False)
    # Valid roles: physician, nurse, counselor, physio, social_worker, driver, po_sw

    # Relationships
    user = relationship('User')

    __table_args__ = (
        UniqueConstraint('schedule_day_id', 'user_id', name='uq_team_assignment_day_user'),
    )
```

---

## 8. `patient_scheduling_meta` - Scheduling-Specific Patient Data

Separate from clinical patient record. Contains scheduling-specific metadata.

```python
class PatientSchedulingMeta(BaseModel):
    __tablename__ = 'patient_scheduling_meta'

    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id'), nullable=False, unique=True)

    # Geographic
    cluster_id = Column(UUID(as_uuid=True), ForeignKey('geographic_clusters.id'))

    # Clinical priority inputs
    complexity = Column(String(20), default='medium')  # high, medium, low
    care_status = Column(String(10))  # bsc, n_bsc (also exists on patient but duplicated for scheduling perf)

    # Visit frequency
    recommended_frequency_days = Column(Integer, default=7)  # days between visits

    # Special instructions
    special_notes = Column(Text)  # e.g., "only morning visits", "call before visiting"

    # Lead flags
    lead_flagged = Column(Boolean, default=False)
    lead_flag_reason = Column(Text)
    lead_flagged_at = Column(DateTime)
    lead_flagged_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))

    # Status
    scheduling_active = Column(Boolean, default=True)  # Whether patient appears in scheduling pool

    # Recently hospitalized
    recently_hospitalized = Column(Boolean, default=False)
    hospital_discharge_date = Column(Date)

    # Computed (updated by background job or on access)
    last_visit_date = Column(Date)  # Cached from patient_visits
    days_since_last_visit = Column(Integer)  # Cached, computed daily
    priority_score = Column(Integer, default=0)  # Cached priority score

    # Relationships
    patient = relationship('Patient', backref=backref('scheduling_meta', uselist=False))
    cluster = relationship('GeographicCluster')
```

**Priority Score Calculation** (computed field, recalculated daily or on demand):

| Factor | Score | Logic |
|--------|-------|-------|
| BSC Status | +50 | care_status == 'bsc' |
| Complexity: High | +30 | complexity == 'high' |
| Complexity: Medium | +20 | complexity == 'medium' |
| Complexity: Low | +10 | complexity == 'low' |
| Days overdue | +5/day | days_since_last_visit > recommended_frequency_days |
| Visit gap alert | +20 | days_since_last_visit > config.visit_gap_alert_threshold_days |
| New patient (never visited) | +25 | last_visit_date is NULL |
| Lead flag | +40 | lead_flagged == True |
| Recently hospitalized | +15 | recently_hospitalized == True |

---

## 9. `schedule_audit_log` - Change Tracking

```python
class ScheduleAuditLog(BaseModel):
    __tablename__ = 'schedule_audit_log'

    weekly_schedule_id = Column(UUID(as_uuid=True), ForeignKey('weekly_schedules.id'), nullable=False)

    action = Column(String(50), nullable=False)
    # Valid actions:
    # schedule_created, schedule_submitted, schedule_approved, schedule_sent_back,
    # schedule_communicated, schedule_activated, schedule_review_ready, schedule_archived,
    # patient_added, patient_removed, patient_moved, patient_reordered,
    # team_changed, adhoc_visit_added, visit_cancelled,
    # day_note_updated, exception_note_updated, kit_marked_ready

    actor_user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)

    details = Column(JSONB)
    # Examples:
    # patient_added: {"patient_id": "...", "patient_name": "...", "day": "monday", "slot_order": 2}
    # patient_moved: {"patient_id": "...", "from_day": "monday", "to_day": "tuesday"}
    # schedule_sent_back: {"reason": "Need to add BSC patient Manjulamma"}
    # team_changed: {"day": "monday", "added": [{"user_id": "...", "role": "nurse"}], "removed": [...]}

    # Relationships
    actor = relationship('User')
```

---

## 10. `on_call_roster` - Weekly On-Call Assignment

```python
class OnCallRoster(BaseModel):
    __tablename__ = 'on_call_roster'

    week_start_date = Column(Date, nullable=False)
    week_end_date = Column(Date, nullable=False)

    clinician_user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    phone_numbers = Column(JSONB, default=[])  # e.g., ["+91XXXXXXXXXX"]

    notes = Column(Text)
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)

    # Relationships
    clinician = relationship('User', foreign_keys=[clinician_user_id])

    __table_args__ = (
        UniqueConstraint('week_start_date', 'clinician_user_id', name='uq_on_call_week_clinician'),
    )
```

---

## 11. `schedule_notifications` - Notification Tracking

```python
class ScheduleNotification(BaseModel):
    __tablename__ = 'schedule_notifications'

    weekly_schedule_id = Column(UUID(as_uuid=True), ForeignKey('weekly_schedules.id'), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)

    notification_type = Column(String(50), nullable=False)
    # Valid: schedule_approved, adhoc_change, visit_reminder, kit_alert,
    #        acknowledgment_reminder, sent_back, review_ready

    channel = Column(String(20), nullable=False)  # in_app, whatsapp, sms, email

    sent_at = Column(DateTime)
    delivered_at = Column(DateTime)
    read_at = Column(DateTime)

    # Acknowledgment
    acknowledged = Column(Boolean, default=False)
    acknowledged_at = Column(DateTime)

    content = Column(Text)  # Notification message text

    # Relationships
    user = relationship('User')
    weekly_schedule = relationship('WeeklySchedule')
```

---

## Migration Strategy

All new tables should be created via Alembic migration. Suggested migration order:

1. `geographic_clusters` (no dependencies)
2. `vehicles` (no dependencies)
3. `schedule_config` (depends on users)
4. `patient_scheduling_meta` (depends on patients, geographic_clusters, users)
5. `weekly_schedules` (depends on vehicles, users)
6. `schedule_days` (depends on weekly_schedules, users)
7. `schedule_slots` (depends on schedule_days, patients, patient_visits, users)
8. `schedule_team_assignments` (depends on schedule_days, users)
9. `schedule_audit_log` (depends on weekly_schedules, users)
10. `on_call_roster` (depends on users)
11. `schedule_notifications` (depends on weekly_schedules, users)

All in a single migration file is acceptable since they are all new tables.
