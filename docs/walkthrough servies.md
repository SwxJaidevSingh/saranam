# Healthcare Services Flow — Walkthrough

## What Was Built

### 1. [/services](file:///Users/farzanmanzer/CV%20Health/cv-raman-health/backend/app/services) — Redesigned Landing Page
- **File**: [ServiceLanding.jsx](file:///Users/farzanmanzer/CV%20Health/cv-raman-health/frontend/src/pages/services/ServiceLanding.jsx) (rewritten)
- Now uses standard `card` / `card-hover` Dashboard styles
- Shows **4 stat cards** (one per service type: IPD, OPD, Physio, Home Care) + active service counts from the API
- **Service Department cards** with features chips, colored left borders, and two action buttons: "Manage [Type]" + "Book"
- **Quick Actions** row: Book Appointment → All Doctors → My Bookings

![/services Landing Page](/Users/farzanmanzer/.gemini/antigravity/brain/886a2694-3164-4a6d-a5a9-e24422e21122/services_overview.png)

---

### 2. `/services/opd` (and IPD, Physiotherapy, Home-Care) — Per-Service Dashboards
- **File**: [ServiceDashboard.jsx](file:///Users/farzanmanzer/CV%20Health/cv-raman-health/frontend/src/pages/services/ServiceDashboard.jsx) (new)
- Handles all 4 service types via the same component using service config

**Features in each service dashboard:**
1. **Today's Stats Row** — Total, Scheduled, Completed, Cancelled for that encounter type
2. **Appointments Table** — Filtered by `encounter_type` (OPD → OPD only, IPD → IPD only)
   - Search by patient/doctor name
   - Status filter dropdown
   - "View" action → Appointments page
   - **"Fill Form" action → `/forms?patient_id=...&encounter_id=...`** (Doctor form flow linked to patient + encounter)
3. **Doctors Panel** — Lists active providers with "Schedule" and "View Profile" actions
4. **Feature Suggestions** — Service-specific recommended workflows

![/services/opd Dashboard](/Users/farzanmanzer/.gemini/antigravity/brain/886a2694-3164-4a6d-a5a9-e24422e21122/opd_dashboard.png)

---

### 3. Backend: `encounter_type` Filter Added
- **Files modified**: [backend/app/appointments/routes.py](file:///Users/farzanmanzer/CV%20Health/cv-raman-health/backend/app/appointments/routes.py) + [backend/app/appointments/services.py](file:///Users/farzanmanzer/CV%20Health/cv-raman-health/backend/app/appointments/services.py)
- New query param: `?encounter_type=OPD` / `?encounter_type=IPD` / `?encounter_type=Physiotherapy` / `?encounter_type=HomeCare`
- Also supports `?limit=N` as a direct param (in addition to existing `per_page`)

---

## Feature Suggestions per Service

| Service | Suggested Features |
|---|---|
| **IPD** | Bed/Ward tracking, Admission forms, Daily vitals, Discharge summary auto-generation |
| **OPD** | Prescriptions form, Follow-up scheduling, Referral slip, Chief complaint intake |
| **Physiotherapy** | Session counter (X of 10), SOAP notes per session, Exercise plan assignment, Discharge assessment |
| **Home Care** | Visit scheduling with address, Caregiver assignment, Visit log form, Equipment tracking |

---

## Routes Updated
| Route | Component |
|---|---|
| [/services](file:///Users/farzanmanzer/CV%20Health/cv-raman-health/backend/app/services) | [ServiceLanding.jsx](file:///Users/farzanmanzer/CV%20Health/cv-raman-health/frontend/src/pages/services/ServiceLanding.jsx) (redesigned) |
| `/services/ipd` | [ServiceDashboard.jsx](file:///Users/farzanmanzer/CV%20Health/cv-raman-health/frontend/src/pages/services/ServiceDashboard.jsx) |
| `/services/opd` | [ServiceDashboard.jsx](file:///Users/farzanmanzer/CV%20Health/cv-raman-health/frontend/src/pages/services/ServiceDashboard.jsx) |
| `/services/physiotherapy` | [ServiceDashboard.jsx](file:///Users/farzanmanzer/CV%20Health/cv-raman-health/frontend/src/pages/services/ServiceDashboard.jsx) |
| `/services/home-care` | [ServiceDashboard.jsx](file:///Users/farzanmanzer/CV%20Health/cv-raman-health/frontend/src/pages/services/ServiceDashboard.jsx) |
| `/services/book` | [NewServiceBookingWizard.jsx](file:///Users/farzanmanzer/CV%20Health/cv-raman-health/frontend/src/pages/services/new-booking/NewServiceBookingWizard.jsx) (unchanged) |
| `/services/my-bookings` | [MyServiceBookings.jsx](file:///Users/farzanmanzer/CV%20Health/cv-raman-health/frontend/src/pages/services/MyServiceBookings.jsx) (unchanged) |
