# Initial Assessment (Baseline) — Fields with Character Limits

**Prepared:** 8 June 2026
**Form:** Initial Assessment (Baseline)
**Purpose:** Make the team aware of which fields in this form currently have a **maximum
character limit** set in the database, so that long entries are not unexpectedly rejected.

---

## What "character limit" means

Some fields in the form can only store up to a fixed number of characters (letters, numbers,
spaces, and punctuation all count). If someone enters text **longer than the limit**, the system
shows a *"value too long"* error and the form will **not save** until the entry is shortened.

There are two kinds of limited fields:

- **Dropdown fields** — you pick from a preset list (e.g. *Conscious / Semi-conscious /
  Unconscious*). The limit almost never affects you here, because the preset options already fit.
  It would only matter if a new, longer option is added in future.
- **Free-text fields** — you type the entry yourself. **These are the ones where the limit can
  actually be hit**, if a long note is typed.

---

## Summary

| Form section | Fields with a limit | Type |
|---|---|---|
| Nursing Assessment — General Observation | 7 | Dropdown |
| Nursing Assessment — Hygiene Assessment | 3 | Dropdown |
| PPS (Palliative Performance Scale) | 5 | Auto-filled (dropdown) |
| **Total** | **15** | **15 dropdown (0 free-text)** |

> **Note:** Every **free-text** field that previously had a limit causing "value too long" errors
> has now been corrected and has **no limit**:
> - **Doctor's Assessment** — all free-text fields (Chief Complaints, History, Examination
>   findings, Diet, Appetite, Doctor's Notes, etc.).
> - **Physiotherapy Assessment → Built (Observation)** — fixed on 8 June 2026.
> - **ESAS‑R → Other Symptom Name** — fixed on 8 June 2026.
>
> The only fields that still carry a limit are **dropdown fields** (preset options), which you do
> not type into — so the "value too long" error can no longer occur during normal use.

---

## Detailed list of limited fields

### 1. Nursing Assessment — General Observation  *(dropdown fields)*

| Field (as shown in form) | Max characters | How it's filled |
|---|---|---|
| Consciousness | 20 | Pick from list |
| Orientation | 20 | Pick from list |
| Demeanour | 20 | Pick from list |
| Built | 20 | Pick from list |
| ADL (Activities of Daily Living) | 30 | Pick from list |
| Hygiene (General) | 10 | Pick from list |
| Wound Odour | 20 | Pick from list |

### 2. Nursing Assessment — Hygiene Assessment  *(dropdown fields)*

| Field (as shown in form) | Max characters | How it's filled |
|---|---|---|
| Environmental Hygiene | 50 | Pick from list |
| Oral Hygiene | 50 | Pick from list |
| Skin Hygiene | 50 | Pick from list |

### 3. PPS — Palliative Performance Scale  *(auto-filled from the PPS % you select)*

| Field | Max characters | How it's filled |
|---|---|---|
| Ambulation | 100 | Auto-filled |
| Activity Level | 255 | Auto-filled |
| Self-Care | 100 | Auto-filled |
| Intake | 100 | Auto-filled |
| Consciousness Level | 100 | Auto-filled |

### 4. ESAS‑R

✅ **No limited fields remain.** The *Other Symptom — Name* field was fixed on 8 June 2026 and now
has **no character limit**.

### 5. Physiotherapy Assessment

✅ **No limited fields remain.** The *Built (Observation)* field was fixed on 8 June 2026 and now
has **no character limit**.

---

## What this means in practice

- **All 15 remaining limited fields are dropdowns** — you choose from preset options, so you will
  **not** hit these limits in normal day-to-day use.
- **No free-text (typed) field has a character limit anymore** — every field you type into can
  accept any length.
- All the **main clinical narrative fields** (complaints, history, examination notes, plans,
  remarks, summaries) have **no character limit**.

---

## Recommendation

If the team would like, these limits can be **removed** so that any length of text can be entered
in the free-text fields, and the dropdown fields can be widened so future option labels are never
a problem. Please let us know which fields, if any, you'd like us to make unlimited.
