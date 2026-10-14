# Patient Management System Documentation

## Table of Contents
1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Database Schema](#database-schema)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [Integration Guide](#integration-guide)
7. [Analytics Framework](#analytics-framework)
8. [API Reference](#api-reference)
9. [Component Specifications](#component-specifications)
10. [Testing Strategy](#testing-strategy)
11. [Deployment Guide](#deployment-guide)

---

## Overview

### Purpose
The Patient Management System (PMS) extends the existing form builder application to enable patient-centric data collection. This system allows users to:
- Register and manage patient records
- Link form submissions to specific patients
- Track patient health data over time
- Generate patient-level and population-level analytics
- Maintain comprehensive audit trails

### Key Features
- **Patient Registration**: Create new patient records with demographic and ABHA information
- **Patient Search**: Fast, fuzzy search by name, phone, or ABHA ID
- **Form-Patient Linking**: Associate any form submission with a patient
- **Submission History**: View all forms submitted for a specific patient
- **Recent Patients**: Quick access to frequently accessed patients
- **Analytics Ready**: Structured data for comprehensive analysis
- **Secure & Compliant**: Encrypted sensitive data, audit trails, ABDM-ready

### Design Principles
1. **Non-Disruptive**: Existing form workflows continue unchanged
2. **Optional Integration**: Patient selection is optional per submission
3. **Backward Compatible**: All existing data and APIs preserved
4. **Gradual Adoption**: Features can be rolled out incrementally
5. **Security First**: Patient data encrypted at rest and in transit

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │  Patient     │  │   Form       │  │   Analytics     │   │
│  │  Management  │  │   Submission │  │   Dashboard     │   │
│  └──────────────┘  └──────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer (Flask)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │  Patient     │  │  Submission  │  │   Analytics     │   │
│  │  Routes      │  │  Routes      │  │   Routes        │   │
│  └──────────────┘  └──────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │  Patient     │  │  Submission  │  │   Analytics     │   │
│  │  Service     │  │  Processor   │  │   Service       │   │
│  └──────────────┘  └──────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer (PostgreSQL)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │  patients    │  │  form_       │  │   form_         │   │
│  │              │  │  submissions │  │   answers       │   │
│  └──────────────┘  └──────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Component Overview

#### Backend Components
- **Patient Routes** (`backend/app/patients/routes.py`): REST API endpoints
- **Patient Services** (`backend/app/patients/services.py`): Business logic
- **Patient Schemas** (`backend/app/patients/schemas.py`): Data validation
- **Patient Models** (`backend/app/patients/models.py`): Already exists
- **Submission Processor**: Enhanced to link submissions to patients

#### Frontend Components
- **PatientSelector**: Main UI for selecting/adding patients
- **PatientSearch**: Autocomplete search component
- **PatientQuickAdd**: Inline patient registration
- **PatientManagement**: Full patient list and detail pages
- **PatientAnalytics**: Patient-specific analytics views

---

## Database Schema

### Existing Tables (Already Implemented)

#### `patients` Table
```sql
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(255) NOT NULL,
    date_of_birth DATE,
    gender VARCHAR(50),
    phone_number_encrypted BYTEA,
    phone_number_hash VARCHAR(255),
    email_encrypted BYTEA,
    email_hash VARCHAR(255),
    address_line1 TEXT,
    address_line2 TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'India',
    abha_id_encrypted BYTEA,
    abha_id_hash VARCHAR(255),
    abha_address_encrypted BYTEA,
    abha_address_hash VARCHAR(255),
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone_encrypted BYTEA,
    emergency_contact_phone_hash VARCHAR(255),
    blood_group VARCHAR(10),
    allergies TEXT,
    chronic_conditions TEXT,
    current_medications TEXT,
    insurance_provider VARCHAR(255),
    insurance_policy_number_encrypted BYTEA,
    insurance_policy_number_hash VARCHAR(255),
    preferred_language VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);
```

#### `form_submissions` Table
```sql
CREATE TABLE form_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID REFERENCES forms(id) NOT NULL,
    patient_id UUID REFERENCES patients(id),  -- Links to patient
    encounter_id UUID REFERENCES encounters(id),
    submitted_by UUID REFERENCES users(id) NOT NULL,
    risk_score NUMERIC,
    risk_category VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `form_answers` Table
```sql
CREATE TABLE form_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES form_submissions(id) NOT NULL,
    field_id UUID REFERENCES form_fields(id) NOT NULL,
    value_text TEXT,
    value_number NUMERIC,
    value_boolean BOOLEAN,
    value_date DATE,
    value_datetime TIMESTAMP,
    value_json JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### New Tables to Add

#### `recent_patients` Table
```sql
CREATE TABLE recent_patients (
    user_id UUID REFERENCES users(id) NOT NULL,
    patient_id UUID REFERENCES patients(id) NOT NULL,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 1,
    PRIMARY KEY (user_id, patient_id)
);
```

### Indexes to Add

```sql
-- Patient search performance
CREATE INDEX idx_patients_full_name ON patients(full_name);
CREATE INDEX idx_patients_phone_hash ON patients(phone_number_hash);
CREATE INDEX idx_patients_abha_hash ON patients(abha_address_hash);
CREATE INDEX idx_patients_created_at ON patients(created_at DESC);

-- Submission queries
CREATE INDEX idx_submissions_patient_id ON form_submissions(patient_id);
CREATE INDEX idx_submissions_patient_created ON form_submissions(patient_id, created_at DESC);

-- Recent patients
CREATE INDEX idx_recent_patients_user ON recent_patients(user_id, last_accessed DESC);
```

---

## Backend Implementation

### Directory Structure

```
backend/app/patients/
├── __init__.py
├── models.py          # Already exists - Patient model
├── routes.py          # NEW - API endpoints
├── services.py        # NEW - Business logic
└── schemas.py         # NEW - Pydantic validation schemas
```

### Patient Service (`services.py`)

The service layer handles all patient-related business logic:

**Key Functions:**
- `search_patients(query, limit, offset)` - Search with fuzzy matching
- `get_patient_by_id(patient_id)` - Retrieve patient details
- `create_patient(data, created_by)` - Create new patient with validation
- `update_patient(patient_id, data, updated_by)` - Update patient info
- `get_patient_submissions(patient_id, limit, offset)` - Get submission history
- `get_recent_patients(user_id, limit)` - Get frequently accessed patients
- `track_patient_access(user_id, patient_id)` - Track recent access

**Security Features:**
- Automatic encryption of sensitive fields (phone, ABHA ID, etc.)
- Hash-based search for encrypted fields
- Audit trail for all operations
- Role-based access control integration

### Patient Routes (`routes.py`)

#### API Endpoints

```python
# Patient CRUD
GET    /api/patients                    # List/search patients
POST   /api/patients                    # Create new patient
GET    /api/patients/<id>               # Get patient details
PUT    /api/patients/<id>               # Update patient
DELETE /api/patients/<id>               # Soft delete (if needed)

# Patient History
GET    /api/patients/<id>/submissions   # Get submission history
GET    /api/patients/<id>/timeline      # Timeline view of data
GET    /api/patients/<id>/analytics     # Patient-specific analytics

# Utilities
GET    /api/patients/recent             # Recently accessed patients
POST   /api/patients/search             # Advanced search
GET    /api/patients/validate-abha      # Validate ABHA ID
POST   /api/patients/duplicate-check    # Check for duplicates
```

### Patient Schemas (`schemas.py`)

**Pydantic Schemas for Validation:**

```python
class PatientCreateSchema(BaseModel):
    full_name: str
    date_of_birth: Optional[date]
    gender: Optional[str]
    phone_number: Optional[str]
    email: Optional[EmailStr]
    address_line1: Optional[str]
    address_line2: Optional[str]
    city: Optional[str]
    state: Optional[str]
    postal_code: Optional[str]
    country: str = "India"
    abha_id: Optional[str]
    abha_address: Optional[str]
    emergency_contact_name: Optional[str]
    emergency_contact_phone: Optional[str]
    blood_group: Optional[str]
    allergies: Optional[str]
    chronic_conditions: Optional[str]
    current_medications: Optional[str]
    preferred_language: Optional[str]
    notes: Optional[str]

class PatientUpdateSchema(BaseModel):
    # Same fields as create, all optional
    pass

class PatientResponseSchema(BaseModel):
    id: UUID
    full_name: str
    date_of_birth: Optional[date]
    gender: Optional[str]
    age: Optional[int]  # Calculated field
    # ... other fields (excluding encrypted data)
    created_at: datetime
    updated_at: datetime

class PatientSearchResultSchema(BaseModel):
    patients: List[PatientResponseSchema]
    total: int
    page: int
    per_page: int
```

### Integration with Submission Flow

**Update Submission Endpoint:**

```python
# backend/app/submissions/routes.py

@submissions_bp.route('/submissions', methods=['POST'])
@jwt_required()
def create_submission():
    data = request.get_json()
    form_id = data.get('form_id')
    patient_id = data.get('patient_id')  # NEW: Optional patient linkage
    answers = data.get('data', {})

    # Validate patient exists if provided
    if patient_id:
        patient = Patient.query.get(patient_id)
        if not patient:
            return jsonify({'error': 'Patient not found'}), 404

    # Create submission (existing logic)
    submission = SubmissionProcessor.process(
        form_id=form_id,
        patient_id=patient_id,  # Pass patient_id
        answers=answers,
        submitted_by=current_user.id
    )

    # Track recent patient access
    if patient_id:
        PatientService.track_patient_access(current_user.id, patient_id)

    return jsonify(submission.to_dict()), 201
```

---

## Frontend Implementation

### Component Structure

```
frontend/src/
├── components/
│   └── patients/
│       ├── PatientSelector.jsx       # Main selector component
│       ├── PatientSearch.jsx         # Search with autocomplete
│       ├── PatientQuickAdd.jsx       # Quick registration modal
│       ├── PatientCard.jsx           # Display patient info
│       ├── RecentPatients.jsx        # Recent patients list
│       └── PatientBadge.jsx          # Compact patient display
├── pages/
│   └── patients/
│       ├── PatientsList.jsx          # Patient management page
│       ├── PatientDetail.jsx         # Patient profile & history
│       └── PatientAnalytics.jsx      # Patient-specific analytics
├── store/
│   └── patientSlice.js               # Redux state management
├── services/
│   └── patientService.js             # API calls
└── hooks/
    └── usePatientSearch.js           # Search hook
```

### Key Components

#### 1. PatientSelector Component

**Purpose**: Main UI for selecting a patient before form submission

**Features:**
- Search existing patients
- Display recent patients
- Quick-add new patient
- Optional (can be skipped)
- Shows selected patient context

**Props:**
```javascript
<PatientSelector
  value={selectedPatient}
  onChange={handlePatientChange}
  required={false}
  showRecent={true}
  allowCreate={true}
  onPatientCreated={handleNewPatient}
/>
```

**UI Flow:**
1. User clicks "Select Patient" button
2. Modal/dropdown shows:
   - Search bar
   - Recent patients (if any)
   - "Register New Patient" button
3. User selects or creates patient
4. Patient info displayed above form
5. Submission includes patient_id

#### 2. PatientSearch Component

**Purpose**: Autocomplete search with debouncing

**Features:**
- Real-time search as user types
- Search by name, phone, ABHA ID
- Fuzzy matching
- Display matching results
- Keyboard navigation

**Implementation:**
```javascript
const PatientSearch = ({ onSelect, autoFocus }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const debouncedSearch = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedSearch.length >= 2) {
      searchPatients(debouncedSearch);
    }
  }, [debouncedSearch]);

  const searchPatients = async (q) => {
    setLoading(true);
    const data = await patientService.search(q);
    setResults(data.patients);
    setLoading(false);
  };

  return (
    <Autocomplete
      options={results}
      loading={loading}
      getOptionLabel={(p) => `${p.full_name} - ${p.phone}`}
      onSelect={onSelect}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Search by name, phone, or ABHA ID"
          autoFocus={autoFocus}
        />
      )}
    />
  );
};
```

#### 3. PatientQuickAdd Component

**Purpose**: Inline patient registration without leaving form

**Features:**
- Minimal required fields (name, DOB, gender)
- Optional fields collapsible
- Client-side validation
- Server-side duplicate check
- Auto-select after creation

**Form Fields:**
- **Required**: Full name, Date of birth, Gender
- **Optional**: Phone, Email, ABHA ID, Address
- **Expandable**: Medical history, Emergency contact

#### 4. PatientsList Page

**Purpose**: Full patient management interface

**Features:**
- Paginated patient list
- Advanced search and filters
- Sort by name, date, recent access
- Bulk actions (export, etc.)
- Click to view patient detail

**Filters:**
- Name search
- Age range
- Gender
- Date registered range
- Has ABHA ID
- Recent submissions

#### 5. PatientDetail Page

**Purpose**: Comprehensive patient profile

**Sections:**
1. **Patient Info**: Demographics, contact, medical history
2. **Submission History**: All forms submitted for this patient
3. **Timeline**: Chronological view of data points
4. **Analytics**: Patient-specific charts and trends
5. **Actions**: Edit, export, share (with permissions)

### State Management (`patientSlice.js`)

**Redux Slice for Patient Data:**

```javascript
const patientSlice = createSlice({
  name: 'patients',
  initialState: {
    selectedPatient: null,
    recentPatients: [],
    searchResults: [],
    patientDetail: null,
    loading: false,
    error: null
  },
  reducers: {
    setSelectedPatient: (state, action) => {
      state.selectedPatient = action.payload;
    },
    setRecentPatients: (state, action) => {
      state.recentPatients = action.payload;
    },
    addRecentPatient: (state, action) => {
      // Add to recent, remove duplicates, limit to 10
    },
    // ... other reducers
  },
  extraReducers: (builder) => {
    // Async thunks for API calls
  }
});
```

### API Service (`patientService.js`)

```javascript
const patientService = {
  search: async (query, limit = 20) => {
    const response = await api.get('/patients', { params: { q: query, limit } });
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/patients/${id}`);
    return response.data;
  },

  create: async (patientData) => {
    const response = await api.post('/patients', patientData);
    return response.data;
  },

  update: async (id, patientData) => {
    const response = await api.put(`/patients/${id}`, patientData);
    return response.data;
  },

  getSubmissions: async (id, page = 1, perPage = 20) => {
    const response = await api.get(`/patients/${id}/submissions`, {
      params: { page, per_page: perPage }
    });
    return response.data;
  },

  getRecent: async (limit = 10) => {
    const response = await api.get('/patients/recent', { params: { limit } });
    return response.data;
  }
};
```

---

## Integration Guide

### Integrating Patient Selection with Form Submission

#### Step 1: Update FormSubmit Page

```javascript
// frontend/src/pages/forms/FormSubmit.jsx

import PatientSelector from '../../components/patients/PatientSelector';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectedPatient } from '../../store/patientSlice';

const FormSubmit = () => {
  const dispatch = useDispatch();
  const selectedPatient = useSelector(state => state.patients.selectedPatient);
  const [formData, setFormData] = useState({});

  const handlePatientChange = (patient) => {
    dispatch(setSelectedPatient(patient));
  };

  const handleSubmit = async () => {
    const submissionData = {
      form_id: formId,
      patient_id: selectedPatient?.id,  // Optional patient linkage
      data: formData
    };

    await submissionService.create(submissionData);
  };

  return (
    <div>
      {/* Patient Selector - Optional but recommended */}
      <PatientSelector
        value={selectedPatient}
        onChange={handlePatientChange}
        required={false}
        showRecent={true}
      />

      {/* Show selected patient context */}
      {selectedPatient && (
        <PatientBadge patient={selectedPatient} />
      )}

      {/* Existing form renderer */}
      <FormRenderer
        form={form}
        data={formData}
        onChange={setFormData}
      />

      <Button onClick={handleSubmit}>Submit</Button>
    </div>
  );
};
```

#### Step 2: Backward Compatibility

The system maintains full backward compatibility:

```javascript
// If patient_id is null, submission works as before
const submissionData = {
  form_id: formId,
  patient_id: null,  // No patient linked
  data: formData
};

// Existing submissions without patients remain valid
// No breaking changes to API or database
```

#### Step 3: Gradual Rollout

**Feature Flag Approach:**

```javascript
// config.js
export const FEATURES = {
  PATIENT_MANAGEMENT: true,  // Toggle patient features
  REQUIRE_PATIENT: false,     // Make patient optional/required
  PATIENT_ANALYTICS: true     // Enable analytics
};

// Usage
{FEATURES.PATIENT_MANAGEMENT && (
  <PatientSelector ... />
)}
```

---

## Analytics Framework

### Patient-Level Analytics

#### 1. Submission Timeline

**Visualization**: Timeline chart showing all submissions for a patient

**Data Points:**
- Submission date/time
- Form name
- Risk score
- Key parameters (BP, glucose, etc.)

**Implementation:**
```javascript
const PatientTimeline = ({ patientId }) => {
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    loadSubmissions();
  }, [patientId]);

  const loadSubmissions = async () => {
    const data = await patientService.getSubmissions(patientId);
    setSubmissions(data.submissions);
  };

  return (
    <TimelineChart
      data={submissions}
      xField="created_at"
      yField="risk_score"
      groupBy="form_name"
    />
  );
};
```

#### 2. Risk Score Progression

**Visualization**: Line chart tracking risk scores over time

**Features:**
- Multiple forms on same chart
- Threshold markers
- Trend analysis
- Predictive indicators

#### 3. Clinical Parameter Trends

**Visualization**: Multi-line charts for vital signs

**Parameters:**
- Blood pressure (systolic/diastolic)
- Heart rate
- Blood glucose
- BMI
- Temperature
- Custom parameters from form fields

**Implementation:**
```sql
-- Query to extract parameter trends
SELECT
  fs.created_at,
  ff.field_label,
  fa.value_number
FROM form_submissions fs
JOIN form_answers fa ON fa.submission_id = fs.id
JOIN form_fields ff ON ff.id = fa.field_id
WHERE fs.patient_id = ?
  AND ff.field_type IN ('number', 'calculated')
  AND ff.field_label IN ('Blood Pressure', 'Heart Rate', 'Glucose')
ORDER BY fs.created_at;
```

### Population Analytics

#### 1. Demographics Dashboard

**Metrics:**
- Age distribution (histogram)
- Gender breakdown (pie chart)
- Geographic distribution (map)
- Language preferences

**Filters:**
- Date range
- Age groups
- Geographic regions
- Risk categories

#### 2. Risk Stratification

**Visualization**: Funnel chart showing patient distribution by risk

**Categories:**
- Low risk: 0-25
- Moderate risk: 26-50
- High risk: 51-75
- Critical risk: 76-100

**Actions:**
- Click to drill down to patient list
- Export high-risk patients
- Generate intervention reports

#### 3. Submission Analytics

**Metrics:**
- Total submissions per day/week/month
- Average submissions per patient
- Form completion rates
- Response time analytics
- Field-level completion rates

#### 4. Cohort Analysis

**Features:**
- Define custom cohorts (e.g., "Diabetic patients", "Age 60+")
- Compare metrics across cohorts
- Track cohort progression over time
- Export cohort data for research

**Example Cohorts:**
```sql
-- High-risk diabetic patients
SELECT p.* FROM patients p
JOIN form_submissions fs ON fs.patient_id = p.id
WHERE p.chronic_conditions LIKE '%diabetes%'
  AND fs.risk_score > 50;

-- Patients with multiple submissions
SELECT p.*, COUNT(fs.id) as submission_count
FROM patients p
JOIN form_submissions fs ON fs.patient_id = p.id
GROUP BY p.id
HAVING COUNT(fs.id) >= 3;
```

---

## API Reference

### Authentication

All endpoints require JWT authentication:
```
Authorization: Bearer <token>
```

### Patient Endpoints

#### List/Search Patients

```http
GET /api/patients?q={query}&page={page}&per_page={limit}
```

**Query Parameters:**
- `q` (string): Search query (name, phone, ABHA)
- `page` (integer): Page number (default: 1)
- `per_page` (integer): Results per page (default: 20)
- `sort_by` (string): Sort field (default: created_at)
- `sort_order` (string): asc/desc (default: desc)

**Response:**
```json
{
  "patients": [
    {
      "id": "uuid",
      "full_name": "John Doe",
      "date_of_birth": "1990-01-15",
      "age": 36,
      "gender": "Male",
      "phone": "+91-9876543210",
      "city": "Bangalore",
      "has_abha": true,
      "submission_count": 5,
      "last_submission": "2025-02-28T10:30:00Z",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "per_page": 20,
  "total_pages": 8
}
```

#### Get Patient by ID

```http
GET /api/patients/{id}
```

**Response:**
```json
{
  "id": "uuid",
  "full_name": "John Doe",
  "date_of_birth": "1990-01-15",
  "age": 36,
  "gender": "Male",
  "phone": "+91-9876543210",
  "email": "john@example.com",
  "address_line1": "123 Main Street",
  "city": "Bangalore",
  "state": "Karnataka",
  "postal_code": "560001",
  "country": "India",
  "abha_address": "john.doe@abdm",
  "blood_group": "O+",
  "allergies": "Penicillin",
  "chronic_conditions": "Hypertension",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2025-02-15T10:00:00Z"
}
```

#### Create Patient

```http
POST /api/patients
Content-Type: application/json
```

**Request Body:**
```json
{
  "full_name": "Jane Smith",
  "date_of_birth": "1985-06-20",
  "gender": "Female",
  "phone_number": "+91-9876543211",
  "email": "jane@example.com",
  "address_line1": "456 Park Avenue",
  "city": "Mumbai",
  "state": "Maharashtra",
  "postal_code": "400001",
  "abha_address": "jane.smith@abdm",
  "blood_group": "A+",
  "preferred_language": "English"
}
```

**Response:** `201 Created`
```json
{
  "id": "new-uuid",
  "full_name": "Jane Smith",
  ...
}
```

#### Update Patient

```http
PUT /api/patients/{id}
Content-Type: application/json
```

**Request Body:** (same as create, all fields optional)

**Response:** `200 OK`

#### Get Patient Submissions

```http
GET /api/patients/{id}/submissions?page={page}&per_page={limit}
```

**Response:**
```json
{
  "submissions": [
    {
      "id": "uuid",
      "form_id": "uuid",
      "form_name": "General Health Screening",
      "risk_score": 35.5,
      "risk_category": "Low",
      "submitted_by": "Dr. Smith",
      "created_at": "2025-02-28T10:30:00Z"
    }
  ],
  "total": 12,
  "page": 1,
  "per_page": 10
}
```

#### Get Recent Patients

```http
GET /api/patients/recent?limit={limit}
```

**Response:**
```json
{
  "patients": [
    {
      "id": "uuid",
      "full_name": "John Doe",
      "last_accessed": "2025-03-01T09:00:00Z",
      "access_count": 15
    }
  ]
}
```

#### Advanced Search

```http
POST /api/patients/search
Content-Type: application/json
```

**Request Body:**
```json
{
  "query": "john",
  "filters": {
    "gender": "Male",
    "age_min": 30,
    "age_max": 50,
    "city": "Bangalore",
    "has_abha": true,
    "has_submissions": true
  },
  "sort_by": "last_submission",
  "sort_order": "desc",
  "page": 1,
  "per_page": 20
}
```

### Submission Endpoints (Updated)

#### Create Submission

```http
POST /api/submissions
Content-Type: application/json
```

**Request Body:**
```json
{
  "form_id": "uuid",
  "patient_id": "uuid",  // NEW: Optional patient linkage
  "data": {
    "field_id_1": "value1",
    "field_id_2": 123,
    "field_id_3": true
  }
}
```

**Response:** `201 Created`
```json
{
  "id": "submission-uuid",
  "form_id": "uuid",
  "patient_id": "uuid",
  "risk_score": 42.5,
  "risk_category": "Moderate",
  "created_at": "2025-03-01T10:00:00Z"
}
```

---

## Component Specifications

### PatientSelector Component

**File:** `frontend/src/components/patients/PatientSelector.jsx`

**Props:**
```typescript
interface PatientSelectorProps {
  value: Patient | null;
  onChange: (patient: Patient | null) => void;
  required?: boolean;
  showRecent?: boolean;
  allowCreate?: boolean;
  disabled?: boolean;
  placeholder?: string;
  onPatientCreated?: (patient: Patient) => void;
}
```

**State:**
```typescript
interface PatientSelectorState {
  isOpen: boolean;
  searchQuery: string;
  searchResults: Patient[];
  recentPatients: Patient[];
  showQuickAdd: boolean;
  loading: boolean;
}
```

**Behavior:**
1. Click to open modal/dropdown
2. Display recent patients (if enabled)
3. Show search bar with autocomplete
4. "Register New Patient" button (if enabled)
5. Select patient → close modal, trigger onChange
6. Clear button to deselect patient

### PatientQuickAdd Component

**File:** `frontend/src/components/patients/PatientQuickAdd.jsx`

**Props:**
```typescript
interface PatientQuickAddProps {
  onCancel: () => void;
  onSuccess: (patient: Patient) => void;
  defaultValues?: Partial<Patient>;
}
```

**Form Fields:**
```typescript
interface QuickAddForm {
  // Required
  full_name: string;
  date_of_birth: Date;
  gender: string;

  // Optional (collapsible)
  phone_number?: string;
  email?: string;
  abha_address?: string;
  address_line1?: string;
  city?: string;
  state?: string;

  // Expandable section
  blood_group?: string;
  allergies?: string;
  chronic_conditions?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
}
```

**Validation:**
- Full name: Required, min 2 characters
- Date of birth: Required, must be in past, age < 150
- Gender: Required, predefined options
- Phone: Optional, must be valid format
- Email: Optional, must be valid email
- ABHA: Optional, validate format if provided

**Behavior:**
1. Display minimal form by default
2. "Show more fields" to expand
3. Client-side validation on blur
4. Server-side duplicate check on submit
5. Success → close modal, auto-select created patient
6. Error → display error messages inline

### PatientCard Component

**File:** `frontend/src/components/patients/PatientCard.jsx`

**Props:**
```typescript
interface PatientCardProps {
  patient: Patient;
  variant?: 'compact' | 'detailed';
  showActions?: boolean;
  onEdit?: () => void;
  onViewHistory?: () => void;
}
```

**Display:**
```
┌─────────────────────────────────────────┐
│ 👤 John Doe                             │
│    M, 36 years                          │
│    📱 +91-9876543210                    │
│    🏥 ABHA: john.doe@abdm               │
│    📍 Bangalore, Karnataka              │
│    📊 5 submissions                     │
│    ⏰ Last: 2025-02-28                  │
│    [View History] [Edit]                │
└─────────────────────────────────────────┘
```

---

## Testing Strategy

### Unit Tests

#### Backend Unit Tests

```python
# tests/unit/test_patient_service.py

def test_create_patient():
    patient_data = {
        'full_name': 'Test Patient',
        'date_of_birth': '1990-01-01',
        'gender': 'Male'
    }
    patient = PatientService.create_patient(patient_data, user_id)
    assert patient.full_name == 'Test Patient'
    assert patient.phone_number_encrypted is None

def test_search_patients_by_name():
    results = PatientService.search_patients('john')
    assert len(results) > 0
    assert 'john' in results[0].full_name.lower()

def test_patient_phone_encryption():
    patient = PatientService.create_patient({
        'full_name': 'Test',
        'phone_number': '+91-9876543210'
    }, user_id)
    assert patient.phone_number_encrypted is not None
    assert patient.phone_number_hash is not None
```

#### Frontend Unit Tests

```javascript
// tests/components/PatientSelector.test.jsx

describe('PatientSelector', () => {
  it('renders search input', () => {
    render(<PatientSelector onChange={jest.fn()} />);
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('displays recent patients when opened', async () => {
    const recentPatients = [{ id: '1', full_name: 'John Doe' }];
    mockAPI.getRecent.mockResolvedValue({ patients: recentPatients });

    render(<PatientSelector showRecent={true} onChange={jest.fn()} />);
    fireEvent.click(screen.getByText(/select patient/i));

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  it('calls onChange when patient selected', async () => {
    const onChange = jest.fn();
    render(<PatientSelector onChange={onChange} />);

    // Simulate patient selection
    fireEvent.click(screen.getByText('John Doe'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ full_name: 'John Doe' })
    );
  });
});
```

### Integration Tests

```python
# tests/integration/test_patient_submission_flow.py

def test_create_submission_with_patient():
    # Create patient
    patient = create_test_patient()

    # Create form
    form = create_test_form()

    # Submit form with patient linkage
    response = client.post('/api/submissions', json={
        'form_id': form.id,
        'patient_id': patient.id,
        'data': {'field1': 'value1'}
    }, headers=auth_headers)

    assert response.status_code == 201
    submission = response.json()
    assert submission['patient_id'] == str(patient.id)

    # Verify patient can be retrieved with submissions
    response = client.get(f'/api/patients/{patient.id}/submissions',
                         headers=auth_headers)
    assert len(response.json()['submissions']) == 1
```

### E2E Tests

```javascript
// tests/e2e/patient-form-submission.spec.js

describe('Patient Form Submission Flow', () => {
  it('should submit form with patient selection', async () => {
    await page.goto('/forms/123/submit');

    // Select patient
    await page.click('[data-testid="select-patient-btn"]');
    await page.fill('[data-testid="patient-search"]', 'John Doe');
    await page.click('[data-testid="patient-result-0"]');

    // Verify patient selected
    await expect(page.locator('[data-testid="selected-patient"]'))
      .toContainText('John Doe');

    // Fill form
    await page.fill('[name="field1"]', 'test value');

    // Submit
    await page.click('[data-testid="submit-btn"]');

    // Verify success
    await expect(page.locator('[data-testid="success-message"]'))
      .toBeVisible();
  });

  it('should allow quick patient registration', async () => {
    await page.goto('/forms/123/submit');

    // Open patient selector
    await page.click('[data-testid="select-patient-btn"]');

    // Click "Register New Patient"
    await page.click('[data-testid="register-patient-btn"]');

    // Fill quick add form
    await page.fill('[name="full_name"]', 'New Patient');
    await page.fill('[name="date_of_birth"]', '1990-01-01');
    await page.selectOption('[name="gender"]', 'Male');

    // Submit
    await page.click('[data-testid="create-patient-btn"]');

    // Verify patient auto-selected
    await expect(page.locator('[data-testid="selected-patient"]'))
      .toContainText('New Patient');
  });
});
```

### Performance Tests

```python
# tests/performance/test_patient_search.py

def test_patient_search_performance():
    # Create 10,000 test patients
    create_bulk_patients(10000)

    import time
    start = time.time()

    results = PatientService.search_patients('john')

    elapsed = time.time() - start

    # Search should complete in < 200ms
    assert elapsed < 0.2
    assert len(results) > 0
```

---

## Deployment Guide

### Pre-Deployment Checklist

- [ ] Backend patient routes implemented
- [ ] Database indexes created
- [ ] Frontend components built
- [ ] API integration tested
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Documentation complete
- [ ] Security audit passed
- [ ] Performance benchmarks met

### Database Migration

```bash
# Create database migration
python -m flask db revision -m "Add patient management indexes and recent_patients table"

# Edit migration file
# migrations/versions/xxxxx_add_patient_indexes.py

def upgrade():
    # Add indexes
    op.create_index('idx_patients_full_name', 'patients', ['full_name'])
    op.create_index('idx_patients_phone_hash', 'patients', ['phone_number_hash'])
    op.create_index('idx_patients_abha_hash', 'patients', ['abha_address_hash'])
    op.create_index('idx_submissions_patient_id', 'form_submissions', ['patient_id'])

    # Create recent_patients table
    op.create_table(
        'recent_patients',
        sa.Column('user_id', postgresql.UUID(), nullable=False),
        sa.Column('patient_id', postgresql.UUID(), nullable=False),
        sa.Column('last_accessed', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('access_count', sa.INTEGER(), server_default='1'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id']),
        sa.PrimaryKeyConstraint('user_id', 'patient_id')
    )

    op.create_index('idx_recent_patients_user', 'recent_patients', ['user_id', 'last_accessed'])

def downgrade():
    op.drop_index('idx_recent_patients_user')
    op.drop_table('recent_patients')
    op.drop_index('idx_submissions_patient_id')
    op.drop_index('idx_patients_abha_hash')
    op.drop_index('idx_patients_phone_hash')
    op.drop_index('idx_patients_full_name')

# Run migration
python -m flask db upgrade
```

### Deployment Steps

#### 1. Backend Deployment

```bash
# 1. Backup database
pg_dump cv_raman_health > backup_$(date +%Y%m%d).sql

# 2. Pull latest code
git pull origin main

# 3. Install dependencies
cd backend
pip install -r requirements.txt

# 4. Run migrations
python -m flask db upgrade

# 5. Restart backend server
systemctl restart cv-raman-backend
```

#### 2. Frontend Deployment

```bash
# 1. Build frontend
cd frontend
npm install
npm run build

# 2. Deploy to server
rsync -avz build/ user@server:/var/www/cv-raman-health/

# 3. Restart nginx
systemctl restart nginx
```

#### 3. Verify Deployment

```bash
# Test backend endpoints
curl -X GET https://api.yourapp.com/api/patients \
  -H "Authorization: Bearer $TOKEN"

# Test frontend
curl https://yourapp.com/patients

# Check logs
tail -f /var/log/cv-raman-health/backend.log
tail -f /var/log/nginx/access.log
```

### Rollback Plan

If issues occur:

```bash
# 1. Rollback database
psql cv_raman_health < backup_YYYYMMDD.sql

# 2. Revert code
git revert HEAD

# 3. Rebuild and redeploy
npm run build
systemctl restart cv-raman-backend nginx

# 4. Verify rollback
curl https://api.yourapp.com/health
```

### Monitoring

**Key Metrics to Monitor:**
- Patient search response time (target: <200ms)
- Patient creation success rate (target: >99%)
- API error rate (target: <0.1%)
- Database query performance
- Recent patients cache hit rate

**Alerts:**
- Patient search taking >500ms
- Patient creation failures >1%
- Database connection errors
- Disk space on patient data storage

---

## Security Considerations

### Data Encryption

**Encrypted Fields:**
- Phone numbers
- Email addresses
- ABHA ID
- ABHA address
- Emergency contact phone
- Insurance policy numbers

**Encryption Method:**
- AES-256-GCM encryption
- Unique encryption key per installation
- Hash stored for search purposes
- Decryption only on authorized access

### Access Control

**Role-Based Permissions:**
- **Admin**: Full patient access (create, read, update, delete)
- **Healthcare Provider**: Create, read, update patients
- **Data Entry**: Create patients, read limited info
- **Analyst**: Read-only, no PII access

**Audit Logging:**
- All patient operations logged
- User ID, timestamp, action recorded
- IP address and user agent stored
- Compliance with HIPAA/ABDM requirements

### Input Validation

**Server-Side Validation:**
- All inputs sanitized to prevent SQL injection
- XSS prevention on text fields
- ABHA ID format validation
- Phone number format validation
- Email format validation

**Rate Limiting:**
- Patient search: 60 requests/minute
- Patient creation: 10 requests/minute
- Prevents brute force attacks

---

## Future Enhancements

### Phase 4: Advanced Features (Future)

1. **ABDM Integration**
   - Real-time ABHA verification
   - Health record sync via ABDM
   - Consent management

2. **Offline Support**
   - IndexedDB patient caching
   - Offline patient creation
   - Background sync queue

3. **Advanced Analytics**
   - Machine learning risk prediction
   - Cohort analysis tools
   - Population health insights

4. **Mobile App**
   - Native iOS/Android apps
   - Patient self-service portal
   - Push notifications

5. **Interoperability**
   - HL7 FHIR support
   - Export to EHR systems
   - API for third-party integrations

6. **Enhanced Search**
   - Fuzzy matching improvements
   - Phonetic search
   - OCR for ID card scanning
   - Face recognition (with consent)

---

## Support & Maintenance

### Common Issues

**Issue: Patient search returns no results**
- Check database indexes are created
- Verify search query format
- Check patient data exists

**Issue: Patient creation fails**
- Verify required fields provided
- Check for duplicate detection
- Review validation errors

**Issue: Submission not linking to patient**
- Verify patient_id is valid UUID
- Check patient exists in database
- Review submission payload

### Getting Help

- Documentation: `/docs/PATIENT_MANAGEMENT_SYSTEM.md`
- API Reference: `/docs/api/patients`
- Issue Tracker: GitHub Issues
- Support Email: support@yourapp.com

---

## Conclusion

This Patient Management System provides a comprehensive, secure, and scalable solution for patient-centric healthcare data collection. The system is designed to integrate seamlessly with the existing form builder while maintaining backward compatibility and enabling powerful analytics capabilities.

**Key Achievements:**
✅ Non-disruptive integration with existing forms
✅ Secure patient data management with encryption
✅ Fast, fuzzy patient search
✅ Comprehensive submission history tracking
✅ Analytics-ready data structure
✅ ABDM/ABHA compliance ready
✅ Scalable architecture for future enhancements

The implementation follows best practices in security, performance, and user experience, providing a solid foundation for healthcare data collection and analysis.
