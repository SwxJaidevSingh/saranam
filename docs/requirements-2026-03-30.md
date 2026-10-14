# Saranam Home Care - Client Meeting Requirements
**Date:** 30 March 2026
**Attendees:** Anish, Dr. Ashwini, Dr. Anvita, Dr. Amrita, Dr. Ram, Arnav, Farzan, Ayush

---

## 1. Patient Registration

### 1.1 Date of Birth Flexibility
- Patients may not know their exact date of birth
- Allow entering an **approximate age** (e.g., "50" or "45")
- System should auto-calculate DOB as **1st January of (current year - age)** (same logic as OBLS)

### 1.2 Patient Category (New Field)
- Replace or extend the existing category system with **4 categories**:
  1. **BSC-Onco** (Best Supportive Care - Oncology)
  2. **Non-BSC-Onco** (Non-Best Supportive Care - Oncology)
  3. **BSC-Non-Onco** (Best Supportive Care - Non-Oncology)
  4. **Non-BSC-Non-Onco** (Non-Best Supportive Care - Non-Oncology)

### 1.3 Referred From (New Field)
- Add a **"Referred From"** field during registration
- Options should include:
  - KC General Hospital
  - Kidwai Memorial Institute of Oncology
  - Doctor outside (external referral)
- Allow the team to add/manage referral sources from UI

### 1.4 Diagnosis (New Mandatory Field)
- Add **diagnosis** as a mandatory field during patient registration
- Implement as a **dropdown** (not free text) for data standardization
- Dropdown values:
  - Breast cancer
  - Oral cancer
  - Cervical cancer
  - Lung cancer
  - Colorectal cancers
  - Stomach cancer
  - GEJ carcinoma
  - ALL (Acute Lymphoblastic Leukemia)
  - Neuroblastoma
  - Ewings sarcoma
  - Renal Cell Carcinoma
  - Prostate cancer
  - Melanoma
  - Liver cancer
  - Gallbladder cancer
  - Bladder cancer
  - Penile cancer
  - Pancreatic cancer
- Allow an **"Other"** option with free-text entry
- The team should be able to **add new diagnoses** to the dropdown list over time

### 1.5 Location & Geocoding Enhancements
- Implement **geocoding search**: typing "Kidwai Hospital" should navigate the map directly to that location (instead of manually panning)
- Address labels (Address Line 1, Line 2) can be renamed to more intuitive labels (e.g., "Landmark") per team preference
- All patient location data should be editable after registration

### 1.6 Patient Priority
- Priority may **not be known at registration** - only after the first visit/assessment
- Allow the field to remain **blank** initially
- Priority gets populated after first visit based on PPS and clinical assessment scores

---

## 2. Location & Map Features

### 2.1 Kidwai as Base Location
- Set **Kidwai Memorial Institute of Oncology** as the base/home location on the map
- Show a configurable **radius** from Kidwai (e.g., 15 km)

### 2.2 Distance Display
- When registering a patient, show the **distance from Kidwai** to the patient's location
- Example: "This patient is approximately 6 km from Kidwai"
- Indicate whether the patient is **within or outside** the configured service radius

### 2.3 Map in Scheduling
- Show a **map interface** during scheduling that displays:
  - All patients scheduled for a day plotted on the map
  - Distance between each patient (patient-to-patient)
  - **Zone overlap** visualization
  - Proximity clustering (patients within 3-5-7 km of each other)
- This helps schedulers assess route feasibility and cluster efficiency

---

## 3. Scheduling System

### 3.1 Multiple Vehicles per Day
- Allow **2 or more vehicles** to be scheduled on the **same day**
- Currently only one vehicle can be assigned; this needs to support concurrent vehicle assignments
- Each vehicle should have its own patient allocation and route

### 3.2 First-Visit Patient Prioritization
- **Newly registered patients** (who have not had their initial assessment) must be **prioritized** in scheduling
- Minimize the gap between record creation and the first visit
- Rationale: delays in first visit have led to patients passing away without receiving care - this is considered a denial of service

### 3.3 Scheduling Algorithm Variables
- **Scenario 1** (New patient, pre-first-visit): Use 2 variables
  - Geographic location / clustering
  - Patient category (the 4 BSC/Onco categories)
- **Scenario 2** (After first visit): Use 3 variables
  - Geographic location / clustering
  - Patient category
  - Clinical complexity (High / Medium / Low priority from PPS scores)

### 3.4 Time Capture for Visits
- Allow the scheduler to assign **time slots** to each patient in the schedule
- Example: Patient A from 9:00-10:00, Patient B from 10:00-11:00
- This enables:
  - Informing patients of approximate arrival time
  - Better route planning
  - Time-based notifications to patients

### 3.5 Deviation Report
- Track **deviations** between the planned schedule and actual visits
- Deviations include:
  - Emergency patients added mid-route
  - Scheduled patients not home / not seen
  - Order changes
- Generate an **exception/deviation report** weekly or monthly
- Report should capture: what the deviation was and why it occurred
- This data will provide insights for better future planning

---

## 4. Team Assignment

### 4.1 Updated Team Roles
The multidisciplinary team should include these role categories:
1. **Physician**
2. **Nurse**
3. **Counsellor**
4. **Physiotherapist**
5. **Social Worker**
6. **Driver**

### 4.2 Role-Based Filtering
- When assigning team members, **filter by role/specialization**
- Example: when selecting a physiotherapist, only show physiotherapists in the dropdown

### 4.3 Flexible Team Composition
- Not all roles are mandatory for every visit
- Allow assigning **multiple members of the same role** (e.g., 2 nurses)
- Team can vary day by day within the same weekly schedule

---

## 5. Prescription & Medication

### 5.1 Half / Full Tablet Dosage
- Add ability to specify **half tablet vs full tablet**
- Dosage can **vary throughout the day** (e.g., half in morning, half in afternoon, full at night)

### 5.2 Instructions Dropdown
- Change the instructions field from free text to a **dropdown**
- Include options like: Before food, After food, With food, Empty stomach, etc.

### 5.3 Type of Medicine
- Add a field for medicine type:
  - **Immediate Release**
  - **Sustained Release**

### 5.4 Medicine Form (Dosage Form)
- Add a dropdown for dosage form:
  - Tablet
  - Syrup
  - Capsule
  - Injection
  - (other forms as needed)

### 5.5 Frequency Enhancement
- Current: Once daily, TDS (three times daily), etc.
- Add: **SOS** (as-needed/emergency dose) as a secondary frequency
- Example: Paracetamol TDS + SOS (meaning 3 times daily, and one extra if needed)

### 5.6 Warning Signs
- Add a **warning signs / instructions** field to prescriptions
- Example: "If patient is too drowsy, stop this medicine"
- Implementation approach TBD - Anish wants to discuss with Dr. Ashwini and Dr. Anvita regarding liability implications before finalizing
- Could be a column in the prescription table or a separate section

### 5.7 Prescription PDF Enhancements
- Add **doctor's name, designation, and NCA registration number** in the signature area
- Add **diagnosis** to the prescription PDF
- Add **distance** information to the prescription PDF (for approval purposes)

---

## 6. Schedule PDF Enhancements

### 6.1 Additional Data in PDF
- Add **diagnosis** for each patient in the schedule PDF (so the visiting team knows what condition they are dealing with)
- Add **distance** between patients (patient-to-patient) in the PDF
- This is for the team going on visits AND for the approval workflow

---

## 7. Clinical Assessment

### 7.1 Procedures (New Section)
- Add a **Procedures** section to the patient assessment forms
- Both for initial assessment and follow-up visits
- Dr. Ashwini will share a predetermined list of:
  - Nursing procedures
  - Physiotherapy procedures
  - Counseling procedures

### 7.2 Body Map Simplification
- Replace the current body map with a **simple front and back outline**
- No need for detailed body divisions - just a basic body outline for marking pain/issue areas

---

## 8. Analytics & Tracking

### 8.1 Vitals Tracking
- Track vitals analytically across visits
- Enable trend visualization for vitals over time

### 8.2 Across Forms
- Ensure analytics can pull and correlate data **across all form types** (initial assessment, follow-up, prescriptions, vitals, etc.)

---

## 9. Workflow & Notifications

### 9.1 Approval Workflow
- Maker-Checker pattern: one user creates the schedule, a different user (lead physician) approves
- Different roles/permissions for schedule creator vs approver
- If the approver (lead physician) is on leave, another authorized person can approve

### 9.2 Notifications on Approval
- Once a schedule is approved, all team members assigned for the week should receive a **notification (email)** with their schedule details
- Each team member should know which days they are assigned

### 9.3 Patient Notifications (Future)
- SMS notifications to patients about upcoming visits (deferred due to SMS costs)
- For now, the scheduler will manually call patients after schedule finalization
- Message format: "The Saranam home care team will be at your residence approximately between [time range]"

---

## 10. Recurring Meetings
- **Weekly standup** scheduled for every **Thursday** starting next week
- Attendees: Saranam team (Anish, Dr. Ashwini, Dr. Anvita, Dr. Amrita, Dr. Ram) + Dev team (Arnav, Farzan, Ayush)

---

## Priority Matrix

| Priority | Requirement | Rationale |
|----------|------------|-----------|
| **High** | First-visit patient prioritization (#3.2) | Patient safety - delays can be fatal |
| **High** | Diagnosis field - mandatory dropdown (#1.4) | Needed for scheduling, PDF, and team preparation |
| **High** | Patient category - 4 types (#1.2) | Core to scheduling algorithm |
| **High** | Multiple vehicles per day (#3.1) | Operational necessity - 2 vehicles going out same day |
| **High** | Map & distance in scheduling (#2.3) | Core scheduling intelligence |
| **Medium** | Referred From field (#1.3) | Registration completeness |
| **Medium** | Prescription enhancements (#5.1-5.6) | Clinical accuracy |
| **Medium** | Schedule PDF - diagnosis & distance (#6.1) | Team preparedness |
| **Medium** | Team role filtering (#4.2) | UX improvement |
| **Medium** | Procedures section (#7.1) | Clinical documentation |
| **Medium** | Deviation report (#3.5) | Operational insights |
| **Medium** | Time capture in scheduling (#3.4) | Route planning |
| **Low** | Geocoding search (#1.5) | UX improvement |
| **Low** | Body map simplification (#7.2) | UX improvement |
| **Low** | Warning signs in prescription (#5.6) | Pending team discussion |
| **Low** | Analytics across forms (#8.2) | Reporting enhancement |
| **Future** | SMS notifications to patients (#9.3) | Requires third-party integration & cost |
