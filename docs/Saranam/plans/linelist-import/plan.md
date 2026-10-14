# Line-list patient import (Feb 2026 – May 16 2026)

## Goal
Bulk-import the ~191 new patients from
`~/Downloads/line list feb 2026 - may 16th 2026.xlsx` (sheet `Socio_demographic`)
into the `patients` table, skipping any already present.

## Source data
- 196 data rows; 192 unique Hospital UHIDs; 4 in-file duplicate pairs.
- 1 row already in DB (Hospital UHID `20230023763`, "Noorjan .").
- Sheet `List of interventions` is a reference list — ignored.

### Column map (0-based, `Socio_demographic`)
| idx | column | target |
|----|--------|--------|
| 0  | Date of registration | `patients.created_at` (post-create override) |
| 1  | Date of first contact | initial-visit `visit_date` |
| 4  | Hospital UHID | `hospital_uhid` + `external_id` |
| 5  | Home care UHID CODE | `linked_hospital` (KAGBAKMIO→KMIO) |
| 6  | Home care UHID | `uhid` (preserved if present & free) |
| 7/8| First / Last Name | `full_name` |
| 9  | Patient Status | `is_deceased` / `care_status` |
| 12 | Patient Category | `bsc_status` + `is_onco` |
| 13 | Date of birth | `date_of_birth` (if present) |
| 14 | Age | `date_of_birth` approx (`is_approximate_dob=True`) |
| 15 | Gender | `gender` |
| 16 | Detailed Address | encrypted `address` |
| 17 | Location | `external_metadata.location` |
| 18 | PIN address (Google Map) | `external_metadata.location_pin` |
| 19 | Zone | `geographic_cluster` + `is_bangalore_resident` |
| 20 | Diagnosis | `diagnosis` (trunc 100) |
| 21 | Primary caregiver | `primary_caregiver_relationship` / `_name` |
| 22 | Decision Maker | `decision_maker_designation` / `_name` |
| 23 | Contact number 1 | encrypted phone |
| 24 | Contact number 2 | `alternative_phone` |
| 25 | Co-morbidities | `external_metadata.comorbidities` |
| 26 | Last follow up date | `external_metadata.last_follow_up` |
| 27 | Date of death | `date_of_death` |
| 28 | Place of death | `place_of_death` (Home→home, Hospital→hospital) |

## Approach
- Reuse `PatientService.create_patient` + `PatientCreateSchema` so encryption,
  initial-visit creation, and validation match the normal registration path.
- Stamp `source_system='linelist_import'` and `external_id=<Hospital UHID>`.
- Preserve the pre-existing Home care UHID where present (bump `uhid_counters`).

## Idempotency / dedup
- Skip if a patient with `external_id=<Hospital UHID>` + `source_system='linelist_import'` exists.
- Skip the 2nd+ occurrence of a Hospital UHID within the file.
- Re-running the script is safe (skips already-imported rows).

## Testing sequence
1. `--dry-run` full file — verify counts, no writes.
2. Real import with `--limit 3` — inspect 3 patients in the DB / UI.
3. Full real import.

## Script
`backend/import_linelist_patients.py` — flags: `--file`, `--dry-run`,
`--limit N`, `--admin-email`.
