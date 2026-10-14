# Body Map Rewrite — Implementation Plan

**Owner:** Farzan
**Driver:** CHANGES_2026-04-28.md items #4 (P0) + #12 (P1)
**Status:** Planning → ready to execute
**Last updated:** 2026-05-01

---

## 1. Goal

Replace the dual-mode body map (today: `Highlighted Regions` powered by `react-body-highlighter` muscular figure + `Free-Click Notes` on a line-art PNG) with **one unified body view** that supports two layered annotation sources:

- **User free-click annotations** (red) — exactly as today: dot, rectangle, ellipse with text labels.
- **AI-generated highlights** (pink/coral) — produced when doctor clicks "Generate Patient Summary." Constrained to a fixed library of ~30 anatomical zones; AI cannot invent coordinates.

This solves three problems at once:

1. The two modes worked independently and felt disconnected.
2. The "highlighted-region mode is not working as expected" complaint (Dr. Ashwini).
3. The multi-complaint rendering bug (#12) — every symptom gets its own zone, no first-only truncation.

## 2. Out of scope (v1)

- Position editing of AI highlights (text-only edit; geometry locked to zone library).
- Per-item Accept/Reject on regenerate (we use silent-diff with userEdited protection instead).
- Rule-based / regex fallback when AI is unavailable (no AI = no highlights).
- AI highlights on per-form summaries (only patient-level summary triggers them).
- Soft-delete / version history of highlights.

## 3. Final design decisions

| # | Decision |
|---|---|
| Body view | Single line-art body. Drop `react-body-highlighter` and the mode toggle. |
| User layer | Red dots/rect/ellipse — unchanged behavior + new edit modal. |
| AI layer | Pink/coral `#ec4899`, translucent fill (~18%), dashed border, ✨ icon on label. Renders BELOW user layer. |
| AI input | Gemini 2.5 Flash, structured JSON output (`responseSchema`), zone slug enum. |
| Trigger | Only "Generate Patient Summary" (patient-level). Not per-form summaries. |
| Storage | New JSONB column `patient_ai_summary.body_locations`. Patient-scoped. |
| User free-click storage | Unchanged: `doctor_assessments.body_map_annotations` (visit-scoped). |
| Multi-zone | Yes — AI emits a list, each item = one zone. |
| Regenerate | Silent diff. Preserve userEdited entries. Toast: "+2 added, −1 removed, 1 updated, kept your edits on left_knee." |
| User edit of AI marks | Yes — same modal as user marks. Sets `userEdited: true`. Geometry locked. |
| Zone library | ~30 zones, hardcoded JSON, normalized 0–1 coords. One slug = one zone = one view. |

## 4. Data model

### 4.1 Free-click annotations (UNCHANGED)
Stored on `doctor_assessments.body_map_annotations` (JSONB), visit-scoped:
```json
{
  "id": "uuid",
  "kind": "dot|rect|ellipse",
  "view": "front|back",
  "x": 0.42, "y": 0.65,
  "width": 0.10, "height": 0.07,
  "text": "free-form note",
  "labelOffsetX": -70, "labelOffsetY": -20
}
```

### 4.2 AI body locations (NEW)
Stored on `patient_ai_summary.body_locations` (JSONB column, default `'[]'`), patient-scoped:
```json
{
  "id": "uuid",
  "zoneSlug": "left_knee",
  "text": "Severe knee pain with swelling",
  "userEdited": false,
  "createdAt": "2026-05-01T10:00:00Z",
  "updatedAt": "2026-05-01T10:00:00Z"
}
```

**Why slug-only (no coords stored)?** The zone library is the source of truth for geometry. If we recalibrate `BODY_ZONES` later, all stored highlights re-render at the new positions automatically — no migration needed.

### 4.3 Zone library (`frontend/src/utils/bodyZones.js`)
Hardcoded JSON module, ~30 entries. Each:
```js
{
  slug: 'left_knee',
  view: 'front',                // 'front' | 'back' — exactly one
  kind: 'ellipse',              // matches free-click `kind` enum
  x: 0.54, y: 0.65,             // normalized top-left
  width: 0.10, height: 0.08,
  label: 'Left knee',           // human-readable label for AI prompt
}
```

**Initial zone roster (~31 slugs):**
- Head/neck: `head`, `neck`, `throat`
- Trunk front: `chest`, `upper_abdomen`, `lower_abdomen`, `pelvis`
- Trunk back: `upper_back`, `mid_back`, `lower_back`, `sacrum`
- Shoulders: `left_shoulder`, `right_shoulder` (front)
- Arms: `left_upper_arm`, `right_upper_arm`, `left_elbow`, `right_elbow`, `left_forearm`, `right_forearm`, `left_hand`, `right_hand`
- Legs: `left_thigh`, `right_thigh`, `left_knee`, `right_knee`, `left_shin`, `right_shin`, `left_foot`, `right_foot`
- Hips: `left_hip`, `right_hip` (back view)

**Left/right convention:** patient anatomy, not viewer. On front view, `left_knee` is on the image-right (mirrored). Zone library coords are pre-mirrored to render correctly. Matches existing R/L chip convention in `BodyMapView.jsx`.

## 5. Backend changes

### 5.1 Migration
```sql
-- backend/migrations/versions/<timestamp>_add_body_locations_to_patient_ai_summary.py
ALTER TABLE patient_ai_summary
  ADD COLUMN body_locations JSONB NOT NULL DEFAULT '[]'::jsonb;
```

Update `app/saranam/models/patient_ai_summary.py` model + `to_dict()` to include `body_locations`.

### 5.2 AI prompt (`app/ai/assessment_summary.py::summarize_patient`)

Return signature changes from `(text, model)` → `(text, body_locations, model)`.

Prompt skeleton (full version in `summarize_patient`):
```
You are a clinical AI assistant for palliative home-care. Given the assessments
below, produce:
1. A holistic clinical summary (≤250 words, doctor-facing).
2. A list of body locations relevant to the patient's symptoms.

For body locations, you MUST select from this enum (zone slugs):
{ZONE_ENUM}

Rules:
- Only zones with clear clinical relevance.
- Each zone gets a SHORT label (≤50 chars), e.g. "Severe pain", "Skin lesion", "Edema".
- Diffuse symptoms can use multiple zones.
- DO NOT invent slugs not in the enum.
- If no body-localized findings, return an empty list.

{IF previous_locations is not empty}
Previously identified locations: {previous_locations}.
Re-evaluate. Keep zones still relevant; remove ones no longer mentioned;
add newly-mentioned zones; update descriptions where the finding has progressed.
{ENDIF}

ASSESSMENTS:
{ASSESSMENT_DATA}

Respond ONLY with JSON matching the responseSchema below.
```

Use Gemini's `responseSchema` to enforce:
```python
response_schema = {
  "type": "object",
  "properties": {
    "summary": {"type": "string"},
    "body_locations": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "slug": {"type": "string", "enum": [<ZONE_SLUGS>]},
          "label": {"type": "string", "maxLength": 50},
        },
        "required": ["slug", "label"],
      },
    },
  },
  "required": ["summary", "body_locations"],
}
```

**Server-side validation:** drop any item whose slug is not in the enum (defense-in-depth — Gemini occasionally violates schema). Log warnings, never fail the whole generation.

### 5.3 Diff/merge logic
Pure function in `app/ai/body_locations_merge.py`:
```python
def merge_ai_body_locations(old: list[dict], ai_response: list[dict]) -> tuple[list[dict], dict]:
    """
    Merge new AI output with existing stored body_locations, preserving userEdited entries.
    Returns (new_list, diff_stats).
    """
```

Rules:
- For each slug in AI's new list:
  - If exists in old AND `userEdited=true` → keep old entirely (text + flag).
  - If exists in old AND not user-edited → update `text` to new label, bump `updatedAt`.
  - If not in old → add new entry.
- For each slug in old but NOT in AI's new list:
  - If `userEdited=true` → keep (don't drop user's curated entry).
  - Otherwise → drop (silent removal).

`diff_stats = {"added": N, "removed": N, "updated": N, "kept_user": N}` — surfaced to frontend for the toast.

### 5.4 Routes (`app/saranam/routes/patient_summary.py`)

- **POST `/saranam/patients/<id>/summary/generate`** — returns `{summary, body_locations, diff_stats, model}`. Reads existing `body_locations` to pass as `previous_locations` to AI; runs merge; returns the merged draft. **Does not persist.**
- **PUT `/saranam/patients/<id>/summary`** — accepts `{summary_text, body_locations, model?}`; persists snapshot.
- **PATCH `/saranam/patients/<id>/summary/body-locations/<location_id>`** *(optional convenience)* — single-item edit (sets `userEdited=true`, updates text). Alternative: frontend always sends full array via PUT. **Decision: skip PATCH; use full-array PUT.**

## 6. Frontend changes

### 6.1 Files touched
| File | Change |
|---|---|
| `frontend/src/pages/patients/tabs/BodyMapView.jsx` | Major rewrite: drop highlighted-regions, add AI layer, add edit modal |
| `frontend/src/pages/patients/tabs/OverviewTab.jsx` | Drop `regions` prop; add `aiHighlights` prop |
| `frontend/src/utils/bodyZones.js` | **NEW** — zone library |
| `frontend/src/utils/bodyRegionMapper.js` | **DELETE** |
| `frontend/src/api/patientSummary.js` (or equivalent) | Update Generate/Save signatures |
| `frontend/package.json` | Remove `react-body-highlighter` |
| `frontend/src/assets/body-front.png`, `body-back.png` | Unchanged |

### 6.2 BodyMapView.jsx new shape
```jsx
<BodyMapView
  freeClickMarkers={visit.body_map_annotations}      // existing — visit-scoped
  onMarkersChange={saveFreeClick}
  aiHighlights={patientSummary.body_locations}       // NEW — patient-scoped
  onAiHighlightsChange={saveAiHighlights}            // NEW
  readOnly={false}
/>
```

Removed props: `regions`, `manualAnnotations`, `onAnnotationsChange`, `defaultDetailed`, `onRegionClick`.

### 6.3 Rendering layers (z-order, bottom → top)
1. Body PNG (front + back side-by-side) — unchanged.
2. **AI highlight shapes** (pink translucent fill, dashed border) — resolve `zoneSlug` → `BODY_ZONES[slug]` → render as rect/ellipse using existing renderers.
3. AI highlight labels (white box + ✨ icon).
4. **User free-click shapes** (red, solid) — existing render path.
5. User leader lines.
6. User labels.
7. User dots (red, on top).

This guarantees doctor's red dots are always clickable on top of any AI highlight.

### 6.4 Edit modal (replaces Close+Delete popup)
Reuses creation modal layout. State machine:
- **Add mode** (today's create flow): textarea empty, button = "Save".
- **Edit mode** (NEW): textarea pre-filled with `marker.text`. Buttons: `Cancel` / `Delete` / `Save`.
- On save in edit mode for an AI mark → set `userEdited: true`.
- On save in edit mode for a user mark → just update text.
- ESC closes; Cmd/Ctrl+Enter saves.

### 6.5 AI highlight click handler
Same modal as user marks, in edit mode. Doctor can:
- Edit the text → sets `userEdited: true`, persists.
- Delete → removes from list, persists. (Note: a deleted AI mark may reappear on next regen unless its slug is no longer flagged by AI.)

### 6.6 Generate Patient Summary flow
1. Doctor clicks "Generate Patient Summary."
2. Frontend calls POST `/summary/generate`.
3. Receives `{summary, body_locations, diff_stats}`.
4. Body map updates immediately to show new AI highlights (pink) alongside existing user marks (red).
5. Toast: *"Body map updated: +2 added, −1 removed, 1 updated. Kept your edits on left_knee."* (suppressed when all stats are 0 on first generation).
6. Summary textarea fills with new text.
7. Save button is enabled. Doctor reviews, clicks Save → PUT.

### 6.7 Calibration tool (dev-only)
Hidden URL `?calibrate=zones` shows the body map with:
- Click anywhere → outputs normalized `{view, x, y}` to a side panel.
- Drag → outputs `{view, x, y, width, height}`.
- "Copy as zone def" button → copies a code-ready snippet to clipboard.
- Optional: load existing `BODY_ZONES` and let me drag handles to refine.

This makes calibration a 30-min job instead of trial-and-error file-edit loops. Only included in dev builds (gated by `import.meta.env.DEV`).

## 7. Cleanup checklist

- [ ] Remove `react-body-highlighter` from `frontend/package.json` and `node_modules`.
- [ ] Delete `frontend/src/utils/bodyRegionMapper.js`.
- [ ] Delete `regions`-related state and handlers from any component that passed it to BodyMapView.
- [ ] Search for and remove any imports of `Model` from `react-body-highlighter`.
- [ ] Remove the "Highlighted Regions / Free-Click Notes" toggle UI.
- [ ] Remove the description line "Auto-generated from assessment data. Switch to Free-Click Notes…" — replace with shorter copy.

## 8. Phasing (5 PRs, mergeable independently)

### Phase 1 — Strip + foundation
- Delete `react-body-highlighter`, `bodyRegionMapper.js`, mode toggle.
- Single body view (today's free-click) is the only mode.
- Add `bodyZones.js` with ~30 zones (initial estimate; calibrate next).
- Add dev-only `?calibrate=zones` tool.
- Use the calibration tool to fine-tune `BODY_ZONES` against the actual PNGs.
- **Acceptance:** existing free-click feature works identically, muscular figure gone, zone library calibrated and committed.

### Phase 2 — Edit modal for free-click markers
- Replace Close+Delete popup with full edit modal (Save/Cancel/Delete + pre-filled textarea).
- **Acceptance:** doctor can edit existing free-click marker text without delete-recreate.

### Phase 3 — Backend AI body-locations
- Migration: `body_locations` column on `patient_ai_summary`.
- Update `summarize_patient` to use Gemini structured output and return `(text, body_locations, model)`.
- Implement `merge_ai_body_locations` with userEdited preservation.
- Update routes: Generate returns body_locations + diff_stats; PUT persists.
- **Acceptance:** Generate Summary returns body_locations array of valid zone slugs; diff merge preserves userEdited rows.

### Phase 4 — Frontend AI highlight rendering
- BodyMapView accepts `aiHighlights` prop, renders pink translucent shapes via zone resolver.
- Click on AI mark opens edit modal (Phase 2 modal, with `userEdited=true` on save).
- OverviewTab / Summary tab fetch and pass body_locations.
- **Acceptance:** AI highlights render correctly, are editable in place, persist to DB.

### Phase 5 — Regenerate UX + toast
- On Generate, show diff toast with `+N added, −N removed, N updated, kept your edits on X`.
- Verify userEdited preservation end-to-end (manual test: edit AI mark → regen → confirm preserved).
- **Acceptance:** smooth regenerate experience, edits never silently lost.

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Gemini structured-output rare misses | Server-side validation, drop invalid slugs, log warnings, never fail the whole call |
| Zone calibration accuracy | Dev-only calibration tool; iterate with a doctor reviewing |
| Mixed-language assessments (Hindi/Kannada) | Gemini handles cross-lingual well; test with sample data; slug enum stays English |
| Stale AI highlights after symptom resolution | Doctor controls regen timing; future: add "Last updated" timestamp on body map |
| AI hallucinating zone outside enum | `responseSchema` enum constraint + server validation |
| Doctor accidentally loses AI highlight by clicking Delete | v1: doctor confirms via modal; future could add undo toast |

## 10. Open questions (defer until execution)

- Should the AI highlight label include the zone name as well as the AI's clinical text (e.g. "Left knee — severe pain")? Or just the clinical text? **Default:** just clinical text; the position on the body conveys the zone.
- Do we want a legend on the body map ("Pink = AI suggestion, Red = your annotation")? **Default:** no on first paint, add only if doctors ask.
- Toast styling — does the project already have a toast library? Check during Phase 5.

## 11. Touch list (final)

**Backend:**
- `backend/migrations/versions/<NEW>.py` (new)
- `backend/app/saranam/models/patient_ai_summary.py`
- `backend/app/saranam/routes/patient_summary.py`
- `backend/app/ai/assessment_summary.py`
- `backend/app/ai/body_locations_merge.py` (new)

**Frontend:**
- `frontend/src/pages/patients/tabs/BodyMapView.jsx`
- `frontend/src/pages/patients/tabs/OverviewTab.jsx` (and any other body-map consumers)
- `frontend/src/utils/bodyZones.js` (new)
- `frontend/src/utils/bodyRegionMapper.js` (delete)
- `frontend/src/utils/bodyZonesCalibrator.jsx` (new, dev-only)
- `frontend/src/api/` patient summary client
- `frontend/package.json`

**Docs:**
- This file.
- Update `CHANGES_2026-04-28.md` to mark items #4 and #12 as in-progress / done as phases land.
