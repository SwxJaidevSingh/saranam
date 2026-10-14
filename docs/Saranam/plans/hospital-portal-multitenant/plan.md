# Hospital Portal & Multi-Tenant Platform — Plan

**Status:** Draft for sign-off · **Date:** 2026-06-10
**Owner:** Exatorial team · **Consumers:** CV Raman / Saranam care team + partner hospitals

---

## 1. Vision

Turn the current **single-tenant** system into a **multi-tenant platform**:

- The **existing main app** becomes the CV Raman **super-admin "god view"** — the care
  team continues to see *every* patient across *every* hospital. **Scope unchanged.**
- A **new, separate app — the Hospital Portal** — lets partner hospitals (KIMS, KC General,
  Kidwai, …) log in and **enter patients + their referral origin** into the shared DB.
- A **tenant-isolation layer** (Supabase-style) guarantees each hospital sees **only its own
  patients**. The only thing shared across hospitals is **reference/config data** (zones,
  diagnosis lists, hospital catalog) — **never another hospital's patients**, unless an
  explicit cross-org membership is granted (see §5).

> **Locked decisions**
> 1. "Public" data = **reference/config only**. Patients are always private to the entering org.
> 2. Patient "origin" = **structured referral source** (institution/channel). Geography stays in the existing zone system.
> 3. Main app stays the **god view**; the new app is the scoped hospital portal.
> 4. **Multi-org membership** — one user can belong to multiple orgs with a per-org role.
> 5. **Org provisioning:** hospitals **self-sign-up**, but a **new org goes live only after CV Raman platform-admin approval** from the main dashboard.
> 6. **Cross-org access = full membership** (acts as that org) — no separate grants table; reuses `OrganizationMembership`.
> 7. **Org directory visibility** is a per-org **toggle** (off by default): controls whether a hospital's users can even see other orgs exist.
> 8. **Post-intake editing:** hospitals **can edit** their patients for now (revisit later; future `is_locked_for_org` flag parked).
> 9. **Referral feedback loop:** built, gated by a **per-org toggle in the main dashboard**, exposing a **curated safe summary** only.
> 10. **Per-org branding** (logo, display name, accent color) — yes.
> 11. **User invites:** subsequent org users join via **email invite link** (needs transactional email infra — see §10/§14).

---

## 2. Three distinct "hospital" concepts (keep separate!)

The codebase already overloads "hospital." We keep three cleanly-separated meanings:

| Concept | Field | Meaning | Status |
|---|---|---|---|
| **Tenant org** | `patients.organization_id` (NEW) | Who *entered/owns* the patient → isolation key | NEW |
| **Linked hospital** | `patients.linked_hospital` | Drives UHID homecare prefix (e.g. `KAGBAKMIO`) | EXISTING — **do not disturb** |
| **Origin source** | `patients.origin_*` (NEW) | Where the patient was *referred from* | NEW (upgrades `referred_from`) |

⚠️ **UHID immutability contract is sacred.** `linked_hospital`, the `hospital_options`
catalog order, and `homecare_prefix` values must never change retroactively
(see `app/patients/uhid_service.py`). Multi-tenancy must not touch UHID generation.

---

## 3. Architecture decisions

1. **App shape — new frontend, same backend + DB.** A separate deployable React app
   (`hospital-portal/`) calling the existing Flask API via a new `/api/portal/*` namespace.
   Shared `patients` table with an added `organization_id`. No backend/DB fork.

2. **Isolation — shared schema + `organization_id` discriminator, enforced centrally in the
   app layer.** A single `TenantContext` (from JWT) + a query guard that always filters by
   org. Native Supabase RLS doesn't apply (SQLAlchemy + single DB role + in-app JWT). Postgres
   RLS via `SET LOCAL app.current_org_id` is **Phase 5 defense-in-depth**.

3. **Org/user model — `Organization` + `OrganizationMembership(user, org, role)`.** Supabase
   pattern. CV Raman staff are **platform admins** (`users.is_platform_admin`). Cross-org
   access is just an extra membership row — **no separate grants table**. Existing `User.role`
   is left intact for the main app; the membership layer is additive and governs the portal.

---

## 4. Data model

### 4.1 New: `organizations`
```
id                    UUID PK
code                  String(16) UNIQUE       -- 'KIMS', 'KMIO', 'KCGH', 'CVRAMAN'
name                  String(255)
display_name          String(255) NULL        -- branding
type                  String(20)              -- 'hospital' | 'ngo' | 'camp' | 'internal'
status                String(20)              -- 'pending_approval' | 'active' | 'suspended'
linked_hospital_code  String(10) NULL         -- optional default linked_hospital for intake
-- toggles (controlled from the main dashboard):
can_view_org_directory  Boolean default false -- can this org's users see other orgs exist?
show_referral_feedback  Boolean default false -- show curated outcome of patients they entered?
-- branding:
logo_url              String(500) NULL
accent_color          String(16)  NULL
is_active             Boolean default true
created_at / updated_at
```
- `CVRAMAN` (type=`internal`, status=`active`) is seeded as the owner of all existing patients.
- An org *may* map to a `hospital_options` catalog code (for linked_hospital defaults) but
  is a **separate concept** from the catalog.

### 4.2 New: `organization_memberships`
```
id              UUID PK
user_id         UUID FK users
organization_id UUID FK organizations
role            String(20)  -- 'org_admin' | 'org_data_entry' | 'org_viewer'
is_active       Boolean default true
invited_by      UUID FK users NULL
joined_at       DateTime NULL
UNIQUE(user_id, organization_id)
```
- Platform admins: `users.is_platform_admin` boolean (NEW). Existing main-app users backfilled
  to `is_platform_admin=true`.
- **Cross-org access** = inserting a membership row in the target org (granted by platform
  admin). No other mechanism needed.

### 4.3 New: `organization_invites` (email invite flow)
```
id              UUID PK
organization_id UUID FK organizations
email           String(255)
role            String(20)              -- pre-assigned role on acceptance
token_hash      String(255)             -- single-use, hashed
expires_at      DateTime
accepted_at     DateTime NULL
invited_by      UUID FK users
```
- On accept: invitee sets their own password → user created (or linked) → membership row
  inserted with the pre-assigned role.

### 4.4 `patients` — add columns
```
organization_id      UUID FK organizations   -- nullable → backfill → NOT NULL
-- Structured referral origin (upgrades free-text referred_from):
origin_type          String(20)  index  -- hospital|doctor|camp|self|ngo|govt_scheme|online|other  (REQUIRED at intake)
origin_source_code   String(10)  NULL    -- hospital catalog code when origin_type='hospital'
origin_organization_id UUID FK organizations NULL  -- set when the referrer is itself a tenant org
origin_source_name   String(150) NULL    -- doctor/camp/NGO name, free text
origin_referral_date Date        NULL
origin_notes         Text        NULL
-- parked for later (post-intake lock):
-- is_locked_for_org  Boolean default false
```
- `referred_from` retained for backward-compat; migrated/deprecated gradually.

### 4.5 Scope of `organization_id`
- **MVP: `patients` only.** Child clinical tables inherit org via the patient and are
  **god-view-only** for now — not scoped until hospitals get clinical views.

---

## 5. Tenant isolation enforcement

- **`TenantContext`** resolved per request from JWT: `{ user_id, is_platform_admin,
  active_org_id, role_in_org }`. Multi-org users send `X-Org-Id` (validated against their
  memberships) to set the active org.
- **Central read guard:** `tenant_scoped_query(model)` applies
  `.filter(organization_id == ctx.active_org_id)` for portal reads. Platform admins bypass.
- **Central write guard:** on create, `organization_id` is forced to `ctx.active_org_id`
  server-side — never trusted from the client.
- **Org directory:** a user only sees orgs they're a member of, **plus** (if
  `can_view_org_directory=true`) the *names* of other orgs — which remain inaccessible until a
  membership is granted.
- **Phase 5:** Postgres RLS policies keyed on `current_setting('app.current_org_id')`.

---

## 6. Roles & permissions

| Capability | platform_admin | org_admin | org_data_entry | org_viewer |
|---|:--:|:--:|:--:|:--:|
| See all orgs' patients (god view) | ✅ | ❌ | ❌ | ❌ |
| See own org's patients | ✅ | ✅ | ✅ | ✅ |
| Create/edit patients + origin | ✅ | ✅ | ✅ | ❌ |
| Invite/manage own org's users | ✅ | ✅ | ❌ | ❌ |
| Approve new orgs / grant cross-org membership | ✅ | ❌ | ❌ | ❌ |
| Toggle directory visibility / feedback per org | ✅ | ❌ | ❌ | ❌ |
| Org analytics | ✅ | ✅ | ✅ | ✅ |
| Cross-org / platform analytics | ✅ | ❌ | ❌ | ❌ |

---

## 7. Onboarding & provisioning flow

**New hospital (new org):**
1. Hospital rep self-signs-up → creates a **pending org** + **pending user** (`is_approved=false`, org `status=pending_approval`).
2. CV Raman platform-admin reviews in the main dashboard → **approves** → org `status=active`, the first user becomes `org_admin`.

**Additional users in an existing org:**
- `org_admin` sends an **email invite link** (`organization_invites`) → invitee sets password → joins with the pre-assigned role.
- Fallback: self-signup + `org_admin` approval (reuses `is_approved`).

**Cross-org access:** platform admin adds a membership row in the target org for the chosen user(s).

---

## 8. Patient Origin (structured referral source)

Captured at intake; `origin_type` is **required** (with `other` + notes as escape hatch):

- **origin_type:** hospital · doctor · camp · self/walk-in · ngo · govt_scheme · online · other
- **origin_source_code:** referring hospital (from the existing catalog) when type=hospital
- **origin_organization_id:** also stamped when the referrer is itself a tenant org
- **origin_source_name:** doctor/camp/NGO/scheme name (free text otherwise)
- **origin_referral_date** + **origin_notes**

Geography (zone/pincode) stays in the existing `geographic_cluster` / zone system
(see `plans/zone-rewrite`) — **not** part of origin.

---

## 9. Referral feedback loop (per-org toggle)

`organizations.show_referral_feedback` (set from main dashboard) gates a feedback panel in the
portal showing the **status of patients that org entered**. Exposes a **curated safe tier only**:
- ✅ care status (active / inactive / deceased), enrolled-in-program (y/n), last-contact date, high-level milestone.
- ❌ diagnoses detail, visit notes, PPS scores, observations, any clinical record.

(Exact feedback field list to be finalized when this screen is built.)

---

## 10. Analytics

**Per-org (in the portal):** intake volume trend · origin-type breakdown · top referral
sources · demographics (age bands, gender) · geographic distribution (reuse `geo_analytics`) ·
active vs total entered.

**Platform-wide (god view, main app):** cross-hospital comparison · conversion funnel
(entered → assessed → active → outcome) · origin analytics across all orgs.

---

## 11. API surface (new `/api/portal/*`)

- `POST /api/portal/auth/login`; org context via `X-Org-Id`
- `GET /api/portal/orgs/me`, `GET/POST /api/portal/organizations` (platform admin), org-approval endpoints
- `GET /api/portal/org-directory` (names only, when toggle on)
- `POST /api/portal/invites`, `POST /api/portal/invites/accept`
- `GET/POST/PUT /api/portal/patients` (org-scoped) + `PUT /api/portal/patients/:id/origin`
- `GET /api/portal/patients/:id/feedback` (when feedback toggle on)
- `GET /api/portal/analytics/*`

New namespace keeps portal concerns isolated from the main app's existing endpoints; it calls
the same services with org scoping.

---

## 12. The Hospital Portal (new app) — screens

1. **Login + Org switcher** (multi-org users pick the active hospital; branded per active org).
2. **Dashboard** — org analytics summary.
3. **Patients** — org-scoped list with search/filter.
4. **Add / Edit patient** — intake form reusing the existing dynamic form builder, scoped.
5. **Origin capture** — required structured referral-source step within intake.
6. **Org users** — invite/manage that hospital's users (org_admin only).
7. **Org settings/profile** — branding, etc.
8. **Referral feedback** — curated patient status (only when toggle on).

---

## 13. Migration & backfill

1. Create `organizations`; seed `CVRAMAN` (internal, active) + onboarded hospital orgs.
2. Add `patients.organization_id` (nullable) → **backfill all existing patients → `CVRAMAN`**
   (`linked_hospital` stays as-is) → set NOT NULL.
3. Add `organization_memberships`; backfill existing users → `is_platform_admin=true`.
4. Add `organization_invites`.
5. Add origin columns; optionally backfill `origin_type` from `referred_from` heuristically.

> Cross-check master-sheet reconciliation state before backfill (see `project_master_sheet_reconcile`).

---

## 14. Security & compliance

- Cross-tenant leakage = a reportable breach (DPDPA 2023 / ABDM). Isolation is a **compliance
  requirement** → app guard now, RLS later, audit all cross-org access.
- Continue encrypting sensitive fields (ABHA/contact/address) as today.

---

## 15. Rollout phases

- **Phase 0** — This plan signed off.
- **Phase 1** — Data model + migrations + backfill. Main app unaffected.
- **Phase 2** — `TenantContext` + scoping guards + `/api/portal/*` API + org provisioning/approval.
- **Phase 3** — Hospital Portal frontend (auth/org switch, intake, origin, patients, org admin, branding) + **transactional email infra** for invites.
- **Phase 4** — Org analytics (portal) + platform cross-org analytics (main app).
- **Phase 5** — Hardening: Postgres RLS, audit of cross-tenant access, rate limits.
- **(Later)** — Referral feedback screen; post-intake `is_locked_for_org`.

---

## 16. Remaining open items (non-blocking)

1. **Transactional email provider** for invites — Resend / SendGrid / Mailgun / AWS SES? (DigitalOcean deploy.)
2. **Feedback field list** — exact curated fields exposed in the referral feedback panel.
3. **Self-signup screening** — how org_admins verify a self-signup request is a real employee.
