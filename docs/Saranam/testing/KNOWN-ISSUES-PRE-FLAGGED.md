# Pre-Flagged Known Issues — found while authoring the test pack

**Version:** 1.0  •  **Date:** 2026-06-01

These issues were identified by **reading the actual frontend + backend code** while writing the test cases — they are *not yet verified by manual execution*. Each is mapped to the test case that will confirm it.

**How to use this list**
- **Dev team:** treat as a pre-go-live triage backlog. Items marked **Critical/High** are go-live risks.
- **Testing team:** when the linked test case **Fails**, this is an *already-known* issue — reference this doc's ID in **Remarks / Defect ID** instead of investigating from scratch. Still execute the case to confirm the behaviour on the live build (code may have changed).

> Severity is a code-review estimate; confirm during execution.

---

## Scheduling (SCH)

| Ref | Severity | Issue | Confirm via |
|-----|----------|-------|-------------|
| KI-SCH-01 | **High** | **No role separation in approvals** — the same authenticated user can both *submit* and *approve* a schedule; scheduling routes have no `requiredRole`/`requiredPermission` guard. A maker–checker control is expected for a clinical roster. | SCH-104 |
| KI-SCH-02 | Medium | **Broken navigation** — Kit Readiness "Back to Schedule" links to `/saranam/scheduling/{id}`, which has no matching route in `App.jsx` → lands on 404/Not Found. | SCH-080 |
| KI-SCH-03 | Medium | Past-week scheduling is **not hard-blocked** client-side (relies on backend). Confirm intended behaviour. | SCH-105 |
| KI-SCH-04 | Medium | An **empty schedule can be submitted** (no client-side guard against zero visits). Confirm intended backend behaviour. | SCH-109 |

## Providers (PRV)

| Ref | Severity | Issue | Confirm via |
|-----|----------|-------|-------------|
| KI-PRV-01 | Medium | **Search param mismatch** — list UI sends `search` / `limit`, backend route reads `q` / `per_page`; server-side search/pagination likely never takes effect. | PRV-055 |
| KI-PRV-02 | Medium | **"All" status filter excludes inactive providers** — UI omits `is_active` for "All", but backend defaults it to `true`, so deactivated providers don't appear under "All". | PRV-007 |
| KI-PRV-03 | Low | **No pagination UI**; list is hardcoded to `limit=100` — providers beyond 100 won't show. | PRV-014 |
| KI-PRV-04 | Low | No client-side validation for phone/`+91` or schedule end-after-start; depends entirely on backend. | PRV-019, PRV-066 |

## Inventory (INV)

| Ref | Severity | Issue | Confirm via |
|-----|----------|-------|-------------|
| KI-INV-01 | **High** | **Dispensing payload mismatch** — wizard POSTs `items:[{...batches...}]`, but `DispenseCreateSchema` expects a single-medicine shape (`medicine_id`, `dispensed_quantity`, `dispensed_from_location`). Dispensing may fail / save incorrectly. | INV-072 |
| KI-INV-02 | **High** | **Goods-Receipt payload mismatch** — PO receipt dialog sends `{items:[...]}`, backend `GoodsReceiveSchema` expects `{received_items:[...]}`. Receiving stock against a PO may fail. | INV-052 |
| KI-INV-03 | **High** | **Provider-stock transfer field mismatch** — assign sends `source_location_id`, return sends `destination_location_id`, but backend reads `from_location_id` / `to_location_id`. Transfers may not apply. | INV-097, INV-099 |
| KI-INV-04 | Medium | **PO "Submit for Approval" calls the wrong action** — on a draft it calls `approve` instead of `submit`, skipping the submit step / status transition. | INV-051 |
| KI-INV-05 | Medium | **Broken alert links** — AlertCard "View Medicine/Batch" targets routes that don't exist in `App.jsx`. | INV-088 |
| KI-INV-06 | Low | Alerts Dashboard query-param filters are **not read** by AlertsList; client-side-only search and current-page-only counts in PO/Dispensing/Alerts lists. | INV-090 |

## Analytics (ANL)

| Ref | Severity | Issue | Confirm via |
|-----|----------|-------|-------------|
| KI-ANL-01 | **High** | **Mock-data leak risk** — `DonorAnalyticsView` has a "demo data" mode backed by `donorMockData.js` that makes **zero API calls** and shows fabricated figures (e.g. 104 deaths, 165-patient cohort, fake ambulance regs). High risk if shown to donors as real. | ANL-033 |
| KI-ANL-02 | Medium | **No silent token refresh on analytics** — Dashboard/Vitals/Donor use a raw `axios` instance bypassing `api/client.js`'s 401 interceptor, so an expired token errors instead of refreshing (inconsistent with the rest of the app). | ANL-004, ANL-054 |
| KI-ANL-03 | Medium | **Wrong brand on exports** — `ExportButton.jsx` hardcodes "CV Raman Health" in PDF title / CSV header (should be Saranam). | ANL-045, ANL-046 |
| KI-ANL-04 | Medium | **Export ignores some tabs** — top-bar export only builds data for `patient`/`form` views; on Vitals/Donor it's `null`, producing a near-empty file mislabelled "Patient Analytics Report". | ANL-050 |
| KI-ANL-05 | Medium | **Donor view error coupling** — all 14 donor endpoints run in one `Promise.all`; any single failure blanks the whole view instead of degrading per-card. | ANL-037 |
| KI-ANL-06 | Low | Date-param inconsistency between views (full ISO vs `yyyy-MM-dd`); Vitals tab ignores the dashboard date range (always last 30 days). | ANL-043 |
| KI-ANL-07 | Low | No explicit end-before-start date guard (relies on the date-picker); Vitals view renders twice (duplicate API calls). Six analytics views (Symptoms/Risk/Geospatial/Optimization/Clinical/Financial) are **commented-out dead UI** — out of scope. | ANL-042, ANL-018 |

## Call Logs (CL)

| Ref | Severity | Issue | Confirm via |
|-----|----------|-------|-------------|
| KI-CL-01 | **High** | **Telephony endpoints unauthenticated** — `GET /api/exotel/calls`, `POST /api/exotel/make-call`, `GET /api/exotel/call-status/<sid>` have **no `@jwt_required()`** while the rest of the module is JWT-guarded. Anyone could read call logs or place outbound calls. | CL-080 (API & Security) |
| KI-CL-02 | **High** | **EmailModal crashes on open** — Rules-of-Hooks violation: `if (!patient) return null;` precedes a `useEffect`, so a `null → set` transition throws "Rendered more hooks…". | CL-077 |
| KI-CL-03 | High | **Sidebar item visible to non-admins** — the route is `requiredRole='admin'`, but the nav entry uses `permission:null`, so "Call Logs" shows for everyone (clicking it redirects). The "hidden for non-admins" assumption does **not** hold. | CL-003 |
| KI-CL-04 | Medium | **Email feature unreachable** — `EmailModal` is never imported/rendered in `CallLogsPage` and `sendEmail` (`POST /api/exotel/send-email`) is never invoked. | CL (Email Modal section) |
| KI-CL-05 | Medium | **Home-Care escalation is a client-only stub** — shows a success toast and removes the card locally but makes **no API call** (TODO in code); the referral isn't persisted. | CL (Escalated section) |
| KI-CL-06 | Low | Agent-status toggle reverts silently on `PUT /api/exotel/agent-status` failure (no error toast). | CL (Staff Registry section) |

## Users (USR)

| Ref | Severity | Issue | Confirm via |
|-----|----------|-------|-------------|
| KI-USR-01 | **High** | **No self-protection / last-admin guard** — backend `update_user` / `toggle_active_status` / `reject_user` let an admin demote or deactivate themselves or the last remaining admin → risk of total admin lockout. | USR-046, USR-047 |
| KI-USR-02 | Medium | **No admin-side user creation** — `UsersList` has no Add/Create button; users can only self-register at `/register` (pending approval). No invite / temp-password flow. | USR-052 |
| KI-USR-03 | Medium | **Filter/search/pagination is client-side only** — `getAllUsers()` fetches all users and filters in the browser; server-side `role`/`approval`/pagination params are never sent. | USR-013, USR-016, USR-048 |
| KI-USR-04 | Medium | **Pending-count mismatch** — header badge counts all `is_approved=false` (incl. rejected), but `GET /pending/count` counts only `is_approved=false AND is_active=true`; badge can exceed the API count. | USR-050 |
| KI-USR-05 | Low | **Filter overlap** — a rejected user (`is_approved=false`, `is_active=false`) appears under both "Pending Approval" and "Inactive" filters. | USR-018 |
| KI-USR-06 | Low | **Stale role claim** — a role change doesn't affect an existing session until token refresh / re-login (JWT carries the old role). No phone/`+91` field exists anywhere; no hard-delete (soft-delete/deactivate only). | USR-031, USR-032 |

## Settings (SET)

| Ref | Severity | Issue | Confirm via |
|-----|----------|-------|-------------|
| KI-SET-01 | Medium | **Settings is appearance-only** — there is **no** profile view/edit, change-password, notification preferences, organization settings, or logout on the Settings page. (No change-password endpoint exists in the backend either.) If account/profile management was expected here, it's missing. | SET-033 |
| KI-SET-02 | Medium | **Preferences are per-browser, not per-account** — all settings live in `localStorage` (`themeConfig`) with zero server persistence. A different user logging in on the same browser **inherits the previous user's** appearance; the same user on another device gets defaults. | SET-032 |
| KI-SET-03 | Low | **Cross-tab staleness** — a preference change in one tab isn't reflected in an already-open second tab until reload (no `storage` listener). | SET-009 |
| KI-SET-04 | Low | **System-theme auto-follow stops after first interaction** — OS-theme auto-switch is gated on the presence of the whole `themeConfig` key, which is written on any change. Logout also doesn't clear appearance prefs. | SET-010, SET-012, SET-031 |

---

### Cross-cutting observations
- **Permission model:** exactly three roles — `admin`, `data_entry`, `viewer`. Only `admin` has `manage_users`; `view_analytics` is held by `admin` and `viewer`. There are **no** `doctor`/`nurse` roles in the user system despite clinical assessment forms existing in the Patient module.
- **401 handling is inconsistent:** most of the app refresh-and-retries via `api/client.js`, but Analytics components use a raw axios client that does not (see KI-ANL-02).

> Total pre-flagged items: **6 High, 13 Medium, 9 Low** (estimates). Prioritise the **High** items — several are payload/auth issues that can block core workflows (dispensing, goods-receipt, provider stock) or expose endpoints.
