# Hospital Portal (Phase 3 · Wave 1)

A standalone React frontend that hospital staff use to log in, enter patients,
and capture structured referral origin. It talks to the existing Flask
`/api/portal/*` API (Phase 2). This app is **separate** from the main
`frontend/` app and runs side by side with it.

## Stack

Vite + React 19 + react-router-dom 7 + axios + TailwindCSS + lucide-react +
react-hook-form + react-toastify. Dependency versions mirror the main
`frontend/package.json`. The package is intentionally lean — no ag-grid, MUI,
leaflet, xlsx, dnd-kit, etc.

## Configure

`.env` (already present):

```
VITE_API_URL=http://localhost:5002/api
```

Point `VITE_API_URL` at the running Flask API (include the `/api` suffix). In
dev, requests to `/api` are also proxied to `http://localhost:5002` by Vite.

## Run

```bash
npm install      # required first — dependencies are NOT installed in this repo
npm run dev      # starts Vite on http://localhost:5174
```

The main frontend uses port **5173**; this portal uses **5174**, so both can run
at the same time. Other scripts: `npm run build`, `npm run preview`, `npm run lint`.

> **UNVERIFIED:** these files were hand-authored without running
> `npm install` / `npm run build` / `npm run dev` (no network in the build
> environment). Treat the app as unverified until you install dependencies and
> run it. Plain `.js` files were syntax-checked with `node --check`; `.jsx`
> files were not (JSX needs the build toolchain).

## Auth + organization context (the core portal logic)

- **Login** uses the shared `POST /auth/login` endpoint. Tokens + user are
  stored in `localStorage` under `access_token` / `refresh_token` / `user` —
  identical to the main frontend. (`src/api/auth.js`, `src/context/AuthContext.jsx`)
- After auth, `GET /portal/orgs/me` loads the user's memberships and the
  `is_platform_admin` flag. (`src/api/orgs.js`, `src/context/OrgContext.jsx`)
- **Org switcher** (`src/components/OrgSwitcher.jsx`): one membership →
  auto-selected; multiple → the user picks; platform admins may pick an org or
  **All organizations (god view)**. The choice is persisted as `active_org_id`
  in `localStorage`.
- **`X-Org-Id` header:** the shared axios instance (`src/api/client.js`) attaches
  `Authorization: Bearer <token>` to every request and `X-Org-Id: <active_org_id>`
  to every `/api/portal/*` request when a concrete org is selected. For a
  platform admin in god view, **no** `X-Org-Id` is sent (unscoped reads).
- **401** → one refresh attempt, else clear tokens + redirect to `/login`.
  **403** → surfaced as "no access to this organization".

## Screens

**Wave 1 — fully wired**

- **Login** — `/login`
- **App shell** — protected routes, header with org switcher + active-org
  branding (display_name / logo_url / accent_color applied as the
  `--accent-color` CSS variable; fallback brand "Hospital Portal"), side nav.
- **Patients list** — `GET /portal/patients` with debounced search (`q`) +
  pagination.
- **Add patient (intake)** — `POST /portal/patients`: demographic fields +
  REQUIRED structured origin (origin_type dropdown; `hospital` → referring
  hospital code + optional referrer org, else free-text source name; referral
  date; notes).
- **Patient detail + edit** — `GET /portal/patients/:id`, `PUT /portal/patients/:id`
  (demographics + nested origin). The dedicated `PUT /portal/patients/:id/origin`
  endpoint is also wired in `src/api/patients.js`.

**Wave 2 — placeholders only (no backend yet)**

- Dashboard / Analytics, Org Users & Invites, Org Settings (shows current
  branding read-only), Referral Feedback. All clean "Coming soon — pending
  backend" pages, not wired to any endpoint.

## Project structure

```
src/
  api/        client (axios + X-Org-Id), auth, orgs, patients, storage
  context/    AuthContext, OrgContext
  components/ Layout, Sidebar, OrgSwitcher, ProtectedRoute, forms/, ui/
  pages/      Login, PatientsList, AddPatient, PatientDetail, Placeholder, NotFound
  constants/  origin types, genders, blood groups
  utils/      format, patientPayload, apiError
```
