# Medicine Stock List — Rebuild + Structured Strength

**Date:** 2026-06-18
**Goal:** Replace the medicine master with the client's canonical 45-item stock list, add structured
strength handling (so concentrations like `500 mg/2 ml` and combinations like `100 mg + 325 mg` are
first-class), set 1000 stock for each new item, then deactivate medicines not on the list.

## Decisions (confirmed with client)
1. **Target DB:** Build + verify on a non-prod DB first, then apply to **production (DigitalOcean)**.
   - ⚠️ `backend/.env` currently points at the **abandoned Supabase** DB. Production runs on
     DigitalOcean. The "run" steps must use the correct URL; code work is DB-agnostic.
2. **Strength model:** **Structured fields** (not free text, not data-only).
3. **Dosage forms:** Map odd items (sachet/respule/lotion/jelly/solution) to the **nearest existing**
   enum value (no enum migration).
4. **Strength input UI:** **Guided rows** — one or more `[value][unit]` ingredient rows + "add
   ingredient", plus an optional **"per volume"** `per [value][unit]` for liquids/injections, with a
   live preview of the derived string.

## Structured-strength schema (additive, backward-compatible)
New nullable columns on `medicine_master`:
- `strength_components` JSONB — `[{ "value": <num>, "unit": "<str>" }, ...]` (1+ entries)
- `strength_per_value` Numeric(10,3) nullable — concentration denominator (e.g. `2` for `/2 ml`)
- `strength_per_unit`  String(10)  nullable — denominator unit (e.g. `ml`)
- `strength` (existing String) — **derived display string**, e.g. `"500 mg / 2 ml"`,
  `"100 mg + 325 mg"`. Kept so existing read sites + prescription builder need no change.

Derivation rule for the display string:
- components joined by `" + "` (each `"<value> <unit>"`)
- if `per_value`/`per_unit` set → append `" / <per_value> <per_unit>"` (omit value when `1`)

Existing 15 rows: best-effort parse current `strength` text into components; unparseable rows keep
the string and leave structured fields null (still display fine).

## Work phases
1. **Migration** — add 3 columns (nullable); backfill `strength` from structured where parseable.
2. **Backend** — `MedicineCreateSchema`/`UpdateSchema` + `create_medicine`/`update_medicine` accept
   `strength_components` + `per`, derive + store `strength`. Dump structured fields in
   `MedicineSchema`.
3. **Frontend form** (`MedicinesList.jsx`) — replace single Strength text box with guided rows +
   per-volume + live preview.
4. **Prescription builder** (`PrescriptionBuilder.jsx:443`) — prefill dosage from
   `strength_components[0]` instead of the regex; fall back to string when structured absent.
   (Fixes the silent-blank dosage on ratio/combination/percentage meds.)
5. **Seed script** (`backend/seed_stock_list.py`) — idempotent upsert of the 45 meds (structured
   strengths, mapped forms/units) + 1000 stock at **Central Store** each. Re-runnable.
6. **Run on dev DB**, verify in local UI (servers already running; frontend :5173).
7. **Review combined list with client → deactivate** off-list meds (soft delete `is_active=false`).
8. **Apply to production** after sign-off.

## Canonical dataset (45)
Form/unit mapped to nearest existing enum; ⚠ = imperfect map flagged for review.

### Tablets / Capsules (20) — form `tablet` unless noted, unit Tablet/Capsule
| # | Name | Strength (display) | Form | Unit |
|---|------|--------------------|------|------|
|1|Aceclofenac + Paracetamol|100 mg + 325 mg|tablet|Tablet|
|2|Amoxycillin + Clavulanic Acid|500 mg + 125 mg|tablet|Tablet|
|3|Bisacodyl|5 mg|tablet|Tablet|
|4|Ciprofloxacin|500 mg|tablet|Tablet|
|5|Ciprofloxacin + Tinidazole|500 mg + 600 mg|tablet|Tablet|
|6|Fluconazole|150 mg|tablet|Tablet|
|7|Gabapentin|300 mg|capsule|Capsule|
|8|Hyoscine Butylbromide|10 mg|tablet|Tablet|
|9|Levocetirizine|5 mg|tablet|Tablet|
|10|Levofloxacin|500 mg|tablet|Tablet|
|11|Lorazepam|1 mg|tablet|Tablet|
|12|Metoclopramide|10 mg|tablet|Tablet|
|13|Ondansetron|8 mg|tablet|Tablet|
|14|Pantoprazole|40 mg|tablet|Tablet|
|15|Paracetamol|650 mg|tablet|Tablet|
|16|Spironolactone|25 mg|tablet|Tablet|
|17|Tramadol + Paracetamol|37.5 mg + 325 mg|tablet|Tablet|
|18|Tramadol|50 mg|capsule|Capsule|
|19|Pregabalin|75 mg|capsule|Capsule|
|20|ORS Sachet|21 g|⚠ suspension|Sachet|

### Injections / Nebulization (13) — form `injection` unless noted
| # | Name | Strength (display) | Form | Unit |
|---|------|--------------------|------|------|
|1|Amikacin Sulphate Injection|500 mg / 2 ml|injection|Ampoule|
|2|Dexamethasone Injection|8 mg / 2 ml|injection|Ampoule|
|3|Hydrocortisone Sodium Injection|100 mg|injection|Vial|
|4|Lignocaine 2% Injection|2% (30 ml)|injection|Vial|
|5|Metoclopramide Injection|10 mg / 2 ml|injection|Ampoule|
|6|Metronidazole Injection|500 mg / 100 ml|injection|Bottle|
|7|Midazolam Injection|10 mg / 2 ml|injection|Ampoule|
|8|Ondansetron Injection|8 mg / 4 ml|injection|Ampoule|
|9|Tranexamic Acid Injection|500 mg / 5 ml|injection|Ampoule|
|10|Pantoprazole Injection|40 mg|injection|Vial|
|11|Hyoscine Butylbromide Injection|20 mg / ml|injection|Ampoule|
|12|Budesonide Respule|0.5 mg / 2 ml|⚠ inhaler|Respule|
|13|Levosalbutamol Respule|1.25 mg / 2.5 ml|⚠ inhaler|Respule|

### Syrups / Ointments / Solutions (12)
| # | Name | Strength (display) | Form | Unit |
|---|------|--------------------|------|------|
|1|Citralka Syrup|100 ml|syrup|Bottle|
|2|Cremaffin Syrup|200 ml|syrup|Bottle|
|3|Paracetamol Syrup|250 mg / 5 ml|syrup|Bottle|
|4|Sucralfate Syrup|1 g / 10 ml|syrup|Bottle|
|5|Terbutaline Sulphate Syrup|1.5 mg / 5 ml|syrup|Bottle|
|6|Diclofenac Ointment|1% w/w|ointment|Tube|
|7|Lignocaine Jelly|2%|⚠ ointment|Tube|
|8|Magnesium Sulphate Lotion|—|⚠ cream|Bottle|
|9|Mupirocin Ointment|2% w/w|ointment|Tube|
|10|Oral Glycerol|—|⚠ syrup|Bottle|
|11|Povidone Iodine Ointment|5% w/w|ointment|Tube|
|12|Povidone Iodine Solution|10% w/v|⚠ syrup|Bottle|

## Progress (2026-06-18)
- [x] Phase 1 — migration `c5e6f7a8b9c0` (3 nullable cols), down_revision `b4d5e6f7a8b9`.
- [x] Phase 2 — backend schema + service (`derive_strength_string`, structured create/update).
- [x] Phase 3 — frontend guided-rows strength UI + live preview (`MedicinesList.jsx`).
- [x] Phase 4 — prescription dosage prefill reads `strength_components` (`PrescriptionBuilder.jsx`).
- [x] Phase 5 — `seed_stock_list.py` (45 meds + 1000 stock @ Central Store; `--deactivate-off-list`).
- [x] Phase 6 — verified on local `saranam_dev`: 45 meds inserted, structured fields + 1000 stock
      correct via SQL **and** via the live API (`/api/inventory/medicines`).
- [ ] Phase 7 — deactivate off-list meds on prod (script ready; run with `--deactivate-off-list`
      after reviewing the dry-run list).
- [ ] Phase 8 — production rollout (needs prod DATABASE_URL / run on prod host).

**Dev environment:** local Postgres 14 on :5432, DB `saranam_dev`, built via `db.create_all()`
(the alembic chain is NOT replayable from scratch — pre-existing break re-adding
`bulk_import_items.service_match_type`). Backend currently runs against it
(`DATABASE_URL=postgresql://farzanmanzer@localhost:5432/saranam_dev`); login admin@cvraman.health
/ Admin@123. A plain `python run.py` reverts to the `.env` (Supabase) URL, which now lacks the new
columns until the migration is applied there.

## Notes / open items
- Drug schedule defaults to `H`; habit-forming items (Tramadol, Pregabalin, Gabapentin, Lorazepam,
  Midazolam) → `H1`. Confirm if stricter scheduling needed.
- "Lignocaine 2% Injection – 30 ml vial": 2% = strength, 30 ml = vial presentation (stored in name/
  note, not as strength denominator).
- Citralka/Cremaffin list only pack volume (no per-ml potency) — stored as a volume component.
- Removal is soft delete only (FK-safe); off-list meds set `is_active=false`.
