# Feature Specification: Patient Cohort Analysis

## 📋 Overview

**Feature ID**: FEAT-002
**Priority**: High
**Complexity**: Medium-High
**Estimated Effort**: 2-3 weeks
**Dependencies**: Analytics Dashboard (FEAT-001), Patient Search

### Purpose
Enable healthcare professionals to group patients based on clinical, demographic, and behavioral criteria for targeted interventions, research studies, and quality improvement initiatives.

### Business Value
- **Targeted Care**: Identify high-risk patients for proactive interventions
- **Population Health**: Track outcomes for specific patient groups
- **Research**: Create study cohorts for clinical research
- **Quality Improvement**: Monitor care protocols effectiveness
- **Resource Planning**: Forecast needs for specific patient populations

---

## 👥 User Stories

### As a Physician
```
GIVEN I want to monitor diabetic patients
WHEN I create a cohort with criteria "Diagnosis=Diabetes, Age>40, Last Visit>90 days"
THEN I see all matching patients
  AND I can track their HbA1c trends over time
  AND I can schedule bulk follow-up appointments
  AND I receive alerts when new patients match the criteria
```

### As a Care Coordinator
```
GIVEN I need to manage high-risk patients
WHEN I create cohorts for different risk levels
THEN I can assign care pathways to each cohort
  AND I can track protocol adherence
  AND I can measure outcome improvements
```

### As a Researcher
```
GIVEN I'm conducting a hypertension study
WHEN I create a cohort with specific inclusion/exclusion criteria
THEN I can export patient lists for IRB approval
  AND I can track enrollment progress
  AND I can anonymize data for analysis
```

---

## 🎯 Core Features

### 1. Cohort Builder
```
┌───────────────────────────────────────────────────┐
│  Create New Cohort                                │
├───────────────────────────────────────────────────┤
│  Cohort Name: [Diabetic Patients - High Risk]    │
│  Description: [Diabetes with complications...]    │
│                                                   │
│  CRITERIA                                         │
│  ┌─────────────────────────────────────────────┐ │
│  │ + Demographics                               │ │
│  │   Age Range: [40] to [75]                   │ │
│  │   Gender: [Any ▼]                           │ │
│  │   Location: [All Locations ▼]              │ │
│  │                                              │ │
│  │ + Clinical Conditions                        │ │
│  │   Diagnosis: [Diabetes Type 2]              │ │
│  │   Add: [+ Hypertension]                     │ │
│  │                                              │ │
│  │ + Lab Results                                │ │
│  │   HbA1c: [> 8.0]                           │ │
│  │   Last Measured: [Within 6 months]          │ │
│  │                                              │ │
│  │ + Activity                                   │ │
│  │   Last Visit: [More than 90 days ago]       │ │
│  │   Forms Completed: [< 2 in last year]       │ │
│  │                                              │ │
│  │ + Risk Level                                 │ │
│  │   Risk Score: [High, Critical]              │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  PREVIEW: 234 patients match these criteria      │
│                                                   │
│  [Cancel]  [Save Cohort]  [Create & View →]     │
└───────────────────────────────────────────────────┘
```

### 2. Cohort Management Dashboard
```
My Cohorts
├── Diabetic Patients - High Risk (234 patients)
│   ├── Created: 2024-02-15
│   ├── Auto-updated: Yes
│   ├── Last sync: 2 hours ago
│   └── Actions: [View] [Edit] [Export] [Archive]
│
├── Hypertension Monitoring (156 patients)
├── Post-Surgery Follow-up (45 patients)
├── Chronic Pain Management (89 patients)
└── Pregnant Women - High Risk (23 patients)

Shared Cohorts (by other physicians)
├── Cardiac Rehabilitation Program (67 patients)
└── Mental Health - Depression Screening (112 patients)
```

### 3. Cohort Detail View
```
Cohort: Diabetic Patients - High Risk
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OVERVIEW
├── Total Patients: 234
├── New Additions (7 days): 12
├── Removed (7 days): 5
├── Average Age: 58.3 years
├── Gender Split: 134 Male, 100 Female
└── Average Days Since Last Visit: 127

CLINICAL SUMMARY
├── Average HbA1c: 9.2%
├── With Complications: 67 (28.6%)
├── On Insulin: 123 (52.6%)
└── Co-morbidities: Hypertension (145), CKD (23), CAD (34)

RECENT ACTIVITY
├── Lab Results Pending: 45
├── Scheduled Appointments: 23
├── Overdue Follow-ups: 156
└── Care Protocol Adherence: 62%

ACTIONS
[📧 Send Reminder]  [📅 Schedule Appointments]
[📋 Assign Protocol]  [📊 Generate Report]  [📤 Export]

PATIENT LIST (showing 1-50 of 234)
┌──────────────────────────────────────────────────────┐
│ Name         Age  Last Visit  HbA1c  Risk  Actions  │
├──────────────────────────────────────────────────────┤
│ John Doe     55   145d ago    9.8%   High  [View]   │
│ Jane Smith   62   98d ago     8.9%   Med   [View]   │
│ ...                                                  │
└──────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Schema

```sql
-- Patient cohorts table
CREATE TABLE patient_cohorts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(id),

    -- Cohort configuration
    criteria JSONB NOT NULL, -- Flexible criteria storage
    auto_update BOOLEAN DEFAULT TRUE,
    is_dynamic BOOLEAN DEFAULT TRUE, -- Recalculate members automatically

    -- Sharing and permissions
    is_public BOOLEAN DEFAULT FALSE,
    shared_with UUID[], -- Array of user IDs with view access

    -- Metadata
    patient_count INTEGER DEFAULT 0, -- Cached count for performance
    last_calculated TIMESTAMP,
    tags VARCHAR(100)[],

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_cohort_name_per_user UNIQUE(created_by, name)
);

-- Cohort members (materialized for performance)
CREATE TABLE cohort_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_id UUID NOT NULL REFERENCES patient_cohorts(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

    -- Membership tracking
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    removed_at TIMESTAMP, -- NULL = still a member

    -- Snapshot of relevant data at time of addition
    snapshot_data JSONB, -- Age, diagnosis, lab values at time of joining

    CONSTRAINT unique_cohort_patient UNIQUE(cohort_id, patient_id)
);

-- Cohort activities log
CREATE TABLE cohort_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_id UUID NOT NULL REFERENCES patient_cohorts(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL, -- 'created', 'updated', 'patient_added', 'patient_removed', 'bulk_action'

    -- Activity details
    performed_by UUID REFERENCES users(id),
    patient_id UUID REFERENCES patients(id), -- For patient-specific activities
    details JSONB, -- Additional context

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cohort outcomes tracking
CREATE TABLE cohort_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_id UUID NOT NULL REFERENCES patient_cohorts(id) ON DELETE CASCADE,

    -- Metric definition
    metric_name VARCHAR(100) NOT NULL, -- 'avg_hba1c', 'readmission_rate', etc.
    metric_value NUMERIC,
    measurement_date DATE NOT NULL,

    -- Metadata
    measured_by UUID REFERENCES users(id),
    notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_cohort_metric_date UNIQUE(cohort_id, metric_name, measurement_date)
);

-- Indexes for performance
CREATE INDEX idx_cohorts_created_by ON patient_cohorts(created_by);
CREATE INDEX idx_cohorts_is_public ON patient_cohorts(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_cohort_members_cohort ON cohort_members(cohort_id) WHERE removed_at IS NULL;
CREATE INDEX idx_cohort_members_patient ON cohort_members(patient_id) WHERE removed_at IS NULL;
CREATE INDEX idx_cohort_activities_cohort ON cohort_activities(cohort_id);
CREATE INDEX idx_cohort_outcomes_cohort ON cohort_outcomes(cohort_id);

-- GIN index for JSONB criteria searching
CREATE INDEX idx_cohorts_criteria ON patient_cohorts USING GIN(criteria);
```

---

## 🔌 API Endpoints

### 1. Create Cohort

**POST /api/cohorts**
```javascript
Request:
{
  name: "Diabetic Patients - High Risk",
  description: "Type 2 diabetes patients with HbA1c > 8.0 and overdue follow-ups",
  criteria: {
    demographics: {
      age_range: [40, 75],
      gender: null, // Any
      location: null // Any
    },
    diagnoses: {
      include: ["Diabetes Type 2"],
      exclude: ["Type 1 Diabetes"]
    },
    lab_results: {
      hba1c: { operator: ">", value: 8.0, within_days: 180 }
    },
    activity: {
      last_visit: { operator: ">", value: 90, unit: "days" },
      forms_completed: { operator: "<", value: 2, within_days: 365 }
    },
    risk_level: ["high", "critical"]
  },
  auto_update: true,
  is_dynamic: true,
  tags: ["diabetes", "high-risk", "follow-up-needed"]
}

Response:
{
  cohort_id: "uuid",
  name: "Diabetic Patients - High Risk",
  patient_count: 234,
  created_at: "2024-03-01T10:00:00Z",
  preview: [
    {
      patient_id: "uuid",
      full_name: "John Doe",
      age: 55,
      last_visit: "2023-10-15",
      hba1c: 9.8,
      risk_level: "high"
    }
  ]
}
```

### 2. Get Cohort Details

**GET /api/cohorts/:id**
```javascript
Response:
{
  cohort: {
    id: "uuid",
    name: "Diabetic Patients - High Risk",
    description: "...",
    criteria: { /* full criteria object */ },
    patient_count: 234,
    created_by: {
      id: "uuid",
      full_name: "Dr. Smith"
    },
    created_at: "2024-02-15T10:00:00Z",
    last_calculated: "2024-03-01T08:00:00Z"
  },
  summary: {
    avg_age: 58.3,
    gender_distribution: { male: 134, female: 100 },
    avg_days_since_visit: 127,
    new_members_7d: 12,
    removed_members_7d: 5
  },
  clinical_summary: {
    avg_hba1c: 9.2,
    with_complications: 67,
    on_insulin: 123,
    comorbidities: [
      { name: "Hypertension", count: 145 },
      { name: "CKD", count: 23 }
    ]
  },
  activity_summary: {
    overdue_followups: 156,
    scheduled_appointments: 23,
    care_protocol_adherence_pct: 62
  }
}
```

### 3. List Cohort Patients

**GET /api/cohorts/:id/patients**
```javascript
Query Parameters:
- page: 1
- per_page: 50
- sort_by: "last_visit" (or "name", "age", "risk_level")
- order: "asc" / "desc"

Response:
{
  patients: [
    {
      id: "uuid",
      full_name: "John Doe",
      age: 55,
      gender: "Male",
      last_visit: "2023-10-15",
      days_since_visit: 145,
      hba1c: 9.8,
      risk_level: "high",
      snapshot_data: {
        /* Data at time of cohort addition */
      },
      added_to_cohort: "2024-02-20T10:00:00Z"
    }
  ],
  pagination: {
    page: 1,
    per_page: 50,
    total: 234,
    pages: 5
  }
}
```

### 4. Recalculate Cohort

**POST /api/cohorts/:id/recalculate**
```javascript
Request:
{
  notify_on_changes: true // Notify if members added/removed
}

Response:
{
  job_id: "uuid",
  status: "processing",
  estimated_completion: "2024-03-01T10:05:00Z"
}

// Webhook/polling result:
{
  job_id: "uuid",
  status: "completed",
  changes: {
    added: 12,
    removed: 5,
    current_count: 234
  },
  new_members: [/* patient IDs */],
  removed_members: [/* patient IDs */]
}
```

### 5. Bulk Actions on Cohort

**POST /api/cohorts/:id/actions**
```javascript
Request:
{
  action: "send_reminder", // or "schedule_appointments", "assign_protocol"
  parameters: {
    template: "diabetes_followup_reminder",
    channel: "sms", // or "email"
    schedule_for: "2024-03-05T09:00:00Z"
  }
}

Response:
{
  job_id: "uuid",
  status: "queued",
  estimated_completion: "2024-03-01T10:30:00Z",
  affected_patients: 234
}
```

### 6. Track Cohort Outcomes

**POST /api/cohorts/:id/outcomes**
```javascript
Request:
{
  metric_name: "avg_hba1c",
  metric_value: 8.5,
  measurement_date: "2024-03-01",
  notes: "After 3-month intervention program"
}

Response:
{
  outcome_id: "uuid",
  message: "Outcome recorded successfully"
}

// GET /api/cohorts/:id/outcomes/trend?metric=avg_hba1c
Response:
{
  metric_name: "avg_hba1c",
  data_points: [
    { date: "2024-01-01", value: 9.2 },
    { date: "2024-02-01", value: 8.9 },
    { date: "2024-03-01", value: 8.5 }
  ],
  trend: "improving", // or "stable", "worsening"
  change_pct: -7.6
}
```

### 7. Export Cohort

**POST /api/cohorts/:id/export**
```javascript
Request:
{
  format: "excel", // or "csv", "pdf"
  include_fields: [
    "full_name",
    "age",
    "gender",
    "diagnosis",
    "last_visit",
    "hba1c",
    "medications"
  ],
  anonymize: false, // true for research
  email_to: "researcher@hospital.com"
}

Response:
{
  export_id: "uuid",
  status: "processing",
  download_url: null // Populated when ready
}
```

---

## 🎨 Frontend Components

### Component Structure
```
src/pages/cohorts/
├── CohortsList.jsx              # All cohorts overview
├── CohortBuilder.jsx            # Create/edit cohort
├── CohortDetail.jsx             # Detailed cohort view
├── CohortPatientList.jsx        # Patients in cohort
└── components/
    ├── CriteriaBuilder.jsx      # Drag-and-drop criteria builder
    ├── CohortSummaryCard.jsx    # Summary metrics
    ├── CohortChart.jsx          # Trend visualizations
    ├── BulkActionDialog.jsx     # Bulk operations modal
    └── OutcomeTracker.jsx       # Outcome metrics over time
```

### Key Component: CriteriaBuilder.jsx
```jsx
import { useState } from 'react';
import { Plus, X } from 'lucide-react';

export default function CriteriaBuilder({ value, onChange }) {
  const [criteria, setCriteria] = useState(value || {});

  const addCriterion = (category) => {
    const newCriteria = { ...criteria };
    if (!newCriteria[category]) {
      newCriteria[category] = {};
    }
    setCriteria(newCriteria);
    onChange(newCriteria);
  };

  const updateCriterion = (category, field, value) => {
    const newCriteria = {
      ...criteria,
      [category]: {
        ...criteria[category],
        [field]: value
      }
    };
    setCriteria(newCriteria);
    onChange(newCriteria);
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Cohort Criteria</h3>

      {/* Demographics */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium">Demographics</h4>
          <button className="btn-secondary btn-sm" onClick={() => addCriterion('demographics')}>
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {criteria.demographics && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Age Range</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    className="input"
                    value={criteria.demographics.age_range?.[0] || ''}
                    onChange={(e) => updateCriterion('demographics', 'age_range', [
                      parseInt(e.target.value),
                      criteria.demographics.age_range?.[1] || 100
                    ])}
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    className="input"
                    value={criteria.demographics.age_range?.[1] || ''}
                    onChange={(e) => updateCriterion('demographics', 'age_range', [
                      criteria.demographics.age_range?.[0] || 0,
                      parseInt(e.target.value)
                    ])}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Gender</label>
                <select
                  className="input"
                  value={criteria.demographics.gender || ''}
                  onChange={(e) => updateCriterion('demographics', 'gender', e.target.value || null)}
                >
                  <option value="">Any</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Diagnoses */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium">Clinical Conditions</h4>
          <button className="btn-secondary btn-sm" onClick={() => addCriterion('diagnoses')}>
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {criteria.diagnoses && (
          <div className="space-y-2">
            <label className="form-label">Diagnosis (comma-separated)</label>
            <input
              type="text"
              className="input"
              placeholder="e.g., Diabetes Type 2, Hypertension"
              value={criteria.diagnoses.include?.join(', ') || ''}
              onChange={(e) => updateCriterion('diagnoses', 'include',
                e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              )}
            />
          </div>
        )}
      </div>

      {/* Activity */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium">Patient Activity</h4>
          <button className="btn-secondary btn-sm" onClick={() => addCriterion('activity')}>
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {criteria.activity && (
          <div className="space-y-2">
            <label className="form-label">Last Visit</label>
            <div className="flex gap-2">
              <select className="input w-32">
                <option value=">">More than</option>
                <option value="<">Less than</option>
              </select>
              <input
                type="number"
                className="input flex-1"
                placeholder="Days"
                value={criteria.activity.last_visit?.value || ''}
                onChange={(e) => updateCriterion('activity', 'last_visit', {
                  operator: '>',
                  value: parseInt(e.target.value),
                  unit: 'days'
                })}
              />
              <span className="self-center text-gray-600">days ago</span>
            </div>
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-sm text-blue-900">
          Preview: <strong>234 patients</strong> match these criteria
        </p>
      </div>
    </div>
  );
}
```

---

## 🔧 Backend Implementation

### Cohort Service
```python
# backend/app/cohorts/services.py
from sqlalchemy import and_, or_, func
from datetime import datetime, timedelta
from app.models import Patient, Diagnosis, FormSubmission, Observation
from app.extensions import db

class CohortService:

    @staticmethod
    def create_cohort(data, created_by_id):
        """Create a new patient cohort"""
        from app.models import PatientCohort

        cohort = PatientCohort(
            name=data['name'],
            description=data.get('description'),
            criteria=data['criteria'],
            auto_update=data.get('auto_update', True),
            is_dynamic=data.get('is_dynamic', True),
            tags=data.get('tags', []),
            created_by=created_by_id
        )

        db.session.add(cohort)
        db.session.commit()

        # Calculate initial members
        CohortService.recalculate_members(cohort.id)

        return cohort

    @staticmethod
    def recalculate_members(cohort_id):
        """Recalculate cohort membership based on criteria"""
        from app.models import PatientCohort, CohortMember

        cohort = PatientCohort.query.get(cohort_id)
        if not cohort:
            raise ValueError("Cohort not found")

        # Build query based on criteria
        query = Patient.query.filter(Patient.is_active == True)
        criteria = cohort.criteria

        # Apply demographics filters
        if 'demographics' in criteria:
            demo = criteria['demographics']

            # Age range
            if demo.get('age_range'):
                min_age, max_age = demo['age_range']
                from datetime import date
                max_birth_date = date.today().replace(year=date.today().year - min_age)
                min_birth_date = date.today().replace(year=date.today().year - max_age)

                query = query.filter(
                    Patient.date_of_birth.between(min_birth_date, max_birth_date)
                )

            # Gender
            if demo.get('gender'):
                query = query.filter(Patient.gender == demo['gender'])

        # Apply diagnoses filters
        if 'diagnoses' in criteria:
            diag = criteria['diagnoses']

            if diag.get('include'):
                # Patient must have at least one of these diagnoses
                query = query.join(Diagnosis).filter(
                    Diagnosis.code.in_(diag['include'])
                ).distinct()

            if diag.get('exclude'):
                # Patient must NOT have any of these diagnoses
                excluded_patient_ids = db.session.query(Diagnosis.patient_id).filter(
                    Diagnosis.code.in_(diag['exclude'])
                ).subquery()

                query = query.filter(~Patient.id.in_(excluded_patient_ids))

        # Apply activity filters
        if 'activity' in criteria:
            act = criteria['activity']

            # Last visit
            if act.get('last_visit'):
                days = act['last_visit']['value']
                operator = act['last_visit']['operator']
                cutoff_date = datetime.utcnow() - timedelta(days=days)

                # Get patients with submissions/encounters
                if operator == '>':  # More than X days ago
                    recent_activity_patients = db.session.query(FormSubmission.patient_id).filter(
                        FormSubmission.created_at >= cutoff_date
                    ).union(
                        db.session.query(Encounter.patient_id).filter(
                            Encounter.created_at >= cutoff_date
                        )
                    ).subquery()

                    query = query.filter(~Patient.id.in_(recent_activity_patients))

        # Execute query
        matching_patients = query.all()

        # Update cohort members
        # Remove patients no longer matching
        CohortMember.query.filter(
            CohortMember.cohort_id == cohort_id,
            CohortMember.removed_at == None,
            ~CohortMember.patient_id.in_([p.id for p in matching_patients])
        ).update({'removed_at': datetime.utcnow()}, synchronize_session=False)

        # Add new matching patients
        existing_member_ids = {
            m.patient_id for m in CohortMember.query.filter(
                CohortMember.cohort_id == cohort_id,
                CohortMember.removed_at == None
            ).all()
        }

        new_members = []
        for patient in matching_patients:
            if patient.id not in existing_member_ids:
                new_members.append(CohortMember(
                    cohort_id=cohort_id,
                    patient_id=patient.id,
                    snapshot_data={
                        'age': CohortService._calculate_age(patient.date_of_birth),
                        'gender': patient.gender
                        # Add more snapshot data as needed
                    }
                ))

        if new_members:
            db.session.bulk_save_objects(new_members)

        # Update cohort metadata
        cohort.patient_count = len(matching_patients)
        cohort.last_calculated = datetime.utcnow()

        db.session.commit()

        return {
            'current_count': len(matching_patients),
            'added': len(new_members),
            'removed': len(matching_patients) - len(new_members) - len(existing_member_ids)
        }

    @staticmethod
    def _calculate_age(birth_date):
        """Calculate age from birth date"""
        if not birth_date:
            return None
        from datetime import date
        today = date.today()
        return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))

    @staticmethod
    def get_cohort_summary(cohort_id):
        """Get summary statistics for a cohort"""
        from app.models import CohortMember

        members = CohortMember.query.filter(
            CohortMember.cohort_id == cohort_id,
            CohortMember.removed_at == None
        ).all()

        if not members:
            return {
                'avg_age': 0,
                'gender_distribution': {},
                'patient_count': 0
            }

        # Calculate statistics
        ages = [m.snapshot_data.get('age') for m in members if m.snapshot_data.get('age')]
        genders = [m.snapshot_data.get('gender') for m in members if m.snapshot_data.get('gender')]

        return {
            'avg_age': sum(ages) / len(ages) if ages else 0,
            'gender_distribution': {
                'male': genders.count('Male'),
                'female': genders.count('Female'),
                'other': genders.count('Other')
            },
            'patient_count': len(members)
        }
```

---

## 🧪 Testing Strategy

### Unit Tests
```python
def test_create_cohort(test_db, test_user, sample_patients):
    """Test cohort creation"""
    criteria = {
        'demographics': {
            'age_range': [40, 60],
            'gender': 'Male'
        }
    }

    cohort = CohortService.create_cohort({
        'name': 'Test Cohort',
        'criteria': criteria
    }, test_user.id)

    assert cohort.id is not None
    assert cohort.patient_count > 0

def test_cohort_recalculation(test_db, sample_cohort, sample_patients):
    """Test cohort member recalculation"""
    initial_count = sample_cohort.patient_count

    # Add new patient matching criteria
    new_patient = create_patient(age=45, gender='Male')

    result = CohortService.recalculate_members(sample_cohort.id)

    assert result['added'] == 1
    assert result['current_count'] == initial_count + 1
```

---

## 📅 Implementation Timeline

### Week 1: Database & Core Logic
- Day 1-2: Database schema + migrations
- Day 3-4: Cohort service (create, recalculate)
- Day 5: Unit tests

### Week 2: API & Frontend Foundation
- Day 1-2: API routes + integration tests
- Day 3-4: Frontend: Cohort list + builder
- Day 5: Cohort detail view

### Week 3: Advanced Features & Polish
- Day 1-2: Bulk actions + outcome tracking
- Day 3-4: Export functionality
- Day 5: Testing + documentation

---

## ✅ Acceptance Criteria

- [ ] Can create cohorts with multiple criteria types
- [ ] Cohorts auto-update when new patients match
- [ ] Can export cohort patient lists
- [ ] Can track outcome metrics over time
- [ ] Can perform bulk actions on cohorts
- [ ] Performance: Recalculation < 5 seconds for 10K patients
- [ ] Unit test coverage > 85%
- [ ] Security audit passed

---

## 🔒 Security Considerations

- **Access Control**: Users can only view cohorts they created or are shared with
- **Data Privacy**: Export with anonymization option for research
- **Audit Trail**: Log all cohort creations, modifications, bulk actions
- **Rate Limiting**: Prevent abuse of recalculation endpoint

---

## 🚀 Future Enhancements

- **ML-Based Cohorts**: Predict patients at risk of joining cohort
- **Cohort Comparison**: Compare outcomes between cohorts
- **Time-based Cohorts**: "Patients who had X in the last Y days"
- **Nested Cohorts**: Create cohorts from intersections of other cohorts
- **Visual Query Builder**: Drag-and-drop interface for criteria
