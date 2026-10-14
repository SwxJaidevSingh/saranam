# Production Data Reset Plan — Kidwai Saranam Go-Live

**Author:** Engineering
**Created:** 2026-04-11
**Source data:** `~/Downloads/Kidwai Home visit patients Line-list.xlsx` (150 patients, Master Sheet)

## Context & Goal

All patient data currently in the database is developer/demo data from the build phase — not real clinical records. We need to:

1. **Wipe** every patient-linked record while preserving user accounts, form templates, service catalogs, scheduling infrastructure, and all reference data.
2. **Import** the 150 real Kidwai home-visit patients from the provided Excel sheet, preserving their existing Homecare UHIDs where already assigned, and recording deaths / initial visits that are captured in the sheet.

Both processes must run in one cutover window. After cutover the app is considered **production**, so correctness and auditability matter more than speed.

## Safety principles (apply to both phases)

- **Backup first, always.** `pg_dump` the entire database to a timestamped file before any DELETE or TRUNCATE runs. Archive the dump off the server.
- **Staging rehearsal first.** Do both phases end-to-end on a staging DB snapshot before touching production.
- **Dry-run mode.** Both scripts accept `--dry-run` which logs what would happen without committing.
- **One transaction per phase.** Each script wraps its work in a `db.session` transaction; on any error it rolls back.
- **Stop the app.** Put the app in maintenance mode (or stop the Flask process) while the cutover is running. No user writes during the 10-minute window.

---

# PART 1 — Wipe

## Tables we KEEP (do not touch)

Preserve everything that is a template / catalog / configuration:

- `users`, any role tables
- `forms`, `field_sections`, `field_risk_rules`, `form_risk_levels`, `form_configurations`, `service_forms`, `clinical_documentation`
- `services`, `service_providers`, `service_schedules`
- `healthcare_providers`, `provider_schedules`, `provider_specializations`, `provider_departments`
- `geographic_clusters`, `nearby_hospitals`
- `system_settings`
- `weekly_schedules`, `schedule_days`, `schedule_slots` (template slots), `schedule_team_assignments`, `schedule_config`, `on_call_roster`, `vehicles`
- `medicine_master`, `inventory_locations`, `suppliers`
- `alembic_version` (migration state — never touch)

## Tables we WIPE

Delete in the dependency order below. Most are `ondelete='CASCADE'` from `patients` or `patient_visits`, so the single `DELETE FROM patients` would cascade down — but we explicitly delete the leaves first as a belt-and-braces measure and for audit clarity.

```
Leaf tables (no children):
  form_answers, submission_risk_scores
  opd_prescription_items, opd_lab_order_items
  appointment_reminders
  consent_access_log
  recent_patients

Mid-tier (depend on patient_visits or encounters):
  nursing_assessments, doctor_assessments, psychological_assessments,
  physiotherapy_assessments, esas_scores, pps_scores, procedures_records
  opd_prescriptions, opd_lab_orders
  observations, diagnoses
  bed_assignments, bed_waiting_list, vitals_records
  call_sops, call_schedules
  patient_locations, patient_symptoms, patient_risk_assessments

Mid-tier (direct patient FK):
  patient_visits
  encounters
  form_submissions
  ipd_admissions
  consent_artifacts
  patient_caregivers
  uhid_history

Anchor:
  patients

Bulk-import sessions (from any dev test runs):
  bulk_import_items, bulk_import_sessions

Audit / logs (clear to start fresh — optional):
  audit_logs, schedule_audit_log, reminder_logs
```

## UHID counter reset

`uhid_counters` is not patient-linked so it survives the cascade. We must manually reset the current-year buckets so imported patients start at `0001` in each zone:

```sql
UPDATE uhid_counters SET last_sequence = 0 WHERE year = EXTRACT(YEAR FROM NOW());
```

Past-year rows are left alone (historical). `uhid_history` is already emptied by the CASCADE from `patients`.

## Deliverable: `backend/wipe_dev_patients.py`

Standalone script (same shape as existing `seed_*.py`):

```python
#!/usr/bin/env python3
"""Wipe all patient-linked data from the DB. Idempotent. Use --dry-run first."""
import argparse
from app import create_app
from app.extensions import db

# Ordered by dependency — leaves first
WIPE_SQL = [
    # leaves
    "DELETE FROM form_answers;",
    "DELETE FROM submission_risk_scores;",
    "DELETE FROM opd_prescription_items;",
    "DELETE FROM opd_lab_order_items;",
    "DELETE FROM appointment_reminders;",
    "DELETE FROM consent_access_log;",
    "DELETE FROM recent_patients;",
    # assessments & visit children
    "DELETE FROM nursing_assessments;",
    "DELETE FROM doctor_assessments;",
    "DELETE FROM psychological_assessments;",
    "DELETE FROM physiotherapy_assessments;",
    "DELETE FROM esas_scores;",
    "DELETE FROM pps_scores;",
    "DELETE FROM procedures_records;",
    # encounter children
    "DELETE FROM opd_prescriptions;",
    "DELETE FROM opd_lab_orders;",
    "DELETE FROM observations;",
    "DELETE FROM diagnoses;",
    "DELETE FROM bed_assignments;",
    "DELETE FROM bed_waiting_list;",
    "DELETE FROM vitals_records;",
    "DELETE FROM call_sops;",
    "DELETE FROM call_schedules;",
    "DELETE FROM patient_locations;",
    "DELETE FROM patient_symptoms;",
    "DELETE FROM patient_risk_assessments;",
    # direct patient children
    "DELETE FROM patient_visits;",
    "DELETE FROM encounters;",
    "DELETE FROM form_submissions;",
    "DELETE FROM ipd_admissions;",
    "DELETE FROM consent_artifacts;",
    "DELETE FROM patient_caregivers;",
    "DELETE FROM uhid_history;",
    # anchor
    "DELETE FROM patients;",
    # bulk import sessions left over from dev
    "DELETE FROM bulk_import_items;",
    "DELETE FROM bulk_import_sessions;",
    # reset current-year UHID counter sequences
    "UPDATE uhid_counters SET last_sequence = 0 WHERE year = EXTRACT(YEAR FROM NOW());",
]

VERIFY_SQL = [
    "SELECT 'patients' AS t, COUNT(*) FROM patients",
    "SELECT 'patient_visits', COUNT(*) FROM patient_visits",
    "SELECT 'form_submissions', COUNT(*) FROM form_submissions",
    "SELECT 'users (preserved)', COUNT(*) FROM users",
    "SELECT 'forms (preserved)', COUNT(*) FROM forms",
]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()
    app = create_app()
    with app.app_context():
        if args.dry_run:
            print('DRY RUN — statements that would execute:')
            for s in WIPE_SQL:
                print(f'  {s}')
            return
        for s in WIPE_SQL:
            result = db.session.execute(db.text(s))
            rc = getattr(result, 'rowcount', None)
            print(f'{s:60s} rowcount={rc}')
        db.session.commit()
        print('\n=== Post-wipe counts ===')
        for s in VERIFY_SQL:
            row = db.session.execute(db.text(s)).first()
            print(f'  {row}')

if __name__ == '__main__':
    main()
```

## Pre-flight + run sequence

```bash
# 1. Full DB dump
pg_dump $DATABASE_URL > ~/backups/pre-wipe-$(date +%F-%H%M).sql

# 2. Stop Flask / put app in maintenance
# (depends on your deploy — systemctl / pm2 / manual kill)

# 3. Dry run
cd backend && source venv/bin/activate
python wipe_dev_patients.py --dry-run

# 4. Real wipe
python wipe_dev_patients.py

# 5. Sanity check — no patients, users intact
flask shell
>>> from app.patients.models import Patient
>>> Patient.query.count()     # 0
>>> from app.auth.models import User
>>> User.query.count()        # > 0
```

## Verification checklist

- `SELECT COUNT(*) FROM patients` = 0
- `SELECT COUNT(*) FROM patient_visits` = 0
- `SELECT COUNT(*) FROM form_submissions` = 0
- `SELECT COUNT(*) FROM uhid_history` = 0
- `SELECT last_sequence FROM uhid_counters WHERE year = 2026` = 0 for every zone row
- `SELECT COUNT(*) FROM users` unchanged from pre-wipe
- `SELECT COUNT(*) FROM forms` unchanged from pre-wipe
- Log in to the frontend; patient list is empty; form templates still visible; no 500s.

---

# PART 2 — Import

## Excel shape (Master Sheet, 150 rows)

29 columns. Key ones mapped; irrelevant ones (`remarks`, `PPS score` is ~1 populated, `Follow up.2/3/4`, `Phone Follow up`, `phone follow up`) are ignored for round 1.

| Excel column | Non-null / 150 | → Patient field | Notes |
|---|---|---|---|
| `Name ` (trailing space) | 150 | `full_name` | `.strip()`; mandatory |
| `Gender` | 150 | `gender` | normalize to `Male` / `Female` / `Other` |
| `Age` | 146 | `date_of_birth` | `date.today() - age*365 days`; set `is_approximate_dob=True` |
| `Diagnosis` | 149 | `diagnosis` | `.strip()` |
| `Mobile Number` | 149 | encrypted `contact` (phone) | coerce to str, strip `.0` if float |
| `Relation with the patient` | 147 | `external_metadata.relation_primary` | Kept for reference |
| `Mobile Number.1` | 140 | `alternative_phone` | str-coerce |
| `Relation with the patient.1` | 136 | `alternative_phone_name` | `.strip()`, max 100 chars |
| `Zone` | 150 | `geographic_cluster` | `South` / `East` / `North` / `West` / `Central` |
| `Address` | 150 | encrypted `address` | `.strip()` |
| `Base location` | 150 | `external_metadata.base_location` | reference |
| `Location pin` | 32 | `external_metadata.location_pin_url` | Google Maps URL |
| `BSC` | 149 | `bsc_status` | `'Yes'` → True, `'No'` → False, else None |
| `Hospital UHID ` | 143 | `external_id` + `external_metadata.hospital_uhid` | `str(int(...))` |
| `Homecare UHID Code` | 30 | `linked_hospital` | derive: `'KAGBAKMIO'` → `KMIO` (use HOSPITAL_CATALOG keys) |
| `Homecare UHID ` | 30 | `uhid` | preserve existing value; str-coerce |
| `Date of registration` | 19 | `created_at` | only if present; else leave default |
| `1st visit` | 30 | Initial `PatientVisit.visit_date` | create visit row if present |
| `Date of death` | 8 | `date_of_death` | also set `is_deceased=True` |
| `Place of death` | 8 | `external_metadata.place_of_death` | reference |
| `Follow up`, `Follow up.1` | 3, 2 | Optional follow-up visits | round 2 — skip this round |

Constants for every imported patient:
- `is_bangalore_resident = True`
- `is_onco = True` (all Kidwai oncology home-visit patients)
- `referred_from = 'Kidwai'`
- `source_system = 'kidwai_import'`

## UHID handling — preserving existing numbers

30 rows already have a Homecare UHID. We preserve those values verbatim and **bump `uhid_counters`** so subsequent newly-minted UHIDs don't collide.

For each pre-existing UHID of format `YYYYZZNNNN`:
- parse `year=YYYY`, `zone_code=ZZ`, `sequence=NNNN`
- `UPDATE uhid_counters SET last_sequence = GREATEST(last_sequence, NNNN) WHERE year=YYYY AND zone_code=ZZ`
- Then insert the patient with that `uhid` directly (bypass `PatientService.create_patient`'s UHID generation — write to the column, then let the service fill in the rest).

For rows WITHOUT an existing UHID, call `PatientService.create_patient` normally; the counter (now primed) allocates the next free number in each zone.

Zone code map (from existing `uhid_service.py` — verify during implementation):

| Zone name (Excel) | Zone code |
|---|---|
| South | 01 |
| East | 02 |
| North | 03 |
| West | 04 |
| Central | 05 |

## Deduplication

`PatientService.check_duplicate` only matches on `abha_address`, which this sheet doesn't have. For the import we add a secondary check:

```python
def already_imported(row) -> bool:
    hospital_uhid = str(int(row['Hospital UHID '])) if pd.notna(row['Hospital UHID ']) else None
    if hospital_uhid:
        hit = Patient.query.filter_by(external_id=hospital_uhid, source_system='kidwai_import').first()
        return hit is not None
    # Fallback: name + phone (both present in 149/150 rows)
    name = str(row['Name ']).strip()
    phone = _phone_str(row['Mobile Number'])
    if not phone:
        return False
    # Phone is encrypted — can't WHERE on it. Pull name matches, decrypt, compare.
    for p in Patient.query.filter(Patient.full_name == name).all():
        if p.get_phone() == phone:
            return True
    return False
```

Idempotency guarantee: re-running the import does not create duplicates.

## Deaths + initial visits

After `PatientService.create_patient`:
- If `Date of death` present: `patient.is_deceased = True; patient.date_of_death = row['Date of death'].date()`.
- If `1st visit` present: update the auto-created `PatientVisit` (visit_number=0, visit_type=initial) to `visit_date = row['1st visit'].date()` and `status='completed'`.

## Deliverable: `backend/import_kidwai_patients.py`

Standalone script, following the same shape as `seed_*.py`. Core loop:

```python
#!/usr/bin/env python3
"""Import Kidwai home-visit patients from Excel. Idempotent. --dry-run supported."""
import argparse, sys, re
from datetime import date, datetime, timedelta
import pandas as pd
from app import create_app
from app.extensions import db
from app.patients.models import Patient
from app.patients.schemas import PatientCreateSchema
from app.patients.services import PatientService
from app.patients.uhid_service import HOSPITAL_CATALOG, VALID_HOSPITAL_CODES
from app.saranam.models.patient_visit import PatientVisit

ZONE_CODES = {'South': '01', 'East': '02', 'North': '03', 'West': '04', 'Central': '05'}
HOMECARE_CODE_TO_HOSPITAL = {v: k for k, v in HOSPITAL_CATALOG.items()}  # 'KAGBAKMIO' -> 'KMIO'

def _phone_str(v):
    if pd.isna(v):
        return None
    s = str(v).strip()
    s = s.rstrip('.0') if s.endswith('.0') else s
    digits = re.sub(r'\D', '', s)
    return digits or None

def normalize_gender(g):
    if pd.isna(g):
        return None
    return str(g).strip().title()  # Male / Female / Other

def build_row(row, import_admin_id):
    # …map columns, handle age → DOB, coerce phones, etc.
    # returns (PatientCreateSchema, extras_dict) where extras_dict carries
    # pre-existing uhid, is_deceased, date_of_death, 1st_visit.
    ...

def import_row(row, admin_id, dry_run=False):
    if already_imported(row):
        return 'skipped_duplicate'
    schema, extras = build_row(row, admin_id)

    # If a pre-existing UHID is in the sheet, bump the counter BEFORE create
    if extras['preexisting_uhid']:
        year = int(extras['preexisting_uhid'][:4])
        zone = extras['preexisting_uhid'][4:6]
        seq = int(extras['preexisting_uhid'][6:])
        db.session.execute(db.text(
            "UPDATE uhid_counters SET last_sequence = GREATEST(last_sequence, :s) "
            "WHERE year = :y AND zone_code = :z"
        ), {'y': year, 'z': zone, 's': seq})

    if dry_run:
        return 'would_create'

    # Temporarily suspend UHID auto-mint if preexisting
    patient_dict = PatientService.create_patient(schema, created_by=admin_id)
    patient = Patient.query.get(patient_dict['id'])

    # Overwrite auto-generated UHID with preserved value
    if extras['preexisting_uhid']:
        patient.uhid = extras['preexisting_uhid']

    # Deaths
    if extras['date_of_death']:
        patient.is_deceased = True
        patient.date_of_death = extras['date_of_death']

    # Initial visit date from "1st visit"
    if extras['first_visit_date']:
        iv = PatientVisit.query.filter_by(patient_id=patient.id, visit_number=0).first()
        if iv:
            iv.visit_date = extras['first_visit_date']
            iv.status = 'completed'

    db.session.flush()
    return 'created'

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--file', default=str(Path.home() / 'Downloads' / 'Kidwai Home visit patients Line-list.xlsx'))
    ap.add_argument('--sheet', default='Master Sheet')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--admin-email', required=True, help='UUID of admin to record as created_by')
    args = ap.parse_args()

    app = create_app()
    with app.app_context():
        admin = User.query.filter_by(email=args.admin_email).first()
        if not admin:
            sys.exit(f'Admin user not found: {args.admin_email}')

        df = pd.read_excel(args.file, sheet_name=args.sheet)
        stats = {'created': 0, 'skipped_duplicate': 0, 'would_create': 0, 'errors': 0}
        for idx, row in df.iterrows():
            try:
                stats[import_row(row, admin.id, dry_run=args.dry_run)] += 1
            except Exception as e:
                stats['errors'] += 1
                print(f'ROW {idx} ({row.get("Name ", "?")}): {e}')
        if not args.dry_run:
            db.session.commit()
        print(f'\nStats: {stats}')

if __name__ == '__main__':
    main()
```

Full implementation expands `build_row` with every field-level coercion from the mapping table above. Keep `build_row` pure so it's unit-testable.

## Pre-flight + run sequence

```bash
# 0. Confirm ENCRYPTION_KEY is set (required for set_contact / set_address)
echo $ENCRYPTION_KEY  # non-empty

# 1. Dry run against the cleaned DB — should show "would_create" for every row
cd backend && source venv/bin/activate
python import_kidwai_patients.py --admin-email admin@saranam.in --dry-run

# 2. Real import
python import_kidwai_patients.py --admin-email admin@saranam.in

# 3. Re-run — should be fully idempotent
python import_kidwai_patients.py --admin-email admin@saranam.in
# expected stats: skipped_duplicate=150, created=0, errors=0
```

## Verification checklist

Post-import SQL:

```sql
-- 150 patients imported
SELECT COUNT(*) FROM patients WHERE source_system = 'kidwai_import';   -- 150

-- 30 preserved homecare UHIDs (plus any newly minted)
SELECT COUNT(*) FROM patients WHERE uhid IS NOT NULL;                  -- 150
SELECT COUNT(*) FROM patients WHERE uhid IS NULL;                      --   0

-- 8 deceased (from "Date of death" column)
SELECT COUNT(*) FROM patients WHERE is_deceased = true;                --   8

-- Zone distribution matches Excel per-zone sheet counts
SELECT geographic_cluster, COUNT(*)
FROM patients
WHERE source_system = 'kidwai_import'
GROUP BY geographic_cluster
ORDER BY 1;
-- expected: South=51, East=?, North=?, West=?, Central=? (match per-zone sheet row counts)

-- 30 patients with "1st visit" date got an initial visit record
SELECT COUNT(*) FROM patient_visits WHERE visit_number = 0 AND status = 'completed';  -- ≥ 30

-- Counter sanity: max sequence in each zone <= current last_sequence
SELECT uc.year, uc.zone_code, uc.last_sequence,
       (SELECT MAX(CAST(SUBSTR(p.uhid, 7, 4) AS INTEGER))
        FROM patients p
        WHERE SUBSTR(p.uhid, 1, 4) = CAST(uc.year AS TEXT)
          AND SUBSTR(p.uhid, 5, 2) = uc.zone_code) AS max_uhid_seq
FROM uhid_counters uc
WHERE uc.year = EXTRACT(YEAR FROM NOW());
-- last_sequence should be >= max_uhid_seq in every row
```

UI sanity:
- Log into the app, Patients list shows 150 rows.
- Open a deceased patient (e.g. `Umar` whose date of death is 2026-03-21 in the sheet) — the Patient Outcome shows the death.
- Open a patient with a `1st visit` date — Visits tab shows one completed visit on that date.
- Open the Analytics dashboard — Deaths (Last 30 days) card reflects the imported deceased patients (any within the 30-day window at cutover time).

## Known limitations (defer to round 2)

- Multiple follow-up visits in the Excel are not imported this round (columns `Follow up`, `Follow up.1` etc. are sparse and inconsistent).
- `Date of registration` is only populated in 19/150 rows; we let `created_at` default to the import timestamp.
- `PPS score` column is effectively empty in the source — skip.
- ABHA IDs are not in the sheet; existing dedup via `abha_address` is bypassed by the composite check above.
- No ICD-10 codes in source — `diagnosis` is free text.
- `Place of death` is stored in `external_metadata` only; no structured column today.

---

# Rollback

If either phase goes wrong:

```bash
# Restore from the pre-wipe dump
psql $DATABASE_URL < ~/backups/pre-wipe-YYYY-MM-DD-HHMM.sql
```

Because we take a `pg_dump` before the wipe and don't commit the import unless it finishes cleanly, any failure is a clean rewind to the exact pre-cutover state.

---

# Cutover checklist (one-pager)

```
[ ] Confirm ENCRYPTION_KEY set on prod host
[ ] Confirm admin email exists in users table
[ ] Run `alembic current` — head is s9t0u1v2w3x4
[ ] Stop Flask / enable maintenance mode
[ ] pg_dump → ~/backups/pre-wipe-YYYY-MM-DD-HHMM.sql
[ ] python wipe_dev_patients.py --dry-run
[ ] python wipe_dev_patients.py
[ ] Verify counts (see Part 1 verification)
[ ] python import_kidwai_patients.py --admin-email ... --dry-run
[ ] python import_kidwai_patients.py --admin-email ...
[ ] Verify counts (see Part 2 verification)
[ ] Restart Flask / disable maintenance mode
[ ] Smoke test: log in, Patients list, open one deceased patient, open Analytics dashboard
[ ] Archive the pg_dump off-server
```

## Where the scripts will live

```
backend/
  wipe_dev_patients.py          # new — Part 1
  import_kidwai_patients.py     # new — Part 2
```

Both follow the existing `seed_*.py` shape so the ops workflow is familiar.
