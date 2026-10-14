# Risk Scoring System - Quick Start Guide

**Project**: CV Raman Health Form Builder
**Date**: February 27, 2026

## What is Risk Scoring?

Risk scoring is a clinical decision support feature that automatically calculates a patient's risk level based on form responses. It helps healthcare providers:

- **Triage patients** - Identify high-risk patients who need immediate attention
- **Prioritize resources** - Allocate staff and equipment to critical cases
- **Track trends** - Monitor risk levels over time
- **Generate alerts** - Notify care team when risk exceeds thresholds

## How It Works

### 1. Form Builder Configures Risk Rules

When creating a form, the builder can assign risk scores to specific field values:

**Example: Pain Intensity Field**
- Pain level 0-3 → 1 point (Low risk)
- Pain level 4-6 → 2 points (Moderate risk)
- Pain level 7-10 → 3 points (High risk)

**Example: Walking Ability Field**
- Independent → 0 points
- With aid → 1 point
- With assistance → 2 points
- Unable → 3 points

### 2. System Calculates Total Score

When a patient fills out the form, the system:
1. Evaluates each field against its risk rules
2. Sums up points from all fields
3. Compares total to risk thresholds
4. Determines overall risk level

**Example Calculation:**
```
Pain intensity (7/10) = 3 points
Walking ability (Unable) = 3 points
Age (75 years) = 2 points
-----------------------------------
TOTAL SCORE = 8 points → HIGH RISK
```

### 3. Risk Level Displayed

The calculated risk level is shown to the healthcare provider:
- **Low Risk** (0-3 points) - Green badge
- **Moderate Risk** (4-6 points) - Orange badge
- **High Risk** (7-10 points) - Red badge
- **Critical** (11+ points) - Dark red badge with alert

## Risk Rule Types

### Type 1: Range Rules (for numeric fields)

Use range rules when field values are numbers (age, temperature, blood pressure, etc.)

**Configuration:**
```javascript
Field: Temperature (°F)
Rule Type: Range

Ranges:
- 97-99°F → 1 point (Normal)
- 99-102°F → 2 points (Mild fever)
- 102-104°F → 3 points (High fever)
- 104+°F → 4 points (Critical)
```

**Use Cases:**
- Vital signs (BP, heart rate, temperature)
- Lab values (glucose, hemoglobin)
- Age ranges
- Pain scales (0-10)

### Type 2: Categorical Rules (for select/radio/checkbox fields)

Use categorical rules when field has predefined options

**Configuration:**
```javascript
Field: Symptom Severity
Rule Type: Categorical

Options:
- "None" → 0 points
- "Mild" → 1 point
- "Moderate" → 2 points
- "Severe" → 3 points
- "Critical" → 4 points
```

**Use Cases:**
- Severity levels
- Yes/No questions
- Symptom presence
- Functional status

## Step-by-Step: Adding Risk Scoring to a Form

### Step 1: Open Form Builder

Navigate to Forms → Create New Form or edit existing form

### Step 2: Add Fields

Add all the fields you need (demographics, symptoms, vitals, etc.)

### Step 3: Open Risk Rules Tab

Click on "Risk Rules" tab (next to "Fields" and "Logic")

### Step 4: Add Risk Rule for Each Relevant Field

**For Pain Intensity Field:**
1. Click "Add Risk Rule"
2. Select field: "Pain Intensity"
3. Choose rule type: "Range"
4. Define ranges:
   - Lower: 0, Upper: 3, Score: 1
   - Lower: 4, Upper: 6, Score: 2
   - Lower: 7, Upper: 10, Score: 3
5. Save rule

**For Walking Ability Field:**
1. Click "Add Risk Rule"
2. Select field: "Walking Ability"
3. Choose rule type: "Categorical"
4. Define categories:
   - "Independent" → 0
   - "With aid" → 1
   - "With assistance" → 2
   - "Unable" → 3
5. Save rule

### Step 5: Define Risk Levels

Click "Risk Levels" tab

Configure thresholds:
- **Low Risk**: 0-3 points (Green, #22c55e)
- **Moderate Risk**: 4-6 points (Orange, #f59e0b)
- **High Risk**: 7-10 points (Red, #ef4444)
- **Critical**: 11+ points (Dark Red, #991b1b)

### Step 6: Add Risk Score Display (Optional)

Add a "Risk Score Display" field to show real-time risk to the user filling the form:
1. Drag "Risk Score Display" field to form
2. Configure display type (Gauge, Badge, or Bar)
3. Position it at the end of the form

### Step 7: Preview & Test

Click "Preview" to test the form:
- Fill out fields with different values
- Watch risk score update in real-time
- Verify thresholds trigger correct risk levels

### Step 8: Publish Form

Click "Publish" to make form available

## Example: Physiotherapy Assessment Risk Scoring

### Fields with Risk Rules

| Field | Type | Rule Type | Scoring |
|-------|------|-----------|---------|
| Pain Intensity | Pain Scale | Range | 0-3: 1pt, 4-6: 2pt, 7-10: 3pt |
| Walking Ability | Severity Rating | Categorical | Independent: 0, With aid: 1, With assist: 2, Unable: 3 |
| Fall Risk | Radio | Categorical | No falls: 0, 1 fall: 1, 2+ falls: 2 |
| Age | Number | Range | <60: 0, 60-69: 1, 70-79: 2, 80+: 3 |
| Comorbidities | Checkbox | Count | 0: 0pt, 1-2: 1pt, 3+: 2pt |

### Risk Thresholds

- **Low (0-4)**: Standard PT protocol, weekly sessions
- **Moderate (5-7)**: Enhanced monitoring, 2-3x/week sessions
- **High (8-10)**: Daily sessions, frequent reassessment
- **Critical (11+)**: Immediate physician consult, intensive PT

### Interpretation

**Patient A: Low Risk (3 points)**
- Pain: 2/10 (1 pt)
- Walking: Independent (0 pt)
- Falls: No falls (0 pt)
- Age: 55 (0 pt)
- Comorbidities: 2 (1 pt)

**Action**: Standard care, weekly follow-up

**Patient B: High Risk (9 points)**
- Pain: 8/10 (3 pt)
- Walking: Unable (3 pt)
- Falls: 2+ falls (2 pt)
- Age: 75 (2 pt)
- Comorbidities: 3+ (2 pt)

**Action**: Immediate attention, daily PT, physician consult

## Best Practices

### 1. Use Evidence-Based Scoring

Base your risk rules on clinical guidelines:
- Fall risk: Use Morse Fall Scale or similar
- Pain assessment: Use WHO pain ladder
- Functional status: Use ECOG or Karnofsky scales
- Vital signs: Use age-appropriate normal ranges

### 2. Don't Over-Score

Keep total number of scored fields reasonable (5-10 fields max). Too many fields makes interpretation difficult.

### 3. Validate with Clinicians

Have healthcare providers review and validate risk thresholds. Adjust based on their clinical judgment.

### 4. Set Appropriate Thresholds

Risk levels should match your care capacity:
- If 50% of patients are "high risk", thresholds are too low
- Aim for 15-20% high risk, 30-40% moderate, 40-50% low

### 5. Review and Adjust

Monitor risk score distribution over time. Refine rules based on outcomes:
- Are high-risk patients actually experiencing poor outcomes?
- Are low-risk patients being under-served?

### 6. Combine with Clinical Judgment

Risk scores are **decision support, not decision replacement**. Always defer to clinician judgment.

## Common Use Cases

### 1. Geriatric Patient Care (GPC) Screening

**Goal**: Identify elderly patients needing enhanced services

**Risk Factors**:
- Age (70+)
- Multiple comorbidities (3+)
- Cognitive impairment
- Functional decline
- Lack of social support
- Recent hospitalization

**Outcome**: High-risk patients → Physiotherapy, MSW counselling, home care

### 2. Post-Operative Risk Assessment

**Goal**: Predict complications and readmission risk

**Risk Factors**:
- Surgery type (major vs minor)
- Vital sign abnormalities
- Pain level (uncontrolled pain)
- Nausea/vomiting
- Mobility issues

**Outcome**: High-risk → Extended monitoring, frequent follow-up

### 3. Chronic Disease Management

**Goal**: Identify patients at risk of exacerbation

**Risk Factors** (Diabetes example):
- HbA1c level
- Blood glucose variability
- Medication adherence
- Foot ulcers
- Complications present

**Outcome**: High-risk → Intensive case management, specialist referral

### 4. Mental Health Screening

**Goal**: Identify patients needing psychiatric intervention

**Risk Factors**:
- Depression symptoms (PHQ-9 score)
- Anxiety symptoms (GAD-7 score)
- Suicidal ideation
- Substance use
- Social isolation

**Outcome**: High-risk → MSW counselling, psychiatrist referral, crisis intervention

## Troubleshooting

### Issue: All Patients Showing Low Risk

**Cause**: Thresholds too high or scoring too lenient

**Solution**:
- Review risk rule scores (are they too low?)
- Lower high-risk threshold
- Add more scored fields

### Issue: All Patients Showing High Risk

**Cause**: Thresholds too low or scoring too strict

**Solution**:
- Review risk rule scores (are they too high?)
- Raise high-risk threshold
- Remove some scored fields

### Issue: Risk Score Not Calculating

**Cause**:
- No risk rules defined
- Field IDs don't match
- Field not answered (null value)

**Solution**:
- Verify risk rules exist in Risk Rules tab
- Check field IDs match exactly
- Set default values for critical fields

### Issue: Risk Level Wrong Color

**Cause**: Risk levels not configured properly

**Solution**:
- Go to Risk Levels tab
- Verify min/max scores don't overlap
- Ensure color codes are valid hex colors

## API Reference

### Calculate Risk Score

**Endpoint**: `POST /api/submissions/{submission_id}/calculate-risk`

**Request**: (no body needed)

**Response**:
```json
{
  "submission_id": "uuid",
  "total_score": 8.5,
  "risk_level": "HIGH",
  "field_scores": {
    "pain_intensity": 3,
    "walking_ability": 3,
    "age": 2,
    "comorbidities": 1
  },
  "calculated_at": "2026-02-27T10:30:00Z"
}
```

### Get Risk Rules for Form

**Endpoint**: `GET /api/forms/{form_id}/risk-rules`

**Response**:
```json
{
  "form_id": "uuid",
  "risk_rules": [
    {
      "id": "uuid",
      "field_id": "pain_intensity",
      "rule_type": "range",
      "condition": {
        "low": {"lower": 0, "upper": 3, "score": 1},
        "moderate": {"lower": 4, "upper": 6, "score": 2},
        "high": {"lower": 7, "upper": 10, "score": 3}
      }
    }
  ]
}
```

## Glossary

- **Risk Score**: Numeric value representing patient's overall risk level
- **Risk Rule**: Configuration that assigns points based on field value
- **Risk Level**: Categorical classification (Low, Moderate, High, Critical)
- **Risk Threshold**: Score cutoff that determines risk level
- **Range Rule**: Risk rule for numeric fields with value ranges
- **Categorical Rule**: Risk rule for select/radio fields with discrete options

## Next Steps

1. Review existing forms that would benefit from risk scoring
2. Identify key risk factors for your patient population
3. Configure risk rules for 1-2 pilot forms
4. Train staff on interpreting risk scores
5. Monitor and refine based on outcomes

## Support

For questions or assistance:
- Review full documentation in `docs/HEALTHCARE_FORM_BUILDER_PLAN.md`
- Consult with clinical team for risk factor validation
- Contact IT support for technical issues

---

**Document Version**: 1.0
**Last Updated**: February 27, 2026
**Status**: ✅ Complete
