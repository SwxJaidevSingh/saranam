# Clinical Data Integration Guide

**CV Raman Health - Automated Clinical Observation Creation**

## Overview

The CV Raman Health platform includes a powerful clinical data integration system that automatically extracts clinical observations from form submissions and stores them in FHIR-compliant structures. This enables:

- **Longitudinal patient tracking** - All clinical measurements linked to patient encounters
- **Interoperability** - LOINC and SNOMED-CT coded observations
- **Analytics & Reporting** - Structured data for trend analysis
- **EHR Integration** - Standards-based data ready for external systems

## Architecture

### Data Flow

```
Form Submission
    ↓
Clinical Extractor (identifies clinical fields)
    ↓
Relational Transformer (creates Observation objects)
    ↓
Database Storage (linked to Patient & Encounter)
    ↓
Available for Analytics & Export
```

### Components

1. **ClinicalExtractor** (`backend/app/processing/clinical_extractor.py`)
   - Identifies demographic, vital, pain, and diagnosis data from forms
   - Supports explicit field mappings and heuristic detection
   - Extracts LOINC codes and units of measure

2. **RelationalTransformer** (`backend/app/processing/transformers.py`)
   - Converts extracted data to database models
   - Creates Observation, FormAnswer, and Diagnosis records
   - Maintains referential integrity

3. **SubmissionProcessor** (`backend/app/processing/submission_processor.py`)
   - Orchestrates the entire pipeline
   - Manages transactions and audit logging
   - Creates or links Patient and Encounter records

## Configuration

### Method 1: Explicit Clinical Mapping (Recommended)

Add a `clinicalMapping` object to any field definition:

```json
{
  "id": "bp_systolic",
  "type": "number",
  "label": "Blood Pressure (Systolic)",
  "clinicalMapping": {
    "observationType": "bp_systolic",
    "loincCode": "8480-6",
    "unit": "mmHg",
    "category": "vital-signs"
  }
}
```

**Available via UI:**
- Open field properties in Form Builder
- Scroll to "Clinical Mapping" section
- Select predefined observation type OR create custom mapping
- Save form

### Method 2: Heuristic Detection (Fallback)

The system automatically detects clinical fields based on field IDs and labels:

**Vital Signs:**
- Blood Pressure: `bp_systolic`, `bp_diastolic`, `systolic_bp`, `dbp`
- Heart Rate: `heart_rate`, `pulse`, `pulse_rate`, `hr`
- Temperature: `temperature`, `body_temperature`, `temp`
- SpO2: `spo2`, `oxygen_saturation`, `o2_sat`
- Respiratory Rate: `respiratory_rate`, `rr`, `breathing_rate`
- Weight/Height: `weight`, `body_weight`, `height`, `body_height`

**Pain Assessment:**
- Pain Scale: `pain_scale`, `pain_level`, `pain_score`, `pain_rating`
- Automatically detected for `painScale` field type

**Demographics:**
- Patient Name: `patient_name`, `full_name`, `name`
- Date of Birth: `date_of_birth`, `dob`, `birth_date`
- Gender: `gender`, `sex`
- Contact: `phone`, `mobile`, `contact_number`, `email`

### Predefined Observation Types

The system includes 12 predefined observation types with LOINC codes:

| Observation Type | LOINC Code | Unit | Category |
|------------------|------------|------|----------|
| `bp_systolic` | 8480-6 | mmHg | vital-signs |
| `bp_diastolic` | 8462-4 | mmHg | vital-signs |
| `heart_rate` | 8867-4 | bpm | vital-signs |
| `respiratory_rate` | 9279-1 | /min | vital-signs |
| `temperature` | 8310-5 | °F | vital-signs |
| `spo2` | 2708-6 | % | vital-signs |
| `weight` | 29463-7 | kg | vital-signs |
| `height` | 8302-2 | cm | vital-signs |
| `bmi` | 39156-5 | kg/m2 | vital-signs |
| `pain_scale` | 72514-3 | score | survey |
| `glucose` | 2339-0 | mg/dL | laboratory |
| `hemoglobin` | 718-7 | g/dL | laboratory |

## Usage Examples

### Example 1: Physiotherapy Assessment with Vitals

```javascript
{
  "pages": [
    {
      "id": "page_vitals",
      "title": "Vital Signs",
      "fields": [
        {
          "id": "bp_systolic",
          "type": "number",
          "label": "Blood Pressure (Systolic)",
          "required": true,
          "validation": { "min": 60, "max": 250 },
          "clinicalMapping": {
            "observationType": "bp_systolic",
            "loincCode": "8480-6",
            "unit": "mmHg",
            "category": "vital-signs"
          }
        },
        {
          "id": "pain_intensity",
          "type": "painScale",
          "label": "Pain Level (0-10)",
          "required": true,
          "config": {
            "min": 0,
            "max": 10,
            "showEmojis": true
          },
          "clinicalMapping": {
            "observationType": "pain_scale",
            "loincCode": "72514-3",
            "unit": "score",
            "category": "survey"
          }
        }
      ]
    }
  ]
}
```

**When submitted with:**
```json
{
  "bp_systolic": 130,
  "pain_intensity": 7
}
```

**Creates 2 Observation records:**

1. Blood Pressure Observation:
   - `observation_type`: "bp_systolic"
   - `value_numeric`: 130.0
   - `unit`: "mmHg"
   - `loinc_code`: "8480-6"
   - `category`: "vital-signs"
   - Linked to patient & encounter

2. Pain Scale Observation:
   - `observation_type`: "pain_scale"
   - `value_numeric`: 7.0
   - `unit`: "score"
   - `loinc_code`: "72514-3"
   - `category`: "survey"
   - Linked to patient & encounter

### Example 2: Custom Laboratory Observation

For observations not in the predefined list:

```json
{
  "id": "creatinine",
  "type": "number",
  "label": "Serum Creatinine",
  "validation": { "min": 0, "max": 20 },
  "config": { "allowDecimals": true, "decimalPlaces": 2 },
  "clinicalMapping": {
    "observationType": "creatinine",
    "loincCode": "2160-0",
    "unit": "mg/dL",
    "category": "laboratory",
    "snomedCode": "70901006"
  }
}
```

### Example 3: Using Field Sections

The pre-seeded field sections already include clinical mappings:

```bash
# Seed field sections (includes clinical mappings)
python seed_field_sections.py

# Result: 6 sections with clinical mappings
# - Vital Signs: 7 fields (BP, HR, Temp, SpO2, Weight, etc.)
# - Pain Assessment: 5 fields with pain_scale mapping
# - Functional Status, Mental Health, Social Support, Geriatric
```

Drag the "Vital Signs" section onto your form, and all fields will automatically create observations when submitted.

## Database Schema

### Observation Model

```python
class Observation(BaseModel):
    """Clinical observation (FHIR-compliant)"""
    __tablename__ = 'observations'

    patient_id = UUID          # Link to Patient
    encounter_id = UUID        # Link to Encounter
    observation_type = String  # e.g., 'bp_systolic'
    loinc_code = String        # Standard code
    snomed_code = String       # Additional coding
    category = String          # vital-signs, laboratory, etc.

    # Value storage (polymorphic)
    value_numeric = Numeric
    value_text = Text
    value_boolean = Boolean
    value_datetime = DateTime

    unit = String              # Unit of measure
    reference_range = JSONB    # Normal ranges
    interpretation = String    # High, Low, Normal
    status = String            # Final, Preliminary
    recorded_by = UUID         # Recording user
```

### Query Examples

```python
# Get all vital signs for a patient
vitals = Observation.query.filter_by(
    patient_id=patient_id,
    category='vital-signs'
).order_by(Observation.recorded_at.desc()).all()

# Get blood pressure trend
bp_readings = Observation.query.filter_by(
    patient_id=patient_id,
    observation_type='bp_systolic'
).order_by(Observation.recorded_at.asc()).all()

# Get observations from specific encounter
encounter_obs = Observation.query.filter_by(
    encounter_id=encounter_id
).all()
```

## API Response

When a form is submitted, the API returns comprehensive processing details:

```json
{
  "message": "Submission created successfully",
  "submission": {
    "id": "uuid",
    "form_id": "uuid",
    "patient_id": "uuid",
    "encounter_id": "uuid",
    "submitted_at": "2026-02-27T10:30:00Z"
  },
  "processing_summary": {
    "patient_name": "John Doe",
    "encounter_type": "OPD",
    "form_answers_saved": 15,
    "observations_created": 6,
    "diagnoses_created": 1,
    "vitals_recorded": [
      {
        "type": "bp_systolic",
        "value": "130 mmHg",
        "loinc_code": "8480-6"
      },
      {
        "type": "heart_rate",
        "value": "78 bpm",
        "loinc_code": "8867-4"
      }
    ]
  }
}
```

## Best Practices

### 1. Use Explicit Mappings for Critical Data

Always configure clinical mappings for:
- Vital signs (BP, HR, Temp, SpO2, RR)
- Laboratory values
- Pain assessments
- Functional status scales

### 2. Standardize Field IDs

Use consistent field ID naming:
- `bp_systolic` not `blood_pressure_sys` or `sys_bp`
- `heart_rate` not `pulse` or `hr_rate`
- This ensures heuristic detection works as fallback

### 3. Include Units in Labels

Make units clear to users:
- "Blood Pressure (mmHg)" not just "Blood Pressure"
- "Weight (kg)" not just "Weight"
- "Temperature (°F)" not just "Temperature"

### 4. Set Validation Ranges

Always include min/max validation for numeric clinical fields:
```json
"validation": {
  "min": 60,
  "max": 250,
  "required": true
}
```

### 5. Use Pre-Built Sections

Leverage the 6 pre-seeded field sections:
- Saves time
- Ensures consistency
- Already has clinical mappings configured
- Tested and validated

## Advanced Features

### Observation Interpretation

The system can automatically interpret values:

```python
# In RelationalTransformer
if observation_type == 'bp_systolic':
    if value_numeric > 140:
        observation.interpretation = 'High'
    elif value_numeric < 90:
        observation.interpretation = 'Low'
    else:
        observation.interpretation = 'Normal'
```

### Reference Ranges

Add reference ranges to observations:

```python
observation.reference_range = {
    "low": 90,
    "high": 120,
    "unit": "mmHg",
    "age_range": "18-65"
}
```

### Alerting on Abnormal Values

Trigger alerts for critical values:

```python
# In SubmissionProcessor
if observation_type == 'bp_systolic' and value > 180:
    # Create alert
    # Notify provider
    # Flag for urgent review
```

## Troubleshooting

### Observations Not Created

**Check:**
1. Field has `clinicalMapping` configured OR matches heuristic patterns
2. Field type is `number`, `painScale`, or `linearScale`
3. Value is not empty/null
4. Form submission succeeded

**Debug:**
```bash
# Check extraction
from app.processing.clinical_extractor import ClinicalExtractor
extractor = ClinicalExtractor()
result = extractor.extract(form.schema, submission_data)
print(result['vitals'])  # Should show extracted vitals
```

### Wrong Units

**Fix:** Update clinical mapping:
- Edit field in Form Builder
- Update "Unit of Measure"
- Save form
- Re-submit to create correct observations

### Missing LOINC Codes

**Solution:**
- Use predefined observation types (12 included)
- For custom observations, look up LOINC codes at: https://loinc.org/
- Add LOINC code to clinical mapping

## FHIR Compatibility

All observations follow FHIR Observation resource structure:

```json
{
  "resourceType": "Observation",
  "id": "uuid",
  "status": "final",
  "category": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/observation-category",
          "code": "vital-signs"
        }
      ]
    }
  ],
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "8480-6",
        "display": "Systolic blood pressure"
      }
    ]
  },
  "subject": {
    "reference": "Patient/uuid"
  },
  "encounter": {
    "reference": "Encounter/uuid"
  },
  "effectiveDateTime": "2026-02-27T10:30:00Z",
  "valueQuantity": {
    "value": 130,
    "unit": "mmHg",
    "system": "http://unitsofmeasure.org",
    "code": "mm[Hg]"
  }
}
```

## Integration with External Systems

### ABDM Integration

Observations can be exported to ABDM HIE-CM:
- Already LOINC coded
- FHIR-compliant structure
- Linked to ABHA ID
- Consent-based sharing

### HL7 v2 Messages

Generate ORU (Observation Result) messages:
```
MSH|^~\&|CV_RAMAN|HOSPITAL|||20260227103000||ORU^R01|MSG123|P|2.5
PID|1||PATIENT_ID^^^HOSPITAL||DOE^JOHN||19850301|M
OBR|1|ORDER123||^VITAL SIGNS|||20260227103000
OBX|1|NM|8480-6^Systolic BP^LN||130|mm[Hg]||||F|||20260227103000
```

## Support & Resources

- **LOINC Database:** https://loinc.org/
- **SNOMED-CT Browser:** https://browser.ihtsdotools.org/
- **FHIR Spec:** https://www.hl7.org/fhir/observation.html
- **ABDM Documentation:** https://abdm.gov.in/

---

**Document Version:** 1.0
**Last Updated:** February 27, 2026
**Status:** Production Ready ✅
