# Prescription PDF Versioning + Cloudinary + Analytics — plan

**Branch:** `feature/prescription-versioning`. **Prod DB:** DigitalOcean (head `f2b3c4d5e6f7`).
Started 2026-06-15. Decisions locked with the client (see conversation).

## Model (industry standard: immutable, versioned, signed documents)
- Each issued prescription PDF is an **immutable instance** (a version). Edits never
  mutate a prior version; they create the next one. All versions are kept.
- One **per-patient** version chain (`v1, v2, …`), each labeled by its visit
  ("v3 · Follow-up · 15 Jun").
- The **doctor identity + signature is snapshotted into each version** (fixes the
  signature-disappearing bug permanently — it's frozen at issue time).

## Storage / privacy
- PDFs stored in **Cloudinary** (no S3). Uploaded as `resource_type=raw`,
  `type=authenticated` (private — NOT a public URL, since they carry patient PHI).
- **Download is backend-mediated + logged**: the backend fetches the private asset
  and streams it (and records a download event). Keeps PHI private, no extra infra.

## PDF generation
- **Client generates** the PDF (reuse existing `generatePrescriptionPDF.js` — no
  server template rebuild, no new infra) and uploads the blob to the backend on
  "Save / Issue". Backend stores it in Cloudinary + creates the version row.

## Flow
1. Draft: prescription form per visit, **auto-filled from the patient's latest version**.
2. Save = Issue: client builds PDF → POST to backend → Cloudinary (private) + version vN
   (dedupe: skip if content+doctor unchanged vs latest). Download enables.
3. Any change / follow-up → next version; old ones kept.
4. **Past Records modal**: list patient's last 10 versions, download each (logged).
5. Analytics tab: total downloads, per-user downloads, # patients with a prescription.

## Data model (additive migration)
- `prescription_versions`: patient_id, visit_id, plan_of_care_id, version_number (per
  patient), visit_type, snapshot JSONB (meds, icd10_diagnosis, diagnosis_text, notes),
  prescribing_doctor JSONB, content_hash, cloudinary_public_id, cloudinary_url,
  cloudinary_resource_type, file_bytes, created_by, created_at.
- `prescription_pdf_downloads`: version_id, patient_id, downloaded_by, created_at.

## Backend endpoints (under /api/saranam)
- POST `/visits/<visit_id>/prescription/issue` — multipart (pdf + json) → version.
- GET  `/patients/<patient_id>/prescription-versions` — last 10 (modal).
- GET  `/prescription-versions/<version_id>/download` — log + stream the PDF.
- GET  `/patients/<patient_id>/prescription/latest` — snapshot for auto-fill.
- GET  `/analytics/prescriptions` (analytics_bp) — download metrics.

## Bugs folded in
- **Signature persistence** → solved by the per-version doctor snapshot + auto-fill.
- **Dosage unit not reflecting** → recombine `dosage_value`+`dosage_unit` into `dosage`
  on change; render unit in the PDF dosage column.

## Checklist
- [x] models + migration (applied to DO — a3c4d5e6f7a8 + b4d5e6f7a8b9, backups taken)
- [x] cloudinary PDF upload + private fetch helper (+ DB fallback when no creds)
- [x] backend endpoints + register routes
- [x] backend API tests (issue/dedupe/version/list/download/latest/analytics — all pass)
- [x] frontend: PDF blob, issue-on-save, download, auto-fill, dosage-unit fix
- [x] Past Records prescription-versions modal
- [x] analytics widget
- [~] end-to-end test — API tested + full Vite build passes. Browser click-through
      NOT done (Chrome extension not connected). User to verify in browser.

## Status (2026-06-15) — built + API-tested on branch `feature/prescription-versioning`
- ⚠️ `CLOUDINARY_URL` in backend/.env is EMPTY → Cloudinary not configured. The
  feature uses the **DB-bytes fallback** for now and will switch to Cloudinary
  automatically once a real `CLOUDINARY_URL` is added (no code change). The doctor
  signature feature was also silently on base64 for the same reason.
- DO head now `b4d5e6f7a8b9`. Servers running: backend :5002, frontend :5173.
- Not pushed (local feature branch).
