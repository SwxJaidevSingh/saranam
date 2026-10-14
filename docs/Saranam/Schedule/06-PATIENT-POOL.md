# 06 - Patient Pool & Priority Scoring

---

## Overview

The **Patient Pool** is the master list of all patients eligible for weekly scheduling. It serves as the "source" from which PO-SW picks patients each week on the Planning Board sidebar.

---

## Patient Pool Data Model

Each patient in the pool has this data (stored in `patient_scheduling_meta` table, linked to the `patients` table):

| Field | Source | Description |
|-------|--------|-------------|
| patient_id | patients table | Patient UUID |
| name, age, gender | patients table | Demographics |
| care_status | patient/scheduling_meta | BSC or N-BSC |
| complexity | scheduling_meta | High / Medium / Low (set by Lead) |
| cluster | scheduling_meta → geographic_clusters | Auto-assigned from PIN or manually set |
| address, phone | patients table (decrypted) | For navigation and contact |
| last_visit_date | Computed from patient_visits | Date of most recent completed visit |
| days_since_last_visit | Computed | Today - last_visit_date |
| recommended_frequency_days | scheduling_meta | Set by Lead (default: 7) |
| next_recommended_visit | Computed | last_visit_date + recommended_frequency_days |
| scheduling_active | scheduling_meta | Whether patient appears in pool |
| special_notes | scheduling_meta | e.g., "only morning visits" |
| lead_flagged | scheduling_meta | Whether Lead has flagged as urgent |
| lead_flag_reason | scheduling_meta | Why the flag |
| recently_hospitalized | scheduling_meta | Discharge follow-up needed |
| priority_score | Computed | Auto-calculated score for sidebar sorting |

---

## Priority Scoring Algorithm

The priority score determines the default sort order of patients in the Planning Board sidebar. It's transparent so PO-SW understands why patients are ranked.

### Scoring Table

| Factor | Points | Logic |
|--------|--------|-------|
| **BSC Status** | +50 | `care_status == 'bsc'` |
| **Complexity: High** | +30 | `complexity == 'high'` |
| **Complexity: Medium** | +20 | `complexity == 'medium'` |
| **Complexity: Low** | +10 | `complexity == 'low'` |
| **Days overdue** | +5 per day | If `days_since_last_visit > recommended_frequency_days`, add 5 points per overdue day |
| **Visit gap alert** | +20 | If `days_since_last_visit > config.visit_gap_alert_threshold_days` |
| **New patient** (never visited) | +25 | If `last_visit_date IS NULL` |
| **Lead flag** | +40 | If `lead_flagged == True` |
| **Recently hospitalized** | +15 | If `recently_hospitalized == True` |

### Scoring Examples

**BSC patient, high complexity, 3 days overdue, Lead-flagged:**
```
50 (BSC) + 30 (high) + 15 (3 days × 5) + 20 (gap alert) + 40 (flag) = 155
```

**N-BSC patient, medium complexity, on schedule:**
```
0 (N-BSC) + 20 (medium) + 0 (not overdue) = 20
```

**New BSC patient, never visited:**
```
50 (BSC) + 20 (medium, default) + 25 (new patient) = 95
```

### Implementation

```python
def calculate_priority_score(meta: PatientSchedulingMeta, config: ScheduleConfig) -> int:
    score = 0

    # BSC Status
    if meta.care_status == 'bsc':
        score += 50

    # Complexity
    complexity_scores = {'high': 30, 'medium': 20, 'low': 10}
    score += complexity_scores.get(meta.complexity, 20)

    # Days overdue
    if meta.last_visit_date and meta.recommended_frequency_days:
        days_since = (date.today() - meta.last_visit_date).days
        overdue_days = days_since - meta.recommended_frequency_days
        if overdue_days > 0:
            score += overdue_days * 5

        # Visit gap alert
        if days_since > config.visit_gap_alert_threshold_days:
            score += 20

    # New patient
    if meta.last_visit_date is None:
        score += 25

    # Lead flag
    if meta.lead_flagged:
        score += 40

    # Recently hospitalized
    if meta.recently_hospitalized:
        score += 15

    return score
```

### Recalculation

- **Daily**: Background job recalculates all scores (APScheduler)
- **On demand**: Admin/Lead can trigger via "Recalculate" button on Patient Pool (S7)
- **On change**: When scheduling_meta is updated, recalculate that patient's score

---

## Geographic Clustering

### Purpose
Minimize travel time by grouping patients from the same area on the same day.

### Cluster Assignment Flow

1. **Auto-assignment**: When a patient is registered, system checks their PIN code against the `geographic_clusters.pin_codes` JSONB array
2. **Manual override**: PO-SW or Lead can manually assign/change a patient's cluster
3. **Clusters are configurable**: Admin can add/remove/rename clusters and their PIN mappings

### Cluster Auto-Assignment Logic

```python
def auto_assign_cluster(patient_pin_code: str) -> Optional[UUID]:
    """Find matching cluster for a PIN code."""
    clusters = GeographicCluster.query.filter_by(is_active=True).all()
    for cluster in clusters:
        if patient_pin_code in (cluster.pin_codes or []):
            return cluster.id
    return None  # No match - must be assigned manually
```

### Cluster Efficiency Calculation

**Per Day**:
```
Cluster Efficiency = (Patients from the most common cluster on that day) / (Total patients that day) × 100
```

**Example**:
- Monday: 4 patients — 3 from North, 1 from Central
- Efficiency = 3/4 = 75%

**Per Week**:
```
Weekly Cluster Efficiency = Average of all day efficiencies
```

**Target**: ≥50% (configurable in `schedule_config.cluster_efficiency_target`)

### Cluster Visualization on Planning Board

1. **Patient card badges**: Each patient card shows a colored cluster badge
   - North = Blue (#3B82F6)
   - South = Green (#22C55E)
   - East = Orange (#F97316)
   - West = Purple (#A855F7)
   - Central = Teal (#14B8A6)

2. **Day header cluster bar**: Each day column header shows a mini stacked bar chart of cluster distribution

3. **Real-time updates**: When PO-SW drags a patient into a day, the cluster bar updates immediately

4. **Cluster highlighting**: When dragging a patient from North cluster into Monday, all other North cluster patients in the sidebar get a subtle highlight ("you might want to group these together")

5. **Low efficiency warning**: If cluster efficiency drops below target for a day, a yellow warning appears in the Warnings Banner

---

## Patient Pool Sidebar Behavior (Planning Board)

### Default View
- All active patients not yet scheduled for the current week
- Sorted by priority_score descending (highest priority at top)
- BSC patients visually distinct (red border or badge)

### Badges on Patient Cards

| Badge | Condition | Visual |
|-------|-----------|--------|
| BSC | care_status == 'bsc' | Red "BSC" badge |
| OVERDUE | days_since_last_visit > recommended_frequency_days | Red "OVERDUE" text |
| Flagged | lead_flagged == True | Flag icon with tooltip |
| New | last_visit_date is NULL | Blue "NEW" badge |
| Hospitalized | recently_hospitalized == True | Hospital icon |
| Cluster | Always | Colored dot with cluster name |

### Filters Available
- **Care Status**: All / BSC / N-BSC
- **Cluster**: All / specific cluster
- **Complexity**: All / High / Medium / Low
- **Status**: All / Overdue only / Flagged only / New only
- **Search**: Free-text search by patient name

### Smart Assists
- When a patient is dragged, same-cluster patients get a subtle glow
- Already-scheduled patients are hidden from sidebar (or shown grayed out)
- Patients with teleconsult on a specific day show conflict warning when dragged to that day

---

## Populating patient_scheduling_meta

### Initial Population
When the scheduling module is first deployed, run a one-time script to:
1. Create `patient_scheduling_meta` for every active patient
2. Auto-assign clusters based on PIN codes
3. Set default complexity to 'medium'
4. Set default recommended_frequency_days to 7
5. Compute last_visit_date from existing patient_visits
6. Calculate initial priority scores

### Ongoing Maintenance
- **New patient registered**: Auto-create scheduling_meta with defaults + auto-cluster
- **Visit completed**: Update last_visit_date, recalculate days_since_last_visit and priority_score
- **Patient transferred/deceased**: Set scheduling_active = false
- **Lead flags patient**: Update lead_flagged, lead_flag_reason, recalculate score
- **Patient hospitalized/discharged**: Update recently_hospitalized, hospital_discharge_date
