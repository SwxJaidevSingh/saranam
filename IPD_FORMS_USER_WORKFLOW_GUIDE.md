# IPD Forms - Complete User Workflow Guide

## Overview

This guide explains how dynamic forms are filled by users, stored in the database, and associated with patients and IPD admissions.

---

## 🔄 Complete Workflow

### Phase 1: Form Creation & Configuration (One-Time Setup)

#### Step 1A: Create IPD Form Template (Admin)

**Location**: IPD → Form Configuration → "Create New IPD Form"

**What Happens**:
1. Admin clicks "Create New IPD Form" button
2. Form Builder opens with URL: `/forms/new?template_category=ipd&is_template=true`
3. Admin builds form using drag & drop:
   - Add fields: Text, Number, Date, Select, Pain Scale, etc.
   - Organize into pages (multi-page forms)
   - Set required fields
   - Add validation rules

**Example Form - "Cardiology Admission Form"**:
```
Page 1: Patient History
- Chief Complaint (textarea, required)
- Cardiac History (checkbox list)
- Current Medications (textarea)

Page 2: Vital Signs
- Blood Pressure (text)
- Heart Rate (number)
- Temperature (number)

Page 3: Risk Assessment
- Pain Level (painScale 0-10)
- Fall Risk (linearScale 1-5)
```

4. Admin clicks "Create Form"
5. **Database**: Form saved in `forms` table:
   ```sql
   INSERT INTO forms (
     id: '123e4567-e89b-12d3-a456-426614174000',
     name: 'Cardiology Admission Form',
     description: 'Admission form for cardiology department',
     schema: { /* JSON with pages and fields */ },
     is_template: true,
     template_category: 'ipd',
     created_by: 'admin-user-id'
   )
   ```

#### Step 1B: Assign Form to Service (Admin)

**Location**: IPD → Form Configuration

**What Happens**:
1. Admin selects:
   - **Service**: "Cardiology Department"
   - **Form Type**: "ADMISSION"
   - **Form Template**: "Cardiology Admission Form"

2. Admin clicks "Add Configuration"

3. **Database**: Configuration saved in `form_configurations` table:
   ```sql
   INSERT INTO form_configurations (
     id: 'config-uuid-1',
     service_id: 'cardiology-service-uuid',
     form_type: 'ADMISSION',
     form_id: '123e4567-e89b-12d3-a456-426614174000',
     is_active: true,
     is_required: false
   )
   ```

**Result**: Now when someone admits a patient to Cardiology, this form will automatically appear!

---

### Phase 2: Patient Admission with Dynamic Form

#### Step 2A: Start Admission (Staff/Doctor)

**Location**: IPD → Admissions → "New Admission"

**What Happens**:

**Admission Wizard - Step 1: Select Patient**
```
User selects:
- Patient: "John Doe" (patient_id: 'patient-123')
```

**Admission Wizard - Step 2: Admission Details**
```
User selects:
- Service: "Cardiology Department" (service_id: 'cardiology-service-uuid')
- Admission Type: Elective
- Admitting Doctor: Dr. Smith
```

#### Step 2B: Dynamic Form Loads Automatically

**Behind the Scenes**:
1. Frontend detects service selection
2. API Call: `GET /api/form-configurations/for-service/cardiology-service-uuid?form_type=ADMISSION`
3. Backend finds configuration and returns form
4. FormRenderer component displays the form

**User Sees**:
```
┌─────────────────────────────────────────┐
│ Cardiology Admission Form               │
│ ─────────────────────────────────────── │
│                                         │
│ Page 1: Patient History                 │
│                                         │
│ Chief Complaint *                       │
│ [Chest pain for 3 days, worsening]     │
│                                         │
│ Cardiac History                         │
│ ☑ Previous MI                           │
│ ☐ Hypertension                          │
│ ☑ Family History of CAD                │
│                                         │
│ Current Medications                     │
│ [Aspirin 75mg, Atorvastatin 20mg]      │
│                                         │
│         [Back]  [Next Page →]          │
└─────────────────────────────────────────┘
```

#### Step 2C: User Fills Form (Multi-Page)

**Page 2: Vital Signs**
```
Blood Pressure: 140/90
Heart Rate: 85 bpm
Temperature: 98.6°F
```

**Page 3: Risk Assessment**
```
Pain Level: [●●●●●○○○○○] 5/10
Fall Risk: [○○●○○] 3/5
```

#### Step 2D: Complete Remaining Wizard Steps

**Step 3: Encounter Details**
- Chief Complaint (auto-filled if in form)
- Priority: Routine

**Step 4: Bed Assignment**
- Ward: Cardiology Ward
- Bed: Bed-201

**Step 5: Review & Submit**

---

### Phase 3: Data Storage & Association

#### Step 3A: Form Submission Processing

When user clicks "Submit Admission", the following happens:

**1. Frontend Collects Data**:
```javascript
const formData = {
  chief_complaint: "Chest pain for 3 days, worsening",
  cardiac_history: ["Previous MI", "Family History of CAD"],
  current_medications: "Aspirin 75mg, Atorvastatin 20mg",
  blood_pressure: "140/90",
  heart_rate: 85,
  temperature: 98.6,
  pain_level: 5,
  fall_risk: 3
};

const admissionData = {
  patient_id: "patient-123",
  service_id: "cardiology-service-uuid",
  admission_type: "elective",
  admitting_doctor_id: "doctor-smith-uuid",
  bed_id: "bed-201-uuid",
  admission_form_id: "123e4567-e89b-12d3-a456-426614174000", // The form ID
  form_data: formData // The actual form data
};
```

**2. API Call**:
```
POST /api/ipd/admissions
Body: admissionData
```

#### Step 3B: Backend Processing

**Backend (app/ipd/services.py - admit_patient)**:

```python
def admit_patient(...):
    # 1. Create or link encounter
    encounter = Encounter(
        patient_id=patient_id,
        service_id=service_id,
        admission_date=datetime.utcnow(),
        chief_complaint=chief_complaint
    )
    db.add(encounter)
    db.flush()  # Get encounter_id

    # 2. Create form submission (if form_data provided)
    if form_data and admission_form_id:
        form_submission = FormSubmission(
            id='form-sub-uuid-1',
            form_id=admission_form_id,  # Links to form template
            patient_id=patient_id,      # Links to patient
            data=form_data,             # JSONB - actual form data
            status='completed',
            submitted_at=datetime.utcnow()
        )
        db.add(form_submission)
        db.flush()  # Get form_submission_id

    # 3. Create IPD admission
    admission = IPDAdmission(
        encounter_id=encounter.id,
        patient_id=patient_id,
        admission_type='elective',
        admission_date=datetime.utcnow(),
        admitting_doctor_id=doctor_id,
        admission_form_submission_id=form_submission.id  # Links to form submission!
    )
    db.add(admission)

    # 4. Assign bed
    bed_assignment = BedAssignment(
        bed_id=bed_id,
        admission_id=admission.id,
        patient_id=patient_id,
        encounter_id=encounter.id
    )
    db.add(bed_assignment)

    db.commit()
    return admission, encounter
```

#### Step 3C: Database Tables After Admission

**`encounters` table**:
```sql
id: 'encounter-uuid-1'
patient_id: 'patient-123'           ← Links to patient
service_id: 'cardiology-service-uuid'
admission_date: '2026-03-13 10:30:00'
chief_complaint: 'Chest pain for 3 days'
status: 'in_progress'
```

**`form_submissions` table**:
```sql
id: 'form-sub-uuid-1'
form_id: '123e4567-e89b-12d3-a456-426614174000'  ← Links to form template
patient_id: 'patient-123'           ← Links to patient
data: {                             ← JSONB - actual form data
  "chief_complaint": "Chest pain for 3 days, worsening",
  "cardiac_history": ["Previous MI", "Family History of CAD"],
  "current_medications": "Aspirin 75mg, Atorvastatin 20mg",
  "blood_pressure": "140/90",
  "heart_rate": 85,
  "temperature": 98.6,
  "pain_level": 5,
  "fall_risk": 3
}
status: 'completed'
submitted_at: '2026-03-13 10:35:00'
```

**`ipd_admissions` table**:
```sql
id: 'admission-uuid-1'
encounter_id: 'encounter-uuid-1'    ← Links to encounter
patient_id: 'patient-123'           ← Links to patient
admission_type: 'elective'
admission_date: '2026-03-13 10:30:00'
admitting_doctor_id: 'doctor-smith-uuid'
admission_form_submission_id: 'form-sub-uuid-1'  ← Links to form submission!
admission_status: 'active'
```

**`bed_assignments` table**:
```sql
id: 'bed-assign-uuid-1'
bed_id: 'bed-201-uuid'
admission_id: 'admission-uuid-1'    ← Links to admission
patient_id: 'patient-123'           ← Links to patient
encounter_id: 'encounter-uuid-1'    ← Links to encounter
assigned_at: '2026-03-13 10:35:00'
assignment_status: 'active'
```

---

### Phase 4: Viewing Form Data

#### Option A: View in Admission Detail

**Location**: IPD → Admissions → Click admission → Overview Tab

**What Happens**:
1. API Call: `GET /api/ipd/admissions/admission-uuid-1`
2. Backend returns admission with `admission_form_submission_id`
3. If form submission exists, frontend can load it:
   - `GET /api/form-submissions/form-sub-uuid-1`
4. FormSubmissionViewer displays data in readable format

**User Sees**:
```
┌─────────────────────────────────────────┐
│ Admission Form Data                     │
│ ─────────────────────────────────────── │
│                                         │
│ Chief Complaint:                        │
│ "Chest pain for 3 days, worsening"     │
│                                         │
│ Cardiac History:                        │
│ • Previous MI                           │
│ • Family History of CAD                │
│                                         │
│ Current Medications:                    │
│ "Aspirin 75mg, Atorvastatin 20mg"      │
│                                         │
│ Vital Signs:                            │
│ Blood Pressure: 140/90                  │
│ Heart Rate: 85 bpm                      │
│ Temperature: 98.6°F                     │
│                                         │
│ Risk Assessment:                        │
│ Pain Level: 5/10                        │
│ Fall Risk: 3/5                          │
└─────────────────────────────────────────┘
```

---

## 🏥 Clinical Documentation During IPD Stay

### Adding Progress Notes

**Location**: IPD → Admissions → Click admission → "Progress Note" Tab

**What Happens**:

1. **Form Configuration Lookup**:
   - Frontend gets `service_id` from admission
   - API Call: `GET /api/form-configurations/for-service/{service_id}?form_type=PROGRESS_NOTE`
   - If configured, loads progress note form

2. **User Fills Progress Note (SOAP Format)**:
```
┌─────────────────────────────────────────┐
│ Daily Progress Note                     │
│ ─────────────────────────────────────── │
│                                         │
│ Subjective:                             │
│ [Patient reports decreased chest pain, │
│  pain now 3/10, no radiating pain]     │
│                                         │
│ Objective:                              │
│ [BP: 130/85, HR: 72, Temp: 98.4°F     │
│  Lungs clear, Heart regular rhythm]    │
│                                         │
│ Assessment:                             │
│ [Stable angina, improving on current   │
│  medical management]                    │
│                                         │
│ Plan:                                   │
│ [Continue current meds, monitor vitals,│
│  plan discharge in 2 days]             │
│                                         │
│          [Save Progress Note]           │
└─────────────────────────────────────────┘
```

3. **Submit Progress Note**:
```javascript
POST /api/ipd/admissions/admission-uuid-1/progress-notes
Body: {
  form_id: "progress-note-form-uuid",
  form_data: {
    subjective: "Patient reports decreased chest pain...",
    objective: "BP: 130/85, HR: 72...",
    assessment: "Stable angina, improving...",
    plan: "Continue current meds..."
  }
}
```

4. **Backend Creates Clinical Documentation**:
```python
# Create form submission
form_submission = FormSubmission(
    form_id=progress_note_form_id,
    patient_id=admission.patient_id,
    data=form_data,
    status='completed'
)
db.add(form_submission)

# Create clinical documentation record
clinical_doc = ClinicalDocumentation(
    admission_id=admission_id,
    patient_id=admission.patient_id,
    encounter_id=admission.encounter_id,
    documentation_type='PROGRESS_NOTE',
    form_submission_id=form_submission.id,  # Links to form submission!
    documented_by=current_user_id,
    documented_at=datetime.utcnow()
)
db.add(clinical_doc)
db.commit()
```

5. **Database After Progress Note**:

**`clinical_documentation` table**:
```sql
id: 'clinical-doc-uuid-1'
admission_id: 'admission-uuid-1'    ← Links to admission
patient_id: 'patient-123'           ← Links to patient
encounter_id: 'encounter-uuid-1'    ← Links to encounter
documentation_type: 'PROGRESS_NOTE'
form_submission_id: 'progress-form-sub-uuid-1'  ← Links to form submission!
documented_by: 'doctor-smith-uuid'
documented_at: '2026-03-14 09:00:00'
```

**`form_submissions` table** (new entry):
```sql
id: 'progress-form-sub-uuid-1'
form_id: 'progress-note-form-uuid'
patient_id: 'patient-123'           ← Links to patient
data: {                             ← JSONB - SOAP note data
  "subjective": "Patient reports decreased chest pain...",
  "objective": "BP: 130/85, HR: 72...",
  "assessment": "Stable angina, improving...",
  "plan": "Continue current meds..."
}
status: 'completed'
submitted_at: '2026-03-14 09:00:00'
```

---

## 📊 Complete Data Relationship Diagram

```
                    ┌─────────────┐
                    │   Patient   │
                    │ patient-123 │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
       ┌──────────┐  ┌──────────┐  ┌──────────────────┐
       │Encounter │  │IPDAdmission  │FormSubmissions   │
       │encounter │  │admission-1│  │(Multiple)        │
       │  -uuid-1 │  │           │  │                  │
       └────┬─────┘  └─────┬────┘  │• form-sub-1     │
            │              │        │• progress-sub-1  │
            │              │        │• nursing-sub-1   │
            │              │        └──────────────────┘
            │              │
            │              │
            ▼              ▼
       ┌──────────┐  ┌──────────────┐
       │  Bed     │  │Clinical Docs │
       │Assignment│  │(Multiple)    │
       │bed-201   │  │              │
       └──────────┘  │• Progress-1  │
                     │• Nursing-1   │
                     └──────────────┘

Each Clinical Doc links to a Form Submission
Each Form Submission contains JSONB data
```

---

## 🔍 Querying Form Data

### Query 1: Get All Data for a Patient

```sql
-- Get all form submissions for a patient
SELECT
    fs.id,
    f.name as form_name,
    fs.data as form_data,
    fs.submitted_at,
    ia.id as admission_id
FROM form_submissions fs
JOIN forms f ON f.id = fs.form_id
LEFT JOIN ipd_admissions ia ON ia.admission_form_submission_id = fs.id
WHERE fs.patient_id = 'patient-123'
ORDER BY fs.submitted_at DESC;
```

### Query 2: Get Clinical Documentation for Admission

```sql
-- Get all clinical docs with form data
SELECT
    cd.documentation_type,
    cd.documented_at,
    u.full_name as documented_by,
    f.name as form_name,
    fs.data as form_data
FROM clinical_documentation cd
JOIN form_submissions fs ON fs.id = cd.form_submission_id
JOIN forms f ON f.id = fs.form_id
JOIN users u ON u.id = cd.documented_by
WHERE cd.admission_id = 'admission-uuid-1'
ORDER BY cd.documented_at DESC;
```

### Query 3: Extract Specific Field from Form Data

```sql
-- Get all pain scores from admission forms
SELECT
    p.full_name,
    ia.admission_date,
    fs.data->>'pain_level' as pain_score,
    fs.data->>'blood_pressure' as blood_pressure
FROM ipd_admissions ia
JOIN patients p ON p.id = ia.patient_id
JOIN form_submissions fs ON fs.id = ia.admission_form_submission_id
WHERE fs.data ? 'pain_level'  -- Only where pain_level exists
ORDER BY ia.admission_date DESC;
```

---

## 📈 Analytics & Reporting

### Form Submission Analytics

**Available Queries**:

1. **Form Usage Statistics**:
   - How many times each form has been used
   - Which services use which forms most
   - Form completion rates

2. **Clinical Data Analytics**:
   - Average pain scores by service
   - Vital signs trends
   - Risk assessment patterns

3. **Compliance Reporting**:
   - Forms completed vs. required
   - Time to complete forms
   - Missing required fields

**Example**: Average pain scores by service
```sql
SELECT
    s.name as service_name,
    AVG((fs.data->>'pain_level')::int) as avg_pain_score,
    COUNT(*) as total_admissions
FROM ipd_admissions ia
JOIN encounters e ON e.id = ia.encounter_id
JOIN services s ON s.id = e.service_id
JOIN form_submissions fs ON fs.id = ia.admission_form_submission_id
WHERE fs.data ? 'pain_level'
GROUP BY s.name
ORDER BY avg_pain_score DESC;
```

---

## 🎯 Key Takeaways

### Data Flow Summary

1. **Form Template** (created once)
   - Stored in `forms` table
   - `is_template=true`, `template_category='ipd'`

2. **Form Configuration** (assigned to service)
   - Stored in `form_configurations` table
   - Links: form ↔ service ↔ form_type

3. **Form Submission** (each time form is filled)
   - Stored in `form_submissions` table
   - Contains actual data as JSONB
   - Links to: patient, form template

4. **IPD Admission** (patient admission record)
   - Stored in `ipd_admissions` table
   - Links to: patient, encounter, form_submission

5. **Clinical Documentation** (progress notes, assessments)
   - Stored in `clinical_documentation` table
   - Links to: admission, patient, encounter, form_submission

### Association Chain

```
Patient → Admission → Form Submission → Form Data (JSONB)
   ↓         ↓              ↓
   └─────────┴──────────────┴─→ Clinical Documentation
```

### Why This Design?

✅ **Flexible**: Any form can be used for any service
✅ **Traceable**: Complete audit trail of who submitted what and when
✅ **Queryable**: JSONB allows SQL queries on form data
✅ **Scalable**: Add new forms without code changes
✅ **Reportable**: All data available for analytics
✅ **Backward Compatible**: Static forms still work

---

## 📝 Summary

**The complete journey**:
1. Admin creates form template → Stored in `forms`
2. Admin assigns to service → Stored in `form_configurations`
3. User admits patient → Form loads automatically
4. User fills form → Data stored in `form_submissions`
5. Admission created → Links to form submission
6. Clinical docs added → Each links to its own form submission
7. All data queryable → Analytics and reporting

**All data is associated with**:
- ✅ Patient (`patient_id` in every table)
- ✅ Admission (`admission_id` where applicable)
- ✅ Encounter (`encounter_id` where applicable)
- ✅ Form template (`form_id` in submissions)
- ✅ Timestamp (when filled)
- ✅ User (who filled it)

This creates a complete, traceable, and queryable clinical documentation system! 🎉
