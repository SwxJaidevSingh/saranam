# OPD Module — Complete Plan
**Branch:** `feature/OPD`
**Date:** 2026-03-19
**Status:** Planning Complete → Ready to Build

---

## Overview

The OPD module is a **completely standalone clinical workflow module** built separately from the existing Services/Appointments system. It covers the full patient journey from appointment booking to OPD completion.

### Why Standalone?
The existing **Services module** is a generic booking engine — it stops at "Appointment Confirmed". It has no clinical workflow (no vitals, no doctor screen, no prescription).
The **OPD module** is a full clinical journey aligned with the Figma flow.
IPD already has its own dedicated module — OPD follows the same pattern.

### What We Reuse (No Rebuilding)
- `Patient` table — search existing patients or register new
- `Encounter` model — OPD visits stored here (`encounter_type = 'OPD'`)
- `Observation` model — vitals (model exists, routes being added)
- `Diagnosis` model — diagnoses (model exists, routes being added)
- `HealthcareProvider` — doctors/providers
- `Medicine` (inventory) — for prescription medicine search

---

## Figma Flow Reference

```
Patients → Basics Details → Service (hub)
                                   ↓
                           OPD/OP Journey
                                   ↓
                  Consultation / Appointment Schedule
                                   ↓
                           Select Providers
                                   ↓
                         Select Time and Date
                                   ↓
                        Appointment Scheduled
                                   ↓
                  Send Reminder (24hr & 2hr before)
                                   ↓
                        Patient Arrived?
                       YES ↙         ↘ NO
              Check In (In Progress)   Mark No-Show
                       ↓
              Nurse Records Vitals Form
                       ↓
         Doctors/Providers Clinical Assessments
                  ↓              ↓
         Store Diagnosis      LAB Test Required?
            in DB                    ↓
                       Patient does Lab → Store Results → Back
                                   ↓
            Treatment Plan / Prescription (Mark Complete)
                                   ↓
                  Store Medicine From Prescription in DB
                                   ↓
                       Follow-up Needed?
                      YES ↙         ↘ NO
          Schedule Follow-Up    Mark OPD Completed
                                   ↓
             Check for Moving to Other Services
                  (IPD / Home Care / Physio)
```

---

## Frontend Structure

### Sidebar
```
OPD  ▶
  ├── Dashboard          /opd
  ├── Appointments       /opd/appointments
  ├── Today's Queue      /opd/queue
  └── All Visits         /opd/visits
```

### Pages

#### 1. OPD Dashboard — `/opd`
- Stats cards: Today's Total, Checked In, In Consultation, Completed
- Quick actions: Book Appointment, View Queue
- Recent visits table

#### 2. OPD Appointments — `/opd/appointments`
- List all OPD appointments (past + upcoming)
- **Book New OPD Appointment:**
  - Search/select existing patient (or link to register new patient)
  - Select Provider (doctor) — required, but can be changed later
  - Select Date + Available Time Slot
  - Enter Chief Complaint
  - Creates `Encounter` with `encounter_type = 'OPD'`, `status = 'scheduled'`
- Appointments booked ONLY from this section (not from generic Services/Appointments)

#### 3. Today's Queue — `/opd/queue`
- Shows ALL today's OPD appointments
- Status-based view:
  `Scheduled → Checked In → Vitals Done → In Consultation → Completed`
- Click any patient row → opens OPD Visit Detail

#### 4. OPD Visit Detail — `/opd/visits/:id`
Single progressive screen — stages unlock sequentially:

```
┌─────────────────────────────────────────────────────────┐
│  Patient Info Bar (always visible)                      │
│  Name · Age · Gender · MRN · Assigned Doctor            │
│  Status Badge  +  Progress Steps (1→2→3→4)             │
├─────────────────────────────────────────────────────────┤
│  STAGE 1 — Check In                                     │
│  [Check In Patient]      [Mark No-Show]                 │
├─────────────────────────────────────────────────────────┤
│  STAGE 2 — Vitals  (unlocks after check-in)             │
│  BP Systolic / Diastolic     Temperature (°C)           │
│  SpO2 (%)                    Heart Rate (bpm)           │
│  Weight (kg)                 Height (cm)                │
│  Pain Scale (0–10)           BMI (auto-calculated)      │
│  Notes                                                  │
│  [Save Vitals]                                          │
├─────────────────────────────────────────────────────────┤
│  STAGE 3 — Consultation  (unlocks after vitals)         │
│  Tabs:                                                  │
│  [Assessment] [Diagnosis] [Prescription] [Lab Orders]   │
│                                                         │
│  Assessment Tab:                                        │
│    Subjective (patient complaints, history)             │
│    Objective (physical exam findings)                   │
│    Clinical Notes                                       │
│                                                         │
│  Diagnosis Tab:                                         │
│    Search ICD-10 code / free text                       │
│    Diagnosis type (primary/secondary/differential)      │
│    Severity (mild/moderate/severe)                      │
│    Add multiple diagnoses                               │
│                                                         │
│  Prescription Tab:                                      │
│    Search medicines from inventory                      │
│    Dosage · Frequency · Duration · Instructions         │
│    Add multiple medicines                               │
│    (Dispensing triggered when pharmacist confirms)      │
│                                                         │
│  Lab Orders Tab:                                        │
│    Test name · Urgency · Notes                          │
│    Add multiple tests                                   │
│    (Saved as form record — full lab integration later)  │
│                                                         │
│  [Save Consultation]                                    │
├─────────────────────────────────────────────────────────┤
│  STAGE 4 — Complete OPD  (unlocks after consultation)  │
│  Follow-up needed?  YES → book follow-up appointment    │
│  Refer to other service? (IPD / Home Care / Physio)     │
│  Final notes                                            │
│  [Mark OPD Complete]                                    │
└─────────────────────────────────────────────────────────┘
```

#### 5. All Visits — `/opd/visits`
- Full history of all OPD visits
- Filters: date range, doctor, status, patient search
- Click to view detail (read-only for completed visits)

---

## Backend Structure

### New Module: `backend/app/opd/`
```
backend/app/opd/
├── __init__.py
├── models.py       ← Prescription, PrescriptionItem, LabOrder
├── routes.py       ← All OPD API endpoints
└── services.py     ← Business logic
```

### New Models

#### Prescription
```
id, encounter_id, patient_id, prescribed_by (provider),
status (draft/finalized/dispensed),
notes, created_at, updated_at
```

#### PrescriptionItem
```
id, prescription_id, medicine_id, medicine_name,
dosage, frequency, duration, duration_unit,
instructions, quantity, created_at
```

#### LabOrder
```
id, encounter_id, patient_id, ordered_by (provider),
status (ordered/in_progress/completed),
notes, created_at, updated_at
```

#### LabOrderItem
```
id, lab_order_id, test_name, urgency (routine/urgent/stat),
notes, result (text, filled later), result_at, created_at
```

### New API Endpoints
```
GET  /api/opd/queue                       → today's OPD queue (by status)
GET  /api/opd/stats                       → dashboard stats

GET  /api/opd/visits                      → all OPD visits (paginated, filtered)
POST /api/opd/visits                      → create new OPD visit (book appointment)
GET  /api/opd/visits/:id                  → get full visit detail
PATCH /api/opd/visits/:id                 → update visit (change provider etc.)

POST /api/opd/visits/:id/check-in         → check in patient
POST /api/opd/visits/:id/no-show          → mark as no-show

POST /api/opd/visits/:id/vitals           → save vitals (creates Observations)
GET  /api/opd/visits/:id/vitals           → get vitals for visit

POST /api/opd/visits/:id/diagnoses        → save diagnoses
GET  /api/opd/visits/:id/diagnoses        → get diagnoses

POST /api/opd/visits/:id/prescriptions    → create prescription + items
GET  /api/opd/visits/:id/prescriptions    → get prescriptions
PATCH /api/opd/visits/:id/prescriptions/:pid → update prescription

POST /api/opd/visits/:id/lab-orders       → create lab order + items
GET  /api/opd/visits/:id/lab-orders       → get lab orders

POST /api/opd/visits/:id/complete         → complete OPD visit
                                              (follow_up_required, follow_up_date,
                                               referral_service, final_notes)
```

### Existing Routes to Register (Models already exist, routes missing)
- `backend/app/observations/routes.py` → register in `__init__.py`
- `backend/app/diagnoses/routes.py` → register in `__init__.py`

---

## OPD Visit Status State Machine
```
scheduled
    ↓  (check-in)
checked_in
    ↓  (vitals saved)
vitals_recorded
    ↓  (consultation saved)
in_consultation
    ↓  (mark complete)
completed

(from any state before completion)
    → no_show
    → cancelled
```

---

## Build Sprints

### Sprint 1 — Backend Foundation
- [ ] Create `backend/app/opd/` module
- [ ] New models: `Prescription`, `PrescriptionItem`, `LabOrder`, `LabOrderItem`
- [ ] All OPD routes + services
- [ ] Register `observations` routes
- [ ] Register `diagnoses` routes
- [ ] Register OPD blueprint in `app/__init__.py`
- [ ] DB migration

### Sprint 2 — Frontend Core
- [ ] Add OPD to sidebar navigation (with sub-items)
- [ ] OPD Dashboard page
- [ ] OPD Appointments page (list + book new)
- [ ] Today's Queue page
- [ ] Frontend API client `src/api/opd.js`

### Sprint 3 — OPD Visit Detail Screen
- [ ] Patient info bar + progress steps component
- [ ] Stage 1: Check In
- [ ] Stage 2: Vitals form
- [ ] Stage 3: Consultation tabs (Assessment, Diagnosis, Prescription, Lab Orders)
- [ ] Stage 4: Complete OPD form
- [ ] Auto-save draft on each stage

### Sprint 4 — Polish & Integration
- [ ] All Visits page with filters
- [ ] Follow-up appointment booking from OPD completion
- [ ] Cross-service referral (IPD / Home Care / Physio)
- [ ] OPD visit history on Patient Detail page

---

## Decisions Made

| Decision | Choice | Reason |
|---|---|---|
| Module type | Standalone | Clean separation from generic Services |
| Patient data | Reuse existing Patient table | No duplication |
| Appointment storage | Reuse Encounter model | Same table, OPD encounter_type |
| Booking location | Only from OPD module | Controlled workflow |
| Provider assignment | Required at booking, changeable later | Flexibility |
| Queue system | No token numbers | Only booked patients, status-based |
| Prescription → Stock | Pharmacist confirms dispensing | Not auto-deduct |
| Lab Orders | Simple form only for now | Full integration later |

---

## Things to Build Later (Future Sprints)

### Phase 2 — Lab Integration
- Full lab management module
- Lab technician screen to enter results
- Results flow back to OPD visit and patient record
- Abnormal flag alerts
- Lab report PDF generation

### Phase 3 — Prescription → Inventory Bridge
- When doctor finalizes prescription → auto-create pending Dispensing record
- Pharmacist sees pending dispensing in Inventory → Dispensing module
- On pharmacist confirmation → stock deducted
- Full audit trail: prescribed → dispensed → patient received

### Phase 4 — Reminder System
- Actual SMS/email sending for appointment reminders
- Celery/cron job to process `AppointmentReminder` records
- 24hr and 2hr before appointment

### Phase 5 — OPD Analytics
- OPD-specific analytics dashboard
- Doctor-wise patient load
- Common diagnoses trends
- Average consultation time
- No-show rate tracking

### Phase 6 — Walk-in Patients
- Register walk-in patient directly at OPD (no prior appointment)
- Token number / queue number system for walk-ins

### Phase 7 — ABHA / ABDM Integration
- Link OPD records to ABHA ID
- Share health records via ABDM
- Digital prescription with ABDM compliance
