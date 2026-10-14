# Plan: Re-add the dropped hygiene detail columns (minimal unblock)

> Executed 2026-06-08. DB-only change applied to live Supabase
> (`db.fkzwqrwnebdjsegjyczs.supabase.co`). Status: **done & verified.**

## Context

A `flask db migrate -m "replace hygiene columns with hygiene_notes"` (run ~June 5–6, 2026)
was applied to the **live Supabase DB**. It dropped three columns from `nursing_assessments`
and added one:

- ❌ dropped `hygiene_environmental`, `hygiene_oral`, `hygiene_skin` (varchar)
- ✅ added `hygiene_notes` (text)

But the matching **code change was never committed** — the model
(`backend/app/saranam/models/nursing_assessment.py:61-63`) still maps the three dropped
columns, and the frontend (`frontend/src/pages/patients/tabs/NursingAssessmentForm.jsx:293-301`)
still renders/submits them. Because the SQLAlchemy ORM `SELECT`s those columns on every read,
**every nursing-assessment fetch 500'd** with:

```
column nursing_assessments.hygiene_environmental does not exist
```

**Goal:** restore the three columns so the nursing-assessment API works again, while **keeping**
the `hygiene_notes` column. Scope: **minimal unblock, new columns left NULL.**

## What was done (DB-only change — no code edits)

```sql
ALTER TABLE nursing_assessments
  ADD COLUMN hygiene_environmental varchar(50),
  ADD COLUMN hygiene_oral          varchar(50),
  ADD COLUMN hygiene_skin          varchar(50);
-- hygiene_notes intentionally NOT dropped
```

### Why `varchar(50)` (not the `varchar(10)` from the original migrate message)
- The widen migration `backend/migrations/versions/d4e5f6a7b8c9_widen_nursing_string_columns.py:28-30`
  set these to `String(50)`.
- The form's radio value `'Needs Attention'` is 15 chars; seed data (`seed_test_patient.py`) has
  `'Adequate, clean home environment'` (31 chars) — both overflow `varchar(10)`.
- The model declares `String(10)`, but SQLAlchemy length only affects DDL generation, not runtime
  SELECT/DML — so `varchar(50)` works fine with the existing model.

## Verification (passed)

- `information_schema` shows `hygiene_environmental/oral/skin` = varchar(50),
  `hygiene_general` = varchar(10), `hygiene_notes` = text.
- The previously-failing read for `visit_id = ae85138f-36c2-4051-96b5-ced217fb151e` now returns a
  row (`hygiene_general='Fair'` preserved; the three re-added columns NULL; `hygiene_notes` intact).

## Known drift NOT addressed (accepted, on record)

1. **Alembic phantom head.** DB is stamped at revision `4ff0a21e96dc`, which has **no file** in
   `backend/migrations/versions/` (true on-disk head is `d0e1f2a3b4c5`). The next
   `flask db migrate` / `upgrade` may fail until the DB is re-stamped
   (`flask db stamp d0e1f2a3b4c5`).
2. **`hygiene_notes` is orphaned** — present in the DB, mapped nowhere in code. A future
   autogenerate could propose dropping it.
3. **Model says `String(10)`, DB is `varchar(50)`** — harmless at runtime; a future autogenerate
   diff may notice it.

## Recovery note

Dropped values are effectively unrecoverable: local/Neon backups don't contain this table, and
`ai_summary` / `patient_ai_summaries` / `audit_logs` contain zero hygiene references. Only
full-fidelity option would be Supabase Dashboard → Database → Backups / PITR (restore before
2026-06-05) — not pursued (9 rows of test data).
