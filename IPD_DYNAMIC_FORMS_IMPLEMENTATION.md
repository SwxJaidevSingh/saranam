# IPD Dynamic Forms Implementation - Complete Guide

## Overview

This implementation enables dynamic, customizable forms throughout the IPD (In-Patient Department) workflow. Healthcare facilities can now create and assign custom forms for admissions, discharges, progress notes, and nursing assessments.

## Architecture

### Backend Components

#### 1. Database Tables

**`form_configurations`**
- Links forms to services/departments
- Supports facility-level and service-level configurations
- Fields: facility_id, service_id, form_type, form_id, is_required, display_order

**`clinical_documentation`**
- Stores progress notes and nursing assessments
- Links form submissions to IPD admissions
- Fields: admission_id, patient_id, encounter_id, documentation_type, form_submission_id

#### 2. Backend Models

**Location**: `backend/app/form_configurations/models.py`
- `FormConfiguration` - Form assignment model
- `ClinicalDocumentation` - Clinical documentation model
- Enums: `FormType`, `DocumentationType`

#### 3. API Endpoints

**Form Configurations** (`/api/form-configurations`)
- `GET /` - List all configurations (filterable)
- `GET /:id` - Get configuration by ID
- `GET /for-service/:serviceId` - Get form for service (with fallback)
- `POST /` - Create configuration
- `PUT /:id` - Update configuration
- `DELETE /:id` - Delete configuration

**Clinical Documentation**
- `POST /clinical-documentation` - Create documentation
- `GET /clinical-documentation/admission/:admissionId` - Get all docs for admission
- `GET /clinical-documentation/:id` - Get specific documentation

**IPD Endpoints** (Enhanced)
- `POST /ipd/admissions` - Now accepts `admission_form_id` and `form_data`
- `POST /ipd/admissions/:id/discharge` - Now accepts `discharge_form_id` and `form_data`
- `POST /ipd/admissions/:id/progress-notes` - Create progress note
- `POST /ipd/admissions/:id/nursing-assessments` - Create nursing assessment
- `GET /ipd/admissions/:id/clinical-documentation` - Get all clinical docs

### Frontend Components

#### 1. API Clients

**`frontend/src/api/formConfigurations.js`**
- Complete API client for form configurations
- Methods for CRUD operations and service lookups

**`frontend/src/api/ipd.js`** (Enhanced)
- Added methods: `createProgressNote()`, `createNursingAssessment()`, `getClinicalDocumentation()`

#### 2. Components

**AdmissionWizard** (`frontend/src/components/ipd/AdmissionWizard.jsx`)
- **Enhanced** with dynamic form support
- Automatically loads configured admission form for selected service
- Falls back to static form if no dynamic form configured
- Displays custom form in Step 2 using FormRenderer

**ProgressNoteForm** (`frontend/src/components/ipd/ProgressNoteForm.jsx`)
- Standalone component for creating progress notes
- Loads configured form for service
- Submits to clinical documentation endpoint

**NursingAssessmentForm** (`frontend/src/components/ipd/NursingAssessmentForm.jsx`)
- Component for nursing care documentation
- Similar structure to ProgressNoteForm
- Supports all form field types

**FormSubmissionViewer** (`frontend/src/components/forms/FormSubmissionViewer.jsx`)
- Displays submitted form data in readable format
- Automatically formats values based on field type
- Shows metadata (submitted by, timestamp, status)

#### 3. Admin Pages

**IPDFormConfiguration** (`frontend/src/pages/admin/IPDFormConfiguration.jsx`)
- Complete admin interface for managing form assignments
- Assign forms to services by form type
- View all current configurations
- Add/delete configurations

## Default Form Templates

Four pre-built IPD form templates are created by the seed script:

### 1. Admission Form
**Pages:**
- Admission Details: Reason, presenting complaints, allergies, current medications
- Medical History: Past medical, family, social history
- Advance Directives: DNR, emergency contacts

### 2. Discharge Form
**Pages:**
- Discharge Summary: Final diagnosis, hospital course, procedures
- Discharge Medications: Medication list and changes
- Discharge Instructions: Diet, activity, wound care, warning signs, follow-up

### 3. Progress Note (SOAP Format)
**Fields:**
- Subjective (S)
- Objective (O)
- Assessment (A)
- Plan (P)
- Additional Notes

### 4. Nursing Assessment
**Pages:**
- Vital Signs: LOC, orientation, pain score
- Skin & Mobility: Skin integrity, fall risk, mobility status
- Interventions: Nursing care provided, patient response, care plan updates

## Setup Instructions

### 1. Database Migration

```bash
cd backend
python -m flask db upgrade
```

This creates the `form_configurations` and `clinical_documentation` tables.

### 2. Seed Default Forms

```bash
cd backend
python seed_ipd_forms.py
```

This creates the 4 default IPD form templates.

### 3. Configure Forms for Services

1. Navigate to **Admin → IPD Form Configuration**
2. Select a service from the dropdown
3. Choose form type (Admission, Discharge, etc.)
4. Select the form template
5. Click "Add Configuration"

### 4. Using Dynamic Forms

#### Admission Process
1. Start admission wizard
2. Select patient
3. When service is selected, the configured admission form automatically loads
4. Complete the dynamic form
5. Continue through remaining steps (encounter, bed assignment)
6. Submit admission - form data is stored with admission

#### Creating Progress Notes
```jsx
import ProgressNoteForm from '../components/ipd/ProgressNoteForm';

<ProgressNoteForm
  admissionId={admission.id}
  patientId={admission.patient_id}
  serviceId={admission.service_id}
  onSuccess={() => console.log('Progress note saved!')}
/>
```

#### Creating Nursing Assessments
```jsx
import NursingAssessmentForm from '../components/ipd/NursingAssessmentForm';

<NursingAssessmentForm
  admissionId={admission.id}
  patientId={admission.patient_id}
  serviceId={admission.service_id}
  onSuccess={() => console.log('Assessment saved!')}
/>
```

#### Viewing Submitted Forms
```jsx
import FormSubmissionViewer from '../components/forms/FormSubmissionViewer';

<FormSubmissionViewer
  submission={submissionData}
  schema={formSchema}
/>
```

## Configuration Hierarchy

The system uses a fallback hierarchy for form resolution:

1. **Service-specific**: Form configured for specific service
2. **Facility-level**: Form configured for facility (all services)
3. **Global**: System default (null facility_id and service_id)
4. **Static fallback**: Built-in static forms if no configuration exists

## API Usage Examples

### Get Admission Form for Service

```javascript
import formConfigurationsApi from './api/formConfigurations';

const config = await formConfigurationsApi.getForService(
  serviceId,
  'ADMISSION',
  facilityId // optional
);

// Returns: { configuration, form }
```

### Create Form Configuration

```javascript
await formConfigurationsApi.create({
  service_id: '...',
  form_type: 'ADMISSION',
  form_id: '...',
  is_required: false,
  display_order: 1
});
```

### Submit Admission with Form Data

```javascript
import ipdApi from './api/ipd';

await ipdApi.admitPatient({
  patient_id: '...',
  admission_type: 'elective',
  service_id: '...',
  // Dynamic form fields
  admission_form_id: formConfig.form.id,
  form_data: {
    admission_reason: 'Scheduled surgery',
    allergies: 'Penicillin',
    current_medications: 'None',
    // ... all form fields
  }
});
```

### Create Progress Note

```javascript
await ipdApi.createProgressNote(admissionId, {
  form_id: formConfig.form.id,
  form_data: {
    subjective: 'Patient reports decreased pain',
    objective: 'Vitals stable...',
    assessment: 'Improving post-op',
    plan: 'Continue current medications'
  }
});
```

## Key Features

### 1. Fully Flexible
- Any form created in the form builder can be assigned
- Multiple forms can be assigned to different services
- No code changes needed to add new forms

### 2. Backwards Compatible
- If no dynamic form is configured, static forms are used
- Existing admissions continue to work
- Gradual migration supported

### 3. Complete Audit Trail
- All form submissions linked to admissions
- Timestamps and user tracking
- Full history of clinical documentation

### 4. Multi-facility Ready
- Facility-level configurations supported (when Facility model exists)
- Service-level overrides
- Scalable architecture

## File Structure

```
backend/
├── app/
│   ├── form_configurations/
│   │   ├── __init__.py
│   │   ├── models.py          # FormConfiguration, ClinicalDocumentation
│   │   ├── schemas.py         # Pydantic validation schemas
│   │   ├── services.py        # Business logic
│   │   └── routes.py          # API endpoints
│   ├── ipd/
│   │   ├── routes.py          # Enhanced with form support
│   │   ├── services.py        # Updated admit_patient(), discharge_patient()
│   │   └── schemas.py         # Added form_data fields
│   └── models.py              # Updated with new models
├── migrations/
│   └── versions/
│       └── 22f0f9c35d32_add_form_configurations_table_for_ipd_.py
└── seed_ipd_forms.py          # Creates default templates

frontend/
├── src/
│   ├── api/
│   │   ├── formConfigurations.js  # New API client
│   │   └── ipd.js                 # Enhanced with new methods
│   ├── components/
│   │   ├── forms/
│   │   │   └── FormSubmissionViewer.jsx  # View submissions
│   │   └── ipd/
│   │       ├── AdmissionWizard.jsx        # Enhanced with dynamic forms
│   │       ├── ProgressNoteForm.jsx       # New component
│   │       └── NursingAssessmentForm.jsx  # New component
│   └── pages/
│       └── admin/
│           └── IPDFormConfiguration.jsx   # Admin interface
```

## Benefits

1. **Customization**: Each facility/department can have tailored workflows
2. **Compliance**: Capture required data for accreditation/regulation
3. **Efficiency**: Reduce redundant data entry with smart forms
4. **Scalability**: Easy to add new form types without code changes
5. **Audit Trail**: Complete documentation history
6. **User Experience**: Consistent form interface across all workflows

## Next Steps

1. **Add Route**: Add IPDFormConfiguration page to your routing
2. **Navigation**: Add link in admin menu to access configuration page
3. **Test**: Configure a form for a service and test the admission flow
4. **Train Users**: Show staff how to use the new form builder integration
5. **Monitor**: Review form submissions and clinical documentation

## Support

For questions or issues:
1. Check form configuration in admin panel
2. Verify form templates exist and are marked as templates
3. Check browser console for API errors
4. Review backend logs for validation errors

---

**Implementation Status**: ✅ Complete

All backend and frontend components are implemented and ready for use!
