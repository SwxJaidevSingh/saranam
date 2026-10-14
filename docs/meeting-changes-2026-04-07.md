# Client Meeting - Changes & Action Items

**Date:** 7th April 2026
**Participants:**
- **Speaker 1 (Client - Dr. Anvita/Dr. Anuradha):** Palliative care doctor, primary decision maker
- **Speaker 2 (Saranam Team Lead):** Project lead
- **Speaker 3 (Farzan):** Developer, presented the demo

**Meeting Duration:** ~47 minutes
**Next Meeting:** Thursday/Friday next week (10th/11th April 2026) at 6:00 PM

---

## 1. Patient Registration & UHID

### 1.1 UHID Format Change
**Requested by:** Client | **Timestamp:** `0:00 - 0:36`

Current UHID system to be replaced with a structured format:
> **State + District + Hospital Linked To + Year of Registration + Zone Code + Patient Sequence**

- Hospital options: Kidwai, KC General, or Swon
- Year example: `26` for 2026
- Zone codes: Each zone has its own code (e.g., South = 1). Client will share zone code list on the group.
- Patient sequence: `0001`, `0002`, etc.
- Client will share a sample of their current UHID format for reference.

### 1.2 Additional Phone Numbers & Caregiver Info
**Requested by:** Client | **Timestamp:** `0:55 - 1:41`

- Collect **two phone numbers** from the patient (backup in case first is unreachable).
- For each phone number, capture **relationship to patient** (who the phone belongs to).
- Label: **Primary Caregiver** of the patient.
- Team lead to share the exact field label and name.

### 1.3 Remove Clinical Complexity
**Requested by:** Client | **Timestamp:** `26:45 - 27:04`

- Remove the **Clinical Complexity** field entirely.
- Only keep **Patient Priority**, renamed to **PPS** (Palliative Performance Scale).

### 1.4 Rename "Patient Priority" / "Patient Category" to PPS
**Requested by:** Client | **Timestamp:** `27:04 - 27:06`

- All references to "Patient Priority" or "Patient Category" should be renamed to **PPS**.
- PPS is the most important metric for scheduling, patient identification, and prioritization.

---

## 2. Scheduling & Route Planning

### 2.1 Distance from Linked Hospital (Not Universal Kidwai)
**Requested by:** Client | **Timestamp:** `3:55 - 4:33`

- Distance should be calculated from the **hospital the patient is linked to** (from UHID), not just Kidwai for everyone.
- Example: If patient is from KC General, show distance from KC General.
- Add **hospital markers on the map** (Kidwai, KC General, etc.).

### 2.2 Priority-Based Scheduling Order
**Requested by:** Client | **Timestamp:** `5:37 - 6:03`

Scheduling priority order:
1. **First priority:** New patients (never visited)
2. **Second priority:** High PPS priority patients
3. Then medium, then low

- BSc/non-BSc, Onco/non-Onco categorization is **NOT important** for scheduling.

### 2.3 No Patient Left Behind - Time Factor
**Requested by:** Client | **Timestamp:** `7:50 - 8:28`

- Ensure **medium and low priority patients are NOT missed** as high priority cases grow.
- Incorporate a **time factor**: how long since the patient was last visited.
- Patients not visited for too long should automatically escalate in priority.

### 2.4 One Visit Per Month Compulsory
**Requested by:** Client | **Timestamp:** `8:23 - 8:28`

- Every patient must have **at least one visit per month**, regardless of priority.

### 2.5 Different View Per Vehicle
**Requested by:** Client | **Timestamp:** `13:00 - 14:15`

- Instead of one combined list with different colors, provide **separate list/view for each vehicle**.
- This is needed because one person plans the schedule, then distributes to different drivers.

### 2.6 Download Route Map for Phone Navigation
**Requested by:** Client | **Timestamp:** `14:16 - 14:47`

- Provide ability to **download the route map** so drivers can use it on their phones for navigation.
- Team committed to providing geocoordinate-based links that open in phone maps.

### 2.7 Zone-Based Suggestions (Priority + Distance)
**Requested by:** Client | **Timestamp:** `14:49 - 15:24`

- When a patient from a specific zone is added first, suggestions should prioritize patients from the **same zone/nearby areas**.
- Suggestions should be based on **priority AND distance** from the initial patient.
- Team committed to implementing this.

### 2.8 Missed Patients Get Priority Next Time
**Requested by:** Client | **Timestamp:** `20:54 - 21:30`

- If a patient is missed during a visit, they should appear as **priority in the next schedule** for that area.
- System already marks missed patients as **overdue** - confirmed working.

---

## 3. Reports & PDF

### 3.1 Remove Specialization from Schedule PDF
**Requested by:** Client | **Timestamp:** `17:11 - 17:19`

- Remove the **specialization part** (physician, nurse, counselor labels) from the weekly schedule PDF.

### 3.2 Show Distance Between Patients in PDF Report
**Requested by:** Client | **Timestamp:** `17:19 - 19:29`

- In the **downloaded weekly schedule report**, show:
  - Distance between **consecutive patients** in the route.
  - Distance from **linked hospital** to each patient.
- Currently only showing distance from Kidwai hospital, not between patients.

---

## 4. Assessment & Body Chart

### 4.1 Body Chart Overhaul
**Requested by:** Client | **Timestamp:** `22:46 - 23:59`

- Replace current body chart with a **blank body chart**.
- Users should be able to **mark/annotate** directly on the chart.
- Annotations should describe: type of pain, type of wound, etc.
- Client will send a **sample image** of how they fill it currently.

---

## 5. Prescription

### 5.1 ICD Diagnosis (Standardized Nomenclature)
**Discussed at:** `24:20 - 25:36` | **Team Suggestion - Client Accepted**

- Use **ICD standardized nomenclature** for diagnosis in prescriptions.
- Not the raw ICD code, but the standardized name - acts as autocomplete/suggestion.
- Diagnosis entered at registration should **auto-populate** into visit prescriptions (editable).
- Most diagnoses are constant across visits, shouldn't need re-entry.

### 5.2 Time-Based Medication Scheduling
**Requested by:** Client | **Timestamp:** `28:24 - 29:09`

- Medicines are based on **specific times**, not just "morning/afternoon/night".
- Required time slots: **6:00 AM, 10:00 AM, 2:00 PM, 6:00 PM, 10:00 PM**
- This should appear after selecting frequency.

### 5.3 Night Dose Double (2x)
**Requested by:** Client | **Timestamp:** `29:14 - 29:32`

- The **10 PM (night) dose** is always **double** the morning dose.
- Allow entering **2 tablets** (or 2x) for the night slot instead of the standard 1.

### 5.4 Doctor's Signature Upload on Prescription PDF
**Requested by:** Client | **Timestamp:** `30:16 - 30:57`

- When downloading the prescription PDF, include the **doctor's signature**.
- Implement an **upload feature** for doctor's signature image.
- Patient can use the signed prescription to get medicines externally.

### 5.5 Doctor Details Pop-up
**Requested by:** Client | **Timestamp:** `30:57 - 31:28`

- Add a **pop-up/modal** to capture which doctor is prescribing.
- Required fields:
  - **Doctor's Name**
  - **Qualification**
  - **Designation**
  - **KMC Registration Number** (unique license number per doctor)

---

## 6. Analytics / Dashboard

### 6.1 Remove Improvement Metrics
**Requested by:** Client | **Timestamp:** `34:46 - 35:04`

- **Remove "improvement" baseline/metrics** from the dashboard.
- Palliative care goal is **comfort care**, not improvement - all patients will eventually die.

### 6.2 Remove "Top 10 Most Improved Patients"
**Requested by:** Client | **Timestamp:** `36:22 - 36:29`

- Remove this section entirely.

### 6.3 Add "Number of Deaths Last Month"
**Requested by:** Client | **Timestamp:** `36:30 - 36:35`

- Replace improvement metrics with **number of deaths in the last month**.

### 6.4 Add "Number of Visits Before Death"
**Requested by:** Client | **Timestamp:** `36:39 - 36:53`

- Track and display: **number of visits the patient had from the team before they died**.
- This is a key impact metric for palliative care.

### 6.5 Impact Metrics - Pain, PPS, ESAS (Not Vitals)
**Discussed at:** `35:52 - 36:18` | **Both Sides**

- Good impact indicators: **Pain, PPS scores, ESAS scores**.
- **Pulse rate, BP** are NOT important for palliative care metrics.
- Client is still deciding on their full impact metrics list and will share when ready.
- Current analytics serve as a **starting point** for the client to think about what they need.

---

## 7. Data Migration

### 7.1 Import Existing Patient Data
**Discussed at:** `37:19 - 38:06`

- Client has existing data in **Google Sheets**.
- Client will share the data by **Wednesday, 9th April 2026**.
- Team to process and import data after next meeting.
- Team offered to provide a data format template or process the raw data directly.

---

## 8. Team Commitments & Internal Notes

| Item | Timestamp | Note |
|------|-----------|------|
| Deviation reports for missed/delayed/emergency patients | `20:11 - 20:50` | Already built - shown to client |
| Pain scale already in vital trends | `32:22 - 33:16` | Client confirmed it's adequate |
| PPS trend tracking already working | `33:18 - 33:52` | Client said "most important one for us" |
| Zone-based clustering with pin codes | `12:15 - 12:42` | Built as reference circles, actual zones by pin code |
| Thorough testing needed before go-live | `44:55 - 45:12` | Internal: many fixes done, flow breakdowns exist |
| Data migration after testing + changes | `45:14 - 45:20` | Sequence: changes -> testing -> data migration -> live |

---

## Summary - Change Categories

| Category | Count | Priority |
|----------|-------|----------|
| Patient Registration & UHID | 4 | High |
| Scheduling & Route Planning | 8 | High |
| Reports & PDF | 2 | Medium |
| Assessment & Body Chart | 1 | High (waiting on sample from client) |
| Prescription | 5 | High |
| Analytics / Dashboard | 5 | Medium |
| Data Migration | 1 | After all changes done |
| **Total** | **26** | |

---

## Pending from Client

1. Zone code list for UHID (to be shared on group chat)
2. Sample UHID format currently in use
3. Exact field label for caregiver/phone relationship field
4. Sample body chart image (how they currently fill it)
5. Impact metrics list (still being decided)
6. Patient data in Google Sheets (by Wednesday, 9th April)
