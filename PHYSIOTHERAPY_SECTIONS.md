# Physiotherapy Assessment Sections

## Overview

The system now includes 7 comprehensive physiotherapy assessment sections with pre-configured fields, including auto-calculated fields for efficiency.

## Available Sections

### 1. Anthropometric Measurements (5 fields)
Body measurements and composition analysis
- **Height (cm)** - Patient height in centimeters
- **Weight (kg)** - Patient weight in kilograms
- **BMI** - ⚡ Auto-calculated from height and weight (override allowed)
- **Body Fat Percentage (%)** - Optional measurement
- **Notes** - Additional observations

### 2. Range of Motion Assessment (7 fields)
Joint mobility and flexibility measurement
- **Joint** - Select: Shoulder, Elbow, Wrist, Hip, Knee, Ankle, Spine
- **Side** - Left, Right, or Bilateral
- **Movement Type** - Flexion, Extension, Abduction, etc.
- **Degrees Achieved** - Measured ROM (0-360°)
- **Normal Range** - Reference value for comparison
- **Pain During Movement** - Pain scale (0-10)
- **ROM Notes** - Observations and limitations

### 3. Muscle Strength Testing (5 fields)
Manual muscle testing (MMT) assessment
- **Muscle Group** - Specific muscle or muscle group
- **Side** - Left, Right, or Bilateral
- **Strength Grade** - MMT scale (0-5)
  - 0: No contraction
  - 1: Trace/flicker
  - 2: Poor (gravity eliminated)
  - 3: Fair (against gravity)
  - 4: Good (some resistance)
  - 5: Normal (full resistance)
- **Resistance Applied** - Description of resistance
- **Notes** - Additional observations

### 4. Gait & Balance Assessment (9 fields)
Walking pattern and balance evaluation
- **Gait Pattern** - Normal, Antalgic, Ataxic, Hemiplegic, etc.
- **Walking Aid** - None, Cane, Walker, Crutches, etc.
- **Distance Walked (meters)** - Test distance
- **Time Taken (seconds)** - Test duration
- **Walking Speed (m/s)** - ⚡ Auto-calculated from distance/time (override allowed)
- **Balance Test Type** - Berg, TUG, Romberg, etc.
- **Balance Score** - Test-specific score
- **Falls Risk Level** - Low, Moderate, High
- **Notes** - Gait observations and safety concerns

### 5. Posture Assessment (5 fields)
Static and dynamic posture evaluation
- **Head Position** - Neutral, Forward head, Lateral tilt
- **Shoulder Position** - Neutral, Rounded, Elevated, etc.
- **Spine Alignment** - Normal, Kyphosis, Lordosis, Scoliosis
- **Pelvic Position** - Neutral, Anterior/Posterior tilt
- **Notes** - Detailed posture observations

### 6. Special Orthopaedic Tests (4 fields)
Clinical special tests for specific conditions
- **Test Name** - Pre-populated with common tests:
  - Shoulder: Neer's, Hawkins-Kennedy, Empty Can, Apprehension, Speed's
  - Knee: Lachman, Anterior Drawer, McMurray, Valgus/Varus Stress
  - Hip: Thomas, Ober, Patrick's/FABER, Trendelenburg
  - Spine: Straight Leg Raise, Slump Test
- **Side Tested** - Left, Right, or Bilateral
- **Result** - Positive, Negative, or Inconclusive
- **Notes** - Test findings and patient response

### 7. Exercise Prescription (7 fields)
Therapeutic exercise program details
- **Exercise Name** - Name of the exercise
- **Sets** - Number of sets
- **Repetitions per Set** - Reps per set
- **Hold Duration (seconds)** - For isometric exercises
- **Frequency (times per week)** - Weekly frequency
- **Total Weekly Repetitions** - ⚡ Auto-calculated: sets × reps × frequency (override allowed)
- **Instructions & Precautions** - Detailed exercise instructions

---

## Auto-Calculated Fields

### How Auto-Calculation Works

Some fields are marked as **auto-calculated** (⚡), meaning their values are computed automatically based on other fields:

1. **BMI**: `weight / (height/100)²`
2. **Walking Speed**: `distance / time`
3. **Total Weekly Reps**: `sets × reps × frequency`

### Override Capability

All auto-calculated fields support **manual override**:
- The field will auto-populate when dependent fields are filled
- Form builders can choose to allow users to override the calculated value
- Useful for cases where manual measurement differs from calculation

### Field Configuration

When viewing an auto-calculated field in the Form Builder, you'll see:
- **Formula** - The calculation formula used
- **Depends on fields** - Which fields trigger the calculation
- **Manual override** - Whether users can edit the calculated value

---

## Usage Guide

### Using Physiotherapy Sections

1. **Navigate to Form Builder** (`/forms/new` or `/forms/{id}/edit`)
2. **Locate Field Sections panel** on the left side
3. **Filter by "Physiotherapy"** category
4. **Drag entire sections** OR **expand and drag individual fields**

### Example: BMI Calculation

When a patient enters:
- Height: 170 cm
- Weight: 70 kg

The BMI field automatically calculates: `70 / (170/100)² = 24.2 kg/m²`

If manual override is enabled, the clinician can adjust this value if needed.

---

## Clinical Mappings

Many fields include **clinical mappings** for healthcare data standards:
- **LOINC codes** for observations (e.g., BMI = 39156-5)
- **Standard units** (cm, kg, kg/m², m/s)
- **Category classifications** (vital-signs, assessment)

This ensures compatibility with:
- Electronic Health Records (EHR)
- Health Information Exchange (HIE)
- Clinical decision support systems

---

## Best Practices

### 1. Use Appropriate Sections
- Select only the sections relevant to your assessment type
- Don't overwhelm patients with unnecessary fields

### 2. Leverage Auto-Calculations
- Let the system calculate BMI, walking speed, etc.
- Enable override only when clinical judgment may differ

### 3. Combine with Other Sections
- Pair with "Vital Signs" for comprehensive assessment
- Use "Pain Assessment" alongside ROM testing
- Include "Functional Status" for ADL evaluation

### 4. Customize as Needed
- Remove fields that don't apply to your practice
- Add custom notes fields for specific observations
- Adjust validation ranges based on your population

---

## Technical Details

### Data Structure

Fields are stored in the `FieldSection` model with:
```python
{
  "name": "Anthropometric Measurements",
  "category": "physiotherapy",
  "is_system": True,
  "fields": [
    {
      "id": "bmi",
      "type": "number",
      "config": {
        "isCalculated": True,
        "calculationFormula": "weight_physio / ((height / 100) ** 2)",
        "allowOverride": True,
        "dependsOn": ["height", "weight_physio"]
      }
    }
  ]
}
```

### Future Enhancements

Potential future features:
- Client-side real-time calculation as user types
- Advanced formulas (e.g., ideal body weight, BMR)
- Historical tracking and trending
- Goal setting and progress monitoring
- Integration with exercise libraries

---

## Support

For questions or issues with physiotherapy sections:
1. Check field validation messages
2. Review auto-calculation dependencies
3. Ensure dependent fields are filled before calculating
4. Contact system administrator for custom section requests
