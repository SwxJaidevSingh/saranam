# Hospital Portal — completion scratchpad (work through step by step)

**Updated:** 2026-06-11. Branch: `feature/hospital-portal`. Prod DB: DigitalOcean.
Check items off as we go. Top section = highest priority.

---

## 0. Decided flow (from discussion)
- **Two separate login realms** (the cross-login bug must be impossible):
  - **Main dashboard (Saranam)** ← only Saranam/platform users (`is_platform_admin=true`).
  - **Hospital portal** ← only hospital users (have an active org membership). Saranam creds must NOT log in here.
- **Org + hospital management lives in the MAIN dashboard** (new sidebar module "Manage Hospitals / Organisations"): Saranam admin creates/manages orgs and creates/invites org users.
- Consequence: **no more god-view inside the portal** — Saranam manages everything from the main dashboard.
- Internal org **renamed CVRAMAN → "Saranam"** (display name; id `37f03ea9-…` stays).

---

## 1. 🔐 SECURITY — strict realm separation  ✅ DONE (commit `realm separation`, verified)
- [x] **Portal login** `POST /api/portal/auth/login` (`app/portal/auth_routes.py`): requires an active org membership; Saranam-only users → 403.
- [x] **Main-app login** `POST /api/auth/login`: requires `is_platform_admin`; hospital users → 403.
- [x] **Main-app data gate** (`app/__init__.py` before_request): non-platform JWTs blocked on `/api/*` except `/api/auth`, `/api/portal`, `/api/public`, and shared lookups `/api/patients/config|zones|duplicate-check`; token-less requests pass (webhooks safe).
- [x] **Portal frontend** → login now hits `/api/portal/auth/login` (`api/auth.js`).
- [x] **Verified:** hospital→main 403, saranam→portal 403, hospital JWT→`/api/patients` 403, platform→main 200, portal data path (patients/baseline/body-map) 200.
- [ ] (minor, later) Remove now-unreachable god-view dead code in `OrgContext`/`OrgSelect` (platform admins can no longer log into the portal, so it never triggers).

## 2. 🏢 MAIN DASHBOARD — "Manage Hospitals" module  ✅ DONE & API-verified (commits `5121747` + adapter)
- [x] **Backend** `/api/admin/*` (platform-admin gated): list/create/edit orgs (+ member/patient counts), create user (email+pw), invite user (email→portal accept), list/manage members; create-org auto-syncs the hospital catalog. (`app/admin/`)
- [x] **Frontend** (`frontend/`): sidebar "Manage Hospitals" → Organisations list + create/edit org + per-org Members/Invites panels. Adapter `api/admin.js` normalizes shapes.
- [x] **Set-password** = the existing portal `/accept-invite` page (invite emails link there).
- [x] Verified via API: list=4 orgs, create org 201, create user 201, members ok; ZZTEST test artifact cleaned.
- [ ] UI browser test pending (log into main app as a role=`admin` Saranam user → "Manage Hospitals").
- [ ] (note) Module is gated on main-app role `admin`; a platform-admin who is role=`data_entry` (e.g. Ramesh) won't see it in the UI — adjust the guard if needed.

## 2b. 🔁 Duplicate-email rules (Option B)  ✅ DONE & verified (commit `1238858`)
Shared helper `app/organizations/email_realm.py` (one source of truth for god-view `/api/admin` + org-admin `/api/portal`):
- **Create user** — any existing email blocks; realm/membership-aware 409: `email_exists_platform` (Saranam staff) / `email_exists_member` (already in this org) / `email_exists_other_org` (use Invite instead).
- **Invite** — block `email_is_platform` (Saranam staff) + `already_member` (in this org); **allow** an existing hospital user from another org (multi-org membership).
- **Accept-invite** — a platform/Saranam email can never be linked into a hospital (`email_is_platform`, defense in depth).
- Verified on DO: create-user 3×409 (platform/member/other-org); invite 409 platform + 409 member; unit-matrix confirms new-email→create-ok and other-org→invite-ok.
- [ ] **DEFERRED (user: "do it later")**: `register_user` / main-dashboard user creation doesn't set `is_platform_admin=True` → such users can't log into the MAIN app. Not part of this rule set.

## 3. 🧹 Org rename CVRAMAN → Saranam  — ⏭️ SKIPPED (user decided to leave it; rename was reverted)
- Org stays `code='CVRAMAN'` / `name='CV Raman / Saranam'` (id `37f03ea9-…` unchanged). `_default_org_id` stays `code='CVRAMAN'` based.

## 5. Portal remaining screens  — ✅ DONE & verified (commits `7a403b8` backend + `aa1b3ab` frontend)
- [x] **Org Settings** — view org profile + org_admin edits branding (display_name/logo/accent). `GET/PUT /api/portal/org-settings`.
- [x] **Referral Feedback** — gated by `show_referral_feedback` (Saranam toggles it in Manage Hospitals); curated SAFE fields only. `GET /api/portal/referral-feedback`. Verified 403→200.
- [x] Org-admin self-invite already in portal (Wave 2). Placeholder.jsx removed; both moved to live sidebar.

## 4. 🧪 Patient sample-data revert
- [ ] When testing is done, run `revert-sample-patients.md` (moves the 30 back to Saranam).

## 5. Portal — remaining screens
- [ ] **Org Settings** (currently "Coming soon"): branding/profile (read or edit — TBD).
- [ ] **Referral Feedback** (currently "Coming soon"): backend (gated by `show_referral_feedback`) + UI showing curated outcome of referred patients.
- [ ] (Decision pending) Org-admin self-service invites inside the portal — keep the built "Org Users & Invites" page, or centralize all user mgmt in the main dashboard?

## 6. Hardening (later)
- [ ] Phase 5: Postgres RLS as defense-in-depth on top of app-layer scoping.
- [ ] Confirm `rameshrami1611` full name; tidy any test users.

---

### Open questions to confirm before building §1–§2
1. Strict realm separation (no portal god-view) — confirmed?
2. Org-admin invites in the portal (two-tier) vs all user creation centralized in main dashboard?
