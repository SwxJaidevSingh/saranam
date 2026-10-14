# AI Summary — Extend to All Assessments + Patient-Level Combined Summary

## Context

Per `CHANGES_2026-04-28.md` §4, the client wants AI-generated clinical summaries for every assessment form, plus one combined patient-level summary on the profile page (downloadable as PDF). Demo target is the week of 2026-05-04.

**Critical finding from exploration:** the existing nursing "Auto-Generated Summary" is **not** an LLM call — it's a hand-written JS string template at `frontend/src/pages/patients/tabs/NursingAssessmentForm.jsx:94-114` (`generateSummary(gpe, pain, symptoms, hygiene)`). The output gets saved into `nursing_assessments.instructions_given`. The backend has an LLM abstraction (`backend/app/ai/llm_providers.py`) supporting Anthropic/OpenAI/Gemini, but it is only wired to the AI form-builder, and that flow expects the user to paste an API key on every request — not appropriate for clinician-facing summary buttons.

So this task is "introduce real LLM-backed summaries for the first time," not "extend an existing pattern."

### Decisions (confirmed with user)
- **Provider:** Google Gemini Flash (free tier). Use existing `GeminiProvider` in `llm_providers.py`; bump default model to `gemini-1.5-flash`.
- **Auth:** Server-side env var `GEMINI_API_KEY`. No per-user keys, no per-request keys.
- **Trigger:** Click-only ("Generate Summary" button). No auto-regeneration on save.
- **Editability:** LLM populates an editable textarea; clinician edits and saves. Stored output is the *clinician-approved* version.
- **Per-form summaries on:** Nursing, Doctor, Psychological, Physiotherapy (4 forms — matches the four accordions in the screenshot).
- **Combined summary:** one button on the patient profile, aggregates Initial Assessment (Baseline) + all sub-assessments (Nursing / Doctor / Psych / Physio / ESAS-R / PPS / Plan of Care / Procedures) across visits. Stored as a snapshot; downloadable as PDF.
- **The original "patient initial assessment summary"** goal collapses into the four per-form buttons + combined summary — there is no separate "initial assessment" form; the baseline visit is just a container of the same sub-assessments.

---

## Architecture

### Backend

#### 1. Configure Gemini provider
- `backend/.env.example` — add `GEMINI_API_KEY=` (commented placeholder).
- `backend/app/ai/llm_providers.py:121` — change `GeminiProvider` default model from `gemini-pro` to `gemini-1.5-flash`. (No new provider, no second client.)
- `backend/app/config.py` (or wherever settings live) — read `GEMINI_API_KEY` from env.

#### 2. New module: `backend/app/ai/assessment_summary.py`
Single service with:
- `summarize_assessment(visit_id, assessment_type) -> str` — fetch the assessment row, render the per-type prompt, call Gemini, return text.
- `summarize_patient(patient_id) -> str` — fetch baseline visit + latest of each assessment type across all visits + patient demographics, render the combined prompt, call Gemini.
- Each call goes through `get_llm_provider('gemini', api_key=os.getenv('GEMINI_API_KEY'), model='gemini-1.5-flash')`. Reuses the existing factory — no duplicate client code.
- Failure mode: raise `ValueError` with a clinician-friendly message; route returns 502 with that message. No silent fallback to the old JS template.

#### 3. Prompts: `backend/app/ai/assessment_summary_prompts.py`
Five concise, clinically-framed prompts (palliative-care lens, since this is a palliative-care app):
- **Nursing** — focus on functional status, pain, active symptoms, devices, wounds, hygiene, nursing actions taken.
- **Doctor** — diagnosis, comorbidities, examination findings, clinical impression, plan.
- **Psychological** — mental status, mood/affect, cognitive concerns, distress drivers, coping resources.
- **Physiotherapy** — mobility, ROM/strength, pain on movement, equipment needs, therapeutic plan.
- **Patient (combined)** — holistic palliative narrative across all assessments: who the patient is, primary diagnosis + trajectory, current symptom burden (cite ESAS/PPS), functional status, psychosocial picture, current care plan, key recent interventions.

Each prompt enforces:
- Output 4–8 lines (Subjective / Objective / Assessment / Plan format for per-form; narrative paragraph for combined).
- No preamble, no markdown, no bullet padding.
- Use clinical shorthand (e.g., "PPS 50, ESAS pain 6/10").
- Flag missing data explicitly rather than inventing.

#### 4. New endpoints
Add to `backend/app/saranam/routes/assessments.py`:
- `POST /saranam/visits/<uuid:visit_id>/<assessment_type>/summary`
  - Validates `assessment_type` ∈ {nursing, doctor, psychological, physiotherapy}.
  - Calls `summarize_assessment()`, returns `{ summary: str, model: str, generated_at: iso }`.
  - **Does not persist** — frontend lets clinician edit, then saves via existing assessment save endpoint into the new `ai_summary` column.

Add to `backend/app/saranam/routes/` (new file `patient_summary.py` or extend an existing patient route file):
- `POST /saranam/patients/<uuid:patient_id>/summary/generate` — generates and returns text (no persist).
- `PUT /saranam/patients/<uuid:patient_id>/summary` — saves clinician-edited text into `patient_ai_summaries` (upsert).
- `GET /saranam/patients/<uuid:patient_id>/summary` — returns current saved snapshot + metadata.

#### 5. DB migration
New Alembic migration `migrations/versions/<rev>_add_ai_summary_columns.py`:
- Add `ai_summary TEXT NULL` to: `nursing_assessments`, `doctor_assessments`, `psychological_assessments`, `physiotherapy_assessments`.
- Create new table `patient_ai_summaries`:
  - `id UUID PK`
  - `patient_id UUID FK patients.id UNIQUE` (one snapshot per patient — upsert, not history; matches user's "click button to (re)generate" mental model)
  - `summary_text TEXT NOT NULL`
  - `generated_at TIMESTAMP NOT NULL`
  - `generated_by UUID FK users.id`
  - `model_used VARCHAR(100)` (e.g., `gemini-1.5-flash`)
  - `created_at`, `updated_at`

Update model files:
- `backend/app/saranam/models/nursing_assessment.py`, `doctor_assessment.py`, `psychological_assessment.py`, `physiotherapy_assessment.py` — add `ai_summary = Column(Text)` and include in `to_dict()`.
- New `backend/app/saranam/models/patient_ai_summary.py`.

> **Note on existing nursing field:** `instructions_given` is currently doing double duty as both "what nurse instructed" and "auto-generated summary" (UI label is "Auto-Generated Summary (editable)" but field is `instructions_given`). New `ai_summary` column gives nursing a clean home; the frontend will move to using it. `instructions_given` stays untouched — backwards compatible, no data migration.

### Frontend

#### 6. API client extension
`frontend/src/api/saranam.js` — add:
- `generateAssessmentSummary(visitId, type)` → POST `/saranam/visits/{visitId}/{type}/summary`
- `generatePatientSummary(patientId)` → POST `/saranam/patients/{patientId}/summary/generate`
- `savePatientSummary(patientId, summary_text)` → PUT `/saranam/patients/{patientId}/summary`
- `getPatientSummary(patientId)` → GET `/saranam/patients/{patientId}/summary`

#### 7. Per-form changes (4 files)
For each of these forms, add a "Generate from assessment" link-button + an editable "Auto-Generated Summary" textarea in the existing Visit Summary section, mirroring the nursing layout in the screenshot:
- `frontend/src/pages/patients/tabs/NursingAssessmentForm.jsx` — **replace** client-side `generateSummary()` call (line 181-186) with an `await saranamApi.generateAssessmentSummary(visitId, 'nursing')` that requires the form to have been **saved first** (the backend reads the DB row). Save flow: Save assessment → click Generate → edit summary → click Save again to persist `ai_summary`. Migrate persistence from `instructions_given` to new `ai_summary` column.
- `frontend/src/pages/patients/tabs/DoctorAssessmentForm.jsx` — add same UI block + handler.
- `frontend/src/pages/patients/tabs/PsychologicalAssessmentForm.jsx` — same.
- `frontend/src/pages/patients/tabs/PhysiotherapyAssessmentForm.jsx` — same.

UX: button is disabled with tooltip "Save assessment first" until the form has been saved at least once for this visit. Loading state on the button while LLM call is in flight (~2–4s for Gemini Flash).

#### 8. Patient-level summary on profile
`frontend/src/pages/patients/tabs/OverviewTab.jsx` — add a new card/section near the top labelled **"AI Patient Summary"** with:
- "Generate Patient Summary" button (calls `generatePatientSummary`).
- Editable textarea showing returned text.
- "Save Summary" button → `savePatientSummary`.
- "Download PDF" button → uses `jsPDF` (already in `package.json` ^4.2.0). Reuse styling from `frontend/src/utils/generateVisitPDF.js`. New utility: `frontend/src/utils/generatePatientSummaryPDF.js` — header (patient name, UHID, DOB, date generated), body (the summary text wrapped to A4), footer (model name + "Reviewed by: <clinician>").
- "Last generated" timestamp + model name shown next to the button when a saved snapshot exists. On mount, call `getPatientSummary(patientId)` to populate.

---

## Critical files to modify or create

**Backend — modify**
- `backend/app/ai/llm_providers.py:121` (Gemini default → `gemini-1.5-flash`)
- `backend/app/saranam/routes/assessments.py` (new summary endpoint)
- `backend/app/saranam/models/{nursing,doctor,psychological,physiotherapy}_assessment.py` (add `ai_summary` column + `to_dict()`)
- `backend/.env.example` (add `GEMINI_API_KEY`)

**Backend — create**
- `backend/app/ai/assessment_summary.py`
- `backend/app/ai/assessment_summary_prompts.py`
- `backend/app/saranam/models/patient_ai_summary.py`
- `backend/app/saranam/routes/patient_summary.py` (or extend an existing patients route file)
- `backend/migrations/versions/<rev>_add_ai_summary_columns.py`

**Frontend — modify**
- `frontend/src/api/saranam.js`
- `frontend/src/pages/patients/tabs/NursingAssessmentForm.jsx` (replace client-side template; switch to `ai_summary` field)
- `frontend/src/pages/patients/tabs/DoctorAssessmentForm.jsx`
- `frontend/src/pages/patients/tabs/PsychologicalAssessmentForm.jsx`
- `frontend/src/pages/patients/tabs/PhysiotherapyAssessmentForm.jsx`
- `frontend/src/pages/patients/tabs/OverviewTab.jsx`

**Frontend — create**
- `frontend/src/utils/generatePatientSummaryPDF.js` (modeled on `generateVisitPDF.js`)

**Reused (no change)**
- `backend/app/ai/llm_providers.py` `get_llm_provider()` factory and `GeminiProvider` class
- `frontend/src/utils/generateVisitPDF.js` patterns (jsPDF setup, sectionTitle helpers)

**Off-limits (parallel worktree)**
- `backend/app/teleconsult/`
- `frontend/src/pages/teleconsult/`

---

## Verification plan

1. **Setup**
   - Add a real `GEMINI_API_KEY` to `backend/.env` (free key from Google AI Studio).
   - Run `cd backend && alembic upgrade head` to apply the new migration.
   - Restart backend; check `/saranam/visits/<id>/nursing/summary` route is registered.

2. **Per-form summary smoke test (do for each of the 4 forms)**
   - Open a patient → initial visit → fill Nursing Assessment → Save.
   - Click "Generate from assessment" → verify spinner → verify text appears in the textarea within ~5s.
   - Edit the text, click "Save Nursing Assessment" → reopen the form → confirm edited summary persists (loaded from `ai_summary` column).
   - Repeat for Doctor / Psychological / Physiotherapy.

3. **Combined patient summary**
   - On the same patient (with at least 2 assessments filled), open Overview tab.
   - Click "Generate Patient Summary" → verify it cites data from multiple assessments (e.g., diagnosis from doctor form + PPS score + nursing observations).
   - Edit + Save Summary → reload page → confirm saved snapshot loads with timestamp + "gemini-1.5-flash" label.
   - Click "Download PDF" → open the PDF → confirm patient name, UHID, summary body, generated date all render correctly.

4. **Failure cases**
   - Unset `GEMINI_API_KEY` and click Generate → expect a clean error toast, no crash, no garbled summary.
   - Empty assessment (no fields filled) → summary should explicitly note "insufficient data" rather than fabricate.
   - Click Generate before Save → button should be disabled with tooltip.

5. **Quality review (manual)**
   - Generate summaries on 3 real anonymized patient records spanning different complexity levels.
   - Have Dr. Ashwini's team review for clinical sharpness vs. the old JS template — that's the demo deliverable.

6. **Backend tests** (if a test harness exists)
   - Add `backend/tests/test_assessment_summary.py` mocking `GeminiProvider.generate` to verify route wiring, prompt rendering, and the protected-fields contract on the save flow.
