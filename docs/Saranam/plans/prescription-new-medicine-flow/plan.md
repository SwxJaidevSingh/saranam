# Prescription flow → new structured-medicine flow

## Context
We rebuilt the Medicine Master with structured strength (`strength_components`, `strength_per_value/_unit`,
derived `strength` string) and 45 stock-list meds. The prescription UI hasn't caught up:

1. **Enum leak (root cause):** `MedicineMasterSchema` serializes `dosage_form` by `str()`-ing the Python
   enum, so the API returns `"DosageForm.TABLET"`. This shows raw in the medicine-search dropdown, and the
   per-row **Dosage Form select stays on "Select"** because the raw value matches no option. Confirmed in the
   screenshot and in earlier API output (`"dosage_form": "DosageForm.INJECTION"`).
2. **Vocabulary mismatch:** even cleaned, the prescription's `DOSAGE_FORM_OPTIONS` lacks some inventory forms
   (`suspension`, `cream`, `ointment`), so those wouldn't auto-select without a small map.
3. **Combination/concentration strength is lost:** on select, only the first ingredient prefills the Dosage
   field (e.g. Tramadol+Paracetamol shows `37.5 mg`, dropping `+ 325 mg`; Amikacin `500 mg/2 ml` → `500 mg`).

`PrescriptionBuilder.jsx` is **shared** by the prescription tab (PlanOfCareForm) and follow-up visits
(VisitDetailView), so one set of fixes covers both. The PDF (`generatePrescriptionPDF.js`) renders from the
same medication objects.

## Decisions (confirmed with user)
- **Show full strength:** carry the medicine's full `strength` string onto the prescription and surface it
  (row label + PDF Strength column). Per-time schedule slots still capture how much to take.
- **Scope:** the shared `PrescriptionBuilder` + the PDF. The leak fix is global (backend), so OPD/HomeCare/
  Physio inline tables + dispense/PO displays get the raw enum fixed for free; their full auto-fill wiring is
  out of scope.

## Changes

### 1. Backend — fix the enum serialization (global, single source of truth)
`backend/app/inventory/schemas.py` — `MedicineMasterSchema.dosage_form`: replace `fields.Str()` with a
serializer that returns the enum's clean lowercase value (`"tablet"`, `"injection"`, `"suspension"`…),
defensively stripping any `DosageForm.` prefix. e.g.
```python
dosage_form = fields.Function(lambda o: _dosage_form_value(o), allow_none=True)
# _dosage_form_value: return o.dosage_form.value if Enum, else str(...).replace('DosageForm.','').lower() or None
```
This fixes all 5 medicine endpoints (list / get / search / create / update responses) at once. The existing
`.replace('DosageForm.', '')` calls in `MedicinesList.jsx` become harmless no-ops.

### 2. Frontend constants/helpers — `frontend/src/constants/prescription.js`
- Add `{ value: 'suspension', label: 'Suspension' }` to `DOSAGE_FORM_OPTIONS` (used by ORS sachet).
- Add `formatDosageForm(v)` — DISPLAY helper: strip any `DosageForm.` prefix (defensive for old snapshots) +
  Title-case via the options' labels.
- Add `toPrescriptionDosageForm(v)` — maps an inventory form to the closest option `value` for the `<select>`:
  `cream`→`cream_ointment`, `ointment`→`cream_ointment`; everything else passes through (tablet, capsule,
  injection, syrup, suspension, inhaler, drops, patch).

### 3. Frontend — `frontend/src/components/common/PrescriptionBuilder.jsx`
- `emptyMed()` (~line 116): add `strength: ''`.
- `handleMedSelect()` (~439-479): set `strength: medicine.strength || ''`; set
  `dosage_form: toPrescriptionDosageForm(medicine.dosage_form)` so the Dosage Form select auto-populates; keep
  the `strength_components[0]` → `dosage_value/dosage_unit` prefill (per-dose editable value).
- Dropdown subtitle (line 105): render `formatDosageForm(med.dosage_form)` instead of the raw value.
- Medicine row (~608-614): show a small muted **Strength** label under the medicine name from `med.strength`
  (so combinations/concentrations display in full, e.g. `37.5 mg + 325 mg`, `500 mg/2 ml`).

### 4. Frontend — carry-forward defensive clean (old snapshots may hold `DosageForm.X`)
- `VisitDetailView.jsx` (~311-321) and `PlanOfCareForm.jsx` (~48-49): when loading carried-forward
  medications, normalize each `dosage_form` through `toPrescriptionDosageForm()` and keep `strength` (fallback
  to `dosage` when an old snapshot lacks it). One small `.map()` over `cf.medications`.

### 5. PDF — `frontend/src/utils/generatePrescriptionPDF.js` (and mirror in `generateVisitPDF.js`)
- Per-medicine row (~300-301): show `med.strength || med.dosage` and `formatDosageForm(med.dosage_form)`.
- Header (~315): rename the `Dosage` column to **`Strength`** (keeps full combo/concentration strings).
- `generateVisitPDF.js` (~278): same `formatDosageForm` clean-up for its Form cell.

### 6. Optional polish (free leak fix already applied by #1; only capitalization)
Apply `formatDosageForm()` at the display spots that print `dosage_form`: `ImmediateMedicineSection.jsx`
(267, 289), `QuickDispenseSelector.jsx` (141, 191), `POItemsTable.jsx` (172), `ProviderStockManagement.jsx`
(115), `MedicinesList.jsx` (234). Low risk, nice-to-have.

## Reuse (don't reinvent)
- `strength_components` shape + `derive_strength_string` already established (backend `inventory/services.py`).
- `DOSAGE_FORM_OPTIONS`, `normalizeFrequency` already in `constants/prescription.js` — extend, don't duplicate.
- `PrescriptionBuilder.handleMedSelect` already prefers `strength_components` — just add strength + form map.

## Verification
1. Point the local backend at the **dev DB** (`saranam_dev`, has the 45 meds) and seed a test patient
   (`backend/seed_test_patient.py`) so the prescription flow is exercisable without touching prod.
2. API: `GET /api/inventory/medicines/search?q=Tramadol` → confirm `dosage_form` is now `"tablet"` (not
   `"DosageForm.TABLET"`).
3. UI (localhost:5173): open a visit → PrescriptionBuilder → search "Tramadol + Paracetamol":
   - dropdown subtitle reads `37.5 mg + 325 mg • Tablet`
   - on select, **Dosage Form** auto-selects "Tablet", **Strength** label shows `37.5 mg + 325 mg`
   - repeat for "Amikacin" → form "Injection", strength `500 mg/2 ml`; "ORS Sachet" → "Suspension".
4. Generate the prescription PDF → **Strength** column shows the full strings; Form column shows clean labels.
5. Follow-up: open a follow-up visit for the same patient → carried-forward meds load with clean form +
   full strength.
6. Regression: Medicine Master list still shows forms (now Title-cased).

## Notes
- The backend serialization change is display-only and safe; it also benefits prod once deployed.
- On approval, copy this plan to `docs/Saranam/plans/prescription-new-medicine-flow/plan.md` per repo convention.
- No DB migration needed — purely serialization + UI.
