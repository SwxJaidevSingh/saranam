# Healthcare Form Builder Enhancement Plan

**Project**: CV Raman Health Form Builder
**Date**: February 27, 2026
**Status**: In Progress

## Overview

This document outlines the comprehensive plan for enhancing the CV Raman Health form builder with healthcare-specific prebuilt templates, risk-scoring capabilities, and industry-standard features.

## Goals

1. **Prebuilt Form Templates**: Provide ready-to-use healthcare forms (Physiotherapy, MSW Counselling, OPD, IPD, Home Care)
2. **Reusable Field Sections**: Create drag-and-drop field groups for common healthcare data (Vital Signs, Pain Assessment, etc.)
3. **Risk-Scoring System**: Enable form builders to configure risk rules and automatically calculate patient risk scores
4. **Clinical Integration**: Map form fields to clinical observations with standard medical coding (LOINC, SNOMED-CT)
5. **Industry Standards**: Align with ABDM, DISHA, and healthcare interoperability standards

## Architecture Overview

### Current State

The form builder already has:
- ✅ Multi-page form support
- ✅ 14 field types including healthcare-specific pain scale
- ✅ Conditional logic system
- ✅ Clinical data models (Patient, Encounter, Observation, Diagnosis)
- ✅ ABDM-compliant patient records with ABHA integration
- ✅ Consent and audit infrastructure

### Enhancements Needed

1. **Risk-Scoring Infrastructure**
   - Database tables for risk rules and levels
   - Backend calculation service
   - UI for configuring risk rules

2. **New Field Types**
   - Severity Rating Field
   - Symptom Checklist Field
   - Functional Status Field
   - Risk Score Display Field

3. **Template System**
   - Template storage and categorization
   - Template browser UI
   - Template cloning mechanism

4. **Field Sections Library**
   - Reusable field groups
   - Section palette for drag-and-drop

## Implementation Phases

### Phase 1: Risk-Scoring Infrastructure (Week 1-2)

**Objective**: Build foundation for risk-based clinical decision support

#### Backend Components

1. **Database Schema**
   ```sql
   -- Risk Rules (field-level scoring)
   CREATE TABLE field_risk_rules (
       id UUID PRIMARY KEY,
       field_id VARCHAR(255),
       form_id UUID REFERENCES forms(id),
       rule_type VARCHAR(50), -- 'range' or 'categorical'
       condition JSONB,
       created_at TIMESTAMP
   );

   -- Risk Levels (form-level thresholds)
   CREATE TABLE form_risk_levels (
       id UUID PRIMARY KEY,
       form_id UUID REFERENCES forms(id),
       level_name VARCHAR(50),
       min_score NUMERIC(10,2),
       max_score NUMERIC(10,2),
       color_code VARCHAR(20),
       description TEXT
   );

   -- Risk Score Cache
   CREATE TABLE submission_risk_scores (
       submission_id UUID PRIMARY KEY,
       total_score NUMERIC(10,2),
       risk_level VARCHAR(50),
       field_scores JSONB,
       calculated_at TIMESTAMP
   );
   ```

2. **RiskAssessmentService** (`backend/app/risk/service.py`)
   - Calculate total risk score from field values
   - Evaluate range rules (e.g., temperature 99-102°F = 2 points)
   - Evaluate categorical rules (e.g., "Severe" = 3 points)
   - Determine risk level based on thresholds

3. **API Endpoints**
   - `POST /api/forms/{form_id}/risk-rules` - Create risk rule
   - `GET /api/forms/{form_id}/risk-rules` - List risk rules
   - `PUT /api/forms/{form_id}/risk-rules/{rule_id}` - Update rule
   - `DELETE /api/forms/{form_id}/risk-rules/{rule_id}` - Delete rule
   - `POST /api/forms/{form_id}/risk-levels` - Define risk levels
   - `POST /api/submissions/{submission_id}/calculate-risk` - Calculate risk

#### Frontend Components

4. **Risk Rules Tab** (`frontend/src/components/forms/builder/RiskRulesTab.jsx`)
   - Select field to add risk rule
   - Choose rule type (Range or Categorical)
   - Define conditions and scores
   - Preview risk calculation

5. **Risk Levels Tab** (`frontend/src/components/forms/builder/RiskLevelsTab.jsx`)
   - Define risk levels (e.g., Low, Moderate, High, Critical)
   - Set score ranges for each level
   - Configure color coding and descriptions

6. **Risk Score Preview**
   - Real-time calculation as user fills form
   - Visual indicator (gauge, badge, or bar)

### Phase 2: New Healthcare Field Types (Week 2-3)

**Objective**: Provide specialized input fields for healthcare data collection

#### 1. Severity Rating Field

**Component**: `frontend/src/components/forms/fields/SeverityRatingField.jsx`

**Features**:
- Configurable severity levels (3-6 levels)
- Color-coded buttons (green → yellow → orange → red)
- Pre-defined scales or custom levels
- Auto-scoring for risk calculation

**Configuration**:
```javascript
{
  type: 'severityRating',
  label: 'Symptom Severity',
  config: {
    levels: ['None', 'Mild', 'Moderate', 'Severe', 'Critical'],
    colors: ['#22c55e', '#eab308', '#f59e0b', '#ef4444', '#991b1b'],
    scores: [0, 1, 2, 3, 4]
  }
}
```

**Use Cases**:
- Symptom severity (pain, nausea, fatigue)
- Functional limitations
- Disease severity staging

#### 2. Symptom Checklist Field

**Component**: `frontend/src/components/forms/fields/SymptomChecklistField.jsx`

**Features**:
- Multi-select symptom list
- Each symptom has sub-severity rating
- Aggregate symptom score
- Common symptom presets

**Configuration**:
```javascript
{
  type: 'symptomChecklist',
  label: 'Current Symptoms',
  config: {
    symptoms: ['Pain', 'Nausea', 'Fatigue', 'Weakness', 'Dizziness'],
    severityLevels: ['Mild', 'Moderate', 'Severe'],
    allowMultiple: true,
    preset: 'geriatric' // or 'oncology', 'cardiac', 'custom'
  }
}
```

**Use Cases**:
- Geriatric Patient Care (GPC) screening
- Post-operative assessment
- Chronic disease monitoring

#### 3. Functional Status Field

**Component**: `frontend/src/components/forms/fields/FunctionalStatusField.jsx`

**Features**:
- ECOG Performance Status (0-5)
- Karnofsky Performance Scale (0-100)
- ADL Independence Scale
- Visual descriptors for each level

**Configuration**:
```javascript
{
  type: 'functionalStatus',
  label: 'Performance Status',
  config: {
    scale: 'ECOG', // or 'Karnofsky', 'ADL'
    showDescriptions: true
  }
}
```

**Use Cases**:
- Cancer patient assessment
- Rehabilitation progress tracking
- Geriatric care planning

#### 4. Risk Score Display Field

**Component**: `frontend/src/components/forms/fields/RiskScoreDisplay.jsx`

**Features**:
- Read-only calculated field
- Real-time updates as form filled
- Multiple display modes (gauge, badge, progress bar)
- Color-coded by risk level

**Configuration**:
```javascript
{
  type: 'riskScoreDisplay',
  label: 'Patient Risk Assessment',
  config: {
    calculation: 'auto', // Based on form risk rules
    display: 'gauge', // or 'badge', 'bar'
    thresholds: { low: 3, moderate: 6, high: 9 }
  }
}
```

**Use Cases**:
- Show risk level to clinician during assessment
- Alert for high-risk patients
- Triage decision support

### Phase 3: Reusable Field Sections Library (Week 3-4)

**Objective**: Enable quick form building with pre-configured field groups

#### Backend Components

1. **Database Schema**
   ```sql
   CREATE TABLE field_sections (
       id UUID PRIMARY KEY,
       name VARCHAR(255),
       description TEXT,
       category VARCHAR(100), -- 'vitals', 'assessment', 'history'
       fields JSONB,
       is_system BOOLEAN DEFAULT FALSE, -- Pre-defined vs user-created
       created_by UUID REFERENCES users(id),
       created_at TIMESTAMP
   );
   ```

2. **API Endpoints**
   - `GET /api/field-sections` - List available sections
   - `GET /api/field-sections/{section_id}` - Get section details
   - `POST /api/field-sections` - Create custom section

#### Frontend Components

3. **Section Palette** (`frontend/src/components/forms/builder/SectionPalette.jsx`)
   - Searchable section library
   - Drag section to form canvas
   - Preview section fields before adding
   - Categorized by type

4. **Pre-defined Sections**

   **a) Vital Signs Section** (7 fields)
   ```javascript
   {
     name: 'Vital Signs',
     category: 'vitals',
     fields: [
       { type: 'number', label: 'Blood Pressure (Systolic)', unit: 'mmHg', loincCode: '8480-6' },
       { type: 'number', label: 'Blood Pressure (Diastolic)', unit: 'mmHg', loincCode: '8462-4' },
       { type: 'number', label: 'Heart Rate', unit: 'bpm', loincCode: '8867-4' },
       { type: 'number', label: 'Respiratory Rate', unit: '/min', loincCode: '9279-1' },
       { type: 'number', label: 'Temperature', unit: '°F', loincCode: '8310-5' },
       { type: 'number', label: 'SpO2', unit: '%', loincCode: '2708-6' },
       { type: 'number', label: 'Weight', unit: 'kg', loincCode: '29463-7' }
     ]
   }
   ```

   **b) Pain Assessment Section** (5 fields)
   - Pain location (select)
   - Pain intensity (pain scale 0-10)
   - Pain character (checkbox: sharp, dull, burning, etc.)
   - Pain duration (select)
   - Pain triggers (textarea)

   **c) Functional Status Section** (3 fields)
   - Walking ability (severity rating)
   - ADL independence (linear scale 0-10)
   - Mobility aids required (checkbox)

   **d) Mental Health Section** (6 fields)
   - Mood (select: good, fair, depressed, anxious)
   - Sleep quality (severity rating)
   - Appetite (severity rating)
   - Cognitive function (select)
   - Social engagement (select)
   - Caregiver stress (linear scale)

   **e) Social Support Section** (4 fields)
   - Living situation (select)
   - Primary caregiver (text)
   - Support network (checkbox)
   - Financial concerns (radio)

### Phase 4: Prebuilt Form Templates (Week 4-6)

**Objective**: Provide ready-to-use healthcare assessment forms

#### Backend Components

1. **Database Schema Extensions**
   ```sql
   ALTER TABLE forms ADD COLUMN is_template BOOLEAN DEFAULT FALSE;
   ALTER TABLE forms ADD COLUMN template_category VARCHAR(100);
   ALTER TABLE forms ADD COLUMN template_description TEXT;
   ```

2. **Template Cloning API**
   - `GET /api/templates` - List all templates
   - `GET /api/templates/{template_id}` - Get template details
   - `POST /api/templates/{template_id}/clone` - Clone template to new form

#### Frontend Components

3. **Template Browser** (`frontend/src/components/forms/builder/TemplateBrowser.jsx`)
   - Grid/list view of templates
   - Filter by category
   - Preview template
   - One-click clone to start customizing

#### Template Specifications

**Template 1: Physiotherapy Assessment** (4 pages)

**Page 1 - Patient Demographics**
- Patient name, ABHA address, age, gender
- Contact information
- Referral source

**Page 2 - Pain Assessment**
- Primary pain location (select with body diagram)
- Pain intensity (pain scale 0-10) with risk rule
- Pain character (checkbox)
- Pain duration
- Pain triggers
- Impact on daily activities

**Page 3 - Functional Assessment**
- Walking ability (severity rating) with risk rule
- ADL independence (linear scale)
- Range of motion limitations (textarea)
- Strength assessment
- Balance and coordination
- Use of assistive devices

**Page 4 - Treatment Plan**
- Treatment goals (textarea)
- Recommended exercises (checkbox)
- Session frequency (select)
- Home exercise program (checkbox)
- Follow-up date
- Risk score display

**Template 2: MSW Counselling** (3 pages)

**Page 1 - Demographics & Social History**
- Patient information
- Living situation
- Family composition
- Employment status
- Financial concerns

**Page 2 - Mental Health Screening**
- Mood assessment (select)
- Anxiety level (severity rating)
- Depression screening questions
- Sleep quality
- Appetite changes
- Cognitive function

**Page 3 - Caregiver & Support Assessment**
- Primary caregiver information
- Caregiver burden scale
- Support network (checkbox)
- Community resources needed
- Counselling goals
- Follow-up plan

**Template 3: OPD Assessment** (2 pages)

**Page 1 - Chief Complaint & Vitals**
- Chief complaint (textarea)
- Duration of symptoms
- Vital signs section (pre-built)
- Current medications (textarea)

**Page 2 - Symptoms & Diagnosis**
- Symptom checklist with severity
- Physical examination findings
- Provisional diagnosis (text with ICD-10 lookup)
- Investigations ordered (checkbox)
- Treatment prescribed
- Follow-up instructions

**Template 4: IPD Assessment** (3 pages)

**Page 1 - Admission Details**
- Admission date/time
- Admission type (Emergency/Planned)
- Chief complaint
- Referring physician
- Insurance information

**Page 2 - Comprehensive Assessment**
- Complete vital signs
- Detailed symptom assessment
- Medical history (checkbox)
- Surgical history
- Allergies
- Current medications

**Page 3 - Clinical Status**
- Physical examination findings
- Diagnosis (provisional/confirmed)
- Risk score display
- Treatment plan
- Special precautions
- Expected length of stay

**Template 5: Home Care Assessment** (3 pages)

**Page 1 - Patient & Caregiver**
- Patient demographics
- ABHA address
- Primary caregiver details
- Emergency contacts
- Language preferences

**Page 2 - Home Environment**
- Home accessibility (checkbox)
- Safety concerns (checkbox)
- Available facilities (water, electricity, bathroom)
- Distance to nearest hospital
- Transportation availability

**Page 3 - Care Plan**
- Services needed (checkbox: nursing, physiotherapy, MSW)
- Visit frequency
- Medical equipment required
- Medication management plan
- Family education needs
- Follow-up schedule

### Phase 5: Clinical Integration & Documentation (Week 6-8)

**Objective**: Ensure forms integrate with clinical workflows and meet industry standards

#### 1. Field-to-Observation Mapping

**Enhancement**: Add clinical mapping to field configuration

```javascript
{
  id: 'blood_pressure_systolic',
  type: 'number',
  label: 'Blood Pressure (Systolic)',
  clinicalMapping: {
    observationType: 'bp_systolic',
    loincCode: '8480-6',
    snomedCode: '271649006',
    unit: 'mmHg',
    category: 'vital-signs',
    autoCreateObservation: true
  }
}
```

**Implementation**:
- Add mapping configuration UI to field properties
- LOINC code lookup library
- SNOMED-CT code lookup
- Unit of measure picker

#### 2. Submission Processing Enhancement

**Current**: `backend/app/processing/clinical_extractor.py` (70% complete)

**Enhancements Needed**:
1. Read clinical mapping from field config
2. Auto-create Observation records for mapped fields
3. Link observations to encounter
4. Apply risk calculation
5. Generate alerts for high-risk submissions

**Service**: `backend/app/processing/submission_processor.py`

```python
class SubmissionProcessor:
    def process_submission(self, submission_id):
        # 1. Extract clinical data
        clinical_data = ClinicalExtractor.extract(submission)

        # 2. Calculate risk score
        risk_score = RiskAssessmentService.calculate(submission)

        # 3. Create observations
        for field, value in clinical_data.items():
            if field.has_clinical_mapping:
                Observation.create(
                    patient_id=submission.patient_id,
                    encounter_id=submission.encounter_id,
                    observation_type=field.mapping.observation_type,
                    value=value,
                    loinc_code=field.mapping.loinc_code,
                    unit=field.mapping.unit
                )

        # 4. Store risk score
        SubmissionRiskScore.create(
            submission_id=submission_id,
            total_score=risk_score.total,
            risk_level=risk_score.level,
            field_scores=risk_score.breakdown
        )

        # 5. Generate alerts if high risk
        if risk_score.level == 'HIGH' or risk_score.level == 'CRITICAL':
            AlertService.notify_high_risk(submission)
```

#### 3. Comprehensive Documentation

**Documents to Create** (all in `docs/` folder):

1. **Form Template Guide** (`docs/FORM_TEMPLATES_GUIDE.md`)
   - How to use templates
   - Customizing templates
   - Creating custom templates
   - Template best practices

2. **Risk-Scoring Guide** (`docs/RISK_SCORING_GUIDE.md`)
   - What is risk scoring
   - How to configure risk rules
   - Risk calculation methodology
   - Clinical use cases

3. **Field Types Reference** (`docs/FIELD_TYPES_REFERENCE.md`)
   - Complete list of field types
   - Configuration options for each
   - Examples and use cases
   - Validation rules

4. **Clinical Mapping Guide** (`docs/CLINICAL_MAPPING_GUIDE.md`)
   - Field-to-observation mapping
   - LOINC code reference
   - SNOMED-CT integration
   - FHIR resource mapping

5. **ABDM Compliance Notes** (`docs/ABDM_COMPLIANCE.md`)
   - ABHA integration requirements
   - HIE-CM consent workflow
   - Health Facility Registry (HFR)
   - Health Professional Registry (HPR)
   - FHIR resource specifications

6. **Industry Standards Recommendations** (`docs/INDUSTRY_STANDARDS.md`)
   - DISHA compliance checklist
   - HL7 integration roadmap
   - Telemedicine readiness
   - Data security best practices
   - Offline-first capabilities

## Industry Standard Recommendations

### Immediate Priorities (ABDM/DISHA Compliance)

1. **Patient Consent Management**
   - ✅ Consent artifact model (already implemented)
   - 🔲 HIE-CM integration for consent requests
   - 🔲 Granular consent (by data type, by purpose)
   - 🔲 Consent dashboard for patients

2. **Healthcare Facility Integration**
   - 🔲 HFR ID registration and validation
   - 🔲 HPR ID for healthcare professionals
   - 🔲 Digital signature for authenticated records

3. **Data Security**
   - ✅ PII encryption (already implemented)
   - ✅ Audit logging (already implemented)
   - 🔲 Data anonymization for analytics
   - 🔲 Secure API authentication (OAuth 2.0)

### Medium-Term Enhancements

4. **FHIR Interoperability**
   - 🔲 Export form submissions as FHIR Bundles
   - 🔲 Map to FHIR resources: Patient, Observation, Condition, Encounter
   - 🔲 FHIR API endpoints for external integration

5. **HL7 Messaging**
   - 🔲 ADT messages (Admit, Discharge, Transfer)
   - 🔲 ORM messages (Order management)
   - 🔲 ORU messages (Observation results)

6. **Telemedicine Integration**
   - 🔲 Video consultation integration
   - 🔲 E-prescription generation
   - 🔲 Teleconsultation forms
   - 🔲 Remote monitoring data capture

### Long-Term Vision

7. **Offline-First Capabilities**
   - 🔲 Progressive Web App (PWA)
   - 🔲 Local data storage (IndexedDB)
   - 🔲 Background sync when online
   - 🔲 Conflict resolution

8. **AI-Powered Features**
   - 🔲 Auto-suggest diagnoses based on symptoms
   - 🔲 Drug interaction checking
   - 🔲 Predictive risk scoring (ML models)
   - 🔲 Natural language processing for clinical notes

9. **Analytics & Reporting**
   - 🔲 Form submission analytics
   - 🔲 Risk level distribution reports
   - 🔲 Population health dashboards
   - 🔲 Quality indicators (HEDIS, PQRS)

10. **Regional Language Support**
    - 🔲 Multi-language form builder
    - 🔲 Hindi, Tamil, Bengali, etc.
    - 🔲 Voice input for low-literacy users
    - 🔲 Audio/video instructions

## Success Metrics

1. **Adoption**
   - 5 prebuilt templates available
   - 10+ reusable field sections
   - 80% of new forms use templates or sections

2. **Clinical Value**
   - Risk scores calculated for 100% of eligible submissions
   - 90% of high-risk patients flagged within 1 minute
   - Automated observation creation for 75%+ of vitals

3. **Developer Experience**
   - Form creation time reduced by 60%
   - Template customization in < 10 minutes
   - Comprehensive documentation coverage

4. **Compliance**
   - ABDM-ready (ABHA, HFR, HPR integration)
   - DISHA-compliant data handling
   - Full audit trail for 7 years

## Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Phase 1 | 2 weeks | Risk-scoring infrastructure |
| Phase 2 | 1 week | 4 new field types |
| Phase 3 | 1 week | Field sections library |
| Phase 4 | 2 weeks | 5 form templates |
| Phase 5 | 2 weeks | Clinical integration & docs |
| **Total** | **8 weeks** | **Full implementation** |

## Next Steps

1. ✅ Create docs/ folder structure
2. 🔲 Implement database migrations for risk tables
3. 🔲 Build RiskAssessmentService
4. 🔲 Create risk rules API
5. 🔲 Build risk configuration UI

## References

- **Codebase**: `/Users/farzanmanzer/CV Health/cv-raman-health/`
- **Reference Dashboard**: `/Users/farzanmanzer/offlineapp/oblfdashboard/`
- **Compliance Guide**: `HEALTHCARE_COMPLIANCE_GUIDE.md`
- **Implementation Progress**: `IMPLEMENTATION_PROGRESS.md`
- **Patient Data**: `/Users/farzanmanzer/Downloads/Patient Count (1).xlsx`

## Future Considerations

**Follow-Up Features** (Planned for later phases):
- Follow-up by Physiotherapist workflow
- Follow-up by MSW workflow
- Follow-up by Nurses workflow
- Appointment scheduling integration
- Task management for care team
- Patient portal for self-service

**Note**: These will be designed and implemented after core form builder enhancements are complete.

---

**Document Version**: 1.0
**Last Updated**: February 27, 2026
**Status**: ✅ Planning Complete, 🔄 Implementation Started
