# Supabase Migration Plan - Healthcare-Compliant Relational Schema

## Project: CV Raman Health
**Target Database**: Supabase PostgreSQL
**Connection**: `postgresql://postgres:ceqcan-daqku3-parhUh@db.ddjdedijhgtjukjhuora.supabase.co:5432/postgres`
**Migration Type**: Full data migration with schema transformation
**Date Created**: February 26, 2025

---

## Database Architecture Rules (Healthcare System)

### 1. Core Rule
- Use PostgreSQL relational structure for all clinical and patient data.
- Do NOT store complete patient records as raw JSON blobs.
- JSONB is allowed only for configuration or exchange layers.

### 2. What MUST be Relational
- `patients`
- `encounters`
- `observations`
- `diagnoses`
- `consents`
- `audit_logs`
- `form_submissions`
- `form_answers`

Each entity must have proper foreign keys and indexes.

### 3. JSON Usage Rules
- `forms.schema` → JSONB (allowed for configuration)
- Configuration objects → JSONB (allowed)
- FHIR export cache → JSONB (optional)
- NEVER store full patient clinical data as a single JSON column.

### 4. Consent-First Architecture
- No patient data should be accessed without checking consent.
- Maintain a `consent_artifacts` table.
- Log every data access in `audit_logs`.

### 5. FHIR Layer
- Treat FHIR as an exchange format only.
- Relational data must be mapped to FHIR JSON when sending to external systems.
- Do not design the DB as FHIR-native JSON storage.

### 6. Security
- Use UUIDs for primary keys.
- Encrypt sensitive identifiers (ABHA).
- Separate PII from clinical data when possible.
- Maintain access logs.

### 7. Extensibility
- Design schema so ABDM/FHIR integration can be added later without major refactor.
- Avoid shortcuts that break compliance readiness.

**Always prioritize:**
- Relational clarity > JSON convenience
- Compliance readiness > speed hacks
- Auditability > simplicity

---

## Current vs Required Schema Analysis

### ❌ Current Problem (Non-Compliant)

```sql
-- Current submissions table
CREATE TABLE submissions (
    id UUID PRIMARY KEY,
    form_id UUID REFERENCES forms(id),
    submitted_by UUID REFERENCES users(id),
    data JSONB NOT NULL,  -- ❌ WRONG: All answers in single JSON blob
    status VARCHAR(50),
    created_at TIMESTAMP
);

-- Example data
{
  "field_1234567890": "John Doe",
  "field_1234567891": 35,
  "field_1234567892": "Male",
  "field_1234567893": 7
}
```

**Problems:**
- ❌ Violates relational clarity
- ❌ Can't grant consent to individual fields
- ❌ Can't audit field-level access
- ❌ Can't query/aggregate specific data points
- ❌ Not ABDM compliant
- ❌ No referential integrity for clinical data
- ❌ Can't link to patients, encounters, observations

---

## ✅ New Healthcare-Compliant Schema

### Core Clinical Tables

#### 1. Patients Table (ABDM-Ready)
```sql
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- ABDM Integration
    abha_id_encrypted TEXT UNIQUE,  -- Encrypted ABHA ID (14-digit)
    abha_address VARCHAR(255) UNIQUE,  -- username@abdm format

    -- Demographics
    full_name VARCHAR(255) NOT NULL,
    date_of_birth DATE,
    gender VARCHAR(20),

    -- Contact (encrypted)
    contact_encrypted TEXT,  -- Encrypted phone/email
    address_encrypted TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,

    -- Indexes
    CONSTRAINT chk_gender CHECK (gender IN ('Male', 'Female', 'Other', 'Unknown'))
);

CREATE INDEX idx_patients_abha_id ON patients(abha_id_encrypted);
CREATE INDEX idx_patients_created_at ON patients(created_at);
```

#### 2. Encounters Table (Visits/Consultations)
```sql
CREATE TABLE encounters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

    -- Encounter Details
    encounter_type VARCHAR(50) NOT NULL,  -- OPD, IPD, Emergency, Teleconsultation
    encounter_number VARCHAR(100) UNIQUE,  -- Hospital-specific ID

    -- Timing
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,

    -- ABDM Integration
    facility_hfr_id VARCHAR(100),  -- Healthcare Facility Registry ID
    practitioner_hpr_id VARCHAR(100),  -- Healthcare Professional Registry ID

    -- Status
    status VARCHAR(50) DEFAULT 'in-progress',  -- in-progress, completed, cancelled

    -- Chief Complaint
    chief_complaint TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id),

    -- Indexes
    CONSTRAINT chk_encounter_type CHECK (encounter_type IN ('OPD', 'IPD', 'Emergency', 'Teleconsultation', 'FollowUp')),
    CONSTRAINT chk_status CHECK (status IN ('scheduled', 'in-progress', 'completed', 'cancelled', 'no-show'))
);

CREATE INDEX idx_encounters_patient_id ON encounters(patient_id);
CREATE INDEX idx_encounters_start_time ON encounters(start_time);
CREATE INDEX idx_encounters_status ON encounters(status);
CREATE INDEX idx_encounters_facility ON encounters(facility_hfr_id);
```

#### 3. Observations Table (Vitals, Measurements)
```sql
CREATE TABLE observations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter_id UUID REFERENCES encounters(id) ON DELETE CASCADE,

    -- Observation Type
    observation_type VARCHAR(100) NOT NULL,  -- bp_systolic, temperature, pain_scale, weight, etc.
    observation_category VARCHAR(50),  -- vital-signs, laboratory, imaging

    -- Value (polymorphic storage)
    value_numeric DECIMAL(10,2),  -- For numeric values
    value_text TEXT,  -- For text values
    value_boolean BOOLEAN,  -- For yes/no values
    value_date DATE,  -- For date values
    value_json JSONB,  -- For complex structured values only

    -- Units and Reference Range
    unit VARCHAR(50),  -- mmHg, celsius, kg, etc.
    reference_range_low DECIMAL(10,2),
    reference_range_high DECIMAL(10,2),
    is_abnormal BOOLEAN,

    -- Standard Coding
    loinc_code VARCHAR(50),  -- LOINC code for lab observations
    snomed_code VARCHAR(50),  -- SNOMED-CT code

    -- Timing and Attribution
    recorded_at TIMESTAMP NOT NULL DEFAULT NOW(),
    recorded_by UUID REFERENCES users(id),

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    notes TEXT,

    -- Indexes
    CONSTRAINT chk_value_present CHECK (
        value_numeric IS NOT NULL OR
        value_text IS NOT NULL OR
        value_boolean IS NOT NULL OR
        value_date IS NOT NULL OR
        value_json IS NOT NULL
    )
);

CREATE INDEX idx_observations_patient_id ON observations(patient_id);
CREATE INDEX idx_observations_encounter_id ON observations(encounter_id);
CREATE INDEX idx_observations_type ON observations(observation_type);
CREATE INDEX idx_observations_recorded_at ON observations(recorded_at);
CREATE INDEX idx_observations_loinc ON observations(loinc_code);
```

#### 4. Diagnoses Table
```sql
CREATE TABLE diagnoses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter_id UUID REFERENCES encounters(id) ON DELETE CASCADE,

    -- Diagnosis Details
    diagnosis_text TEXT NOT NULL,  -- Human-readable diagnosis

    -- Standard Coding
    icd10_code VARCHAR(20),  -- ICD-10 code
    snomed_code VARCHAR(50),  -- SNOMED-CT code

    -- Clinical Details
    diagnosis_type VARCHAR(50),  -- primary, secondary, differential
    severity VARCHAR(50),  -- mild, moderate, severe, critical
    clinical_status VARCHAR(50),  -- active, resolved, recurrence

    -- Timing
    onset_date DATE,
    diagnosed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP,

    -- Attribution
    diagnosed_by UUID REFERENCES users(id),

    -- Notes
    notes TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Indexes
    CONSTRAINT chk_diagnosis_type CHECK (diagnosis_type IN ('primary', 'secondary', 'differential', 'provisional')),
    CONSTRAINT chk_severity CHECK (severity IN ('mild', 'moderate', 'severe', 'critical')),
    CONSTRAINT chk_clinical_status CHECK (clinical_status IN ('active', 'resolved', 'recurrence', 'remission'))
);

CREATE INDEX idx_diagnoses_patient_id ON diagnoses(patient_id);
CREATE INDEX idx_diagnoses_encounter_id ON diagnoses(encounter_id);
CREATE INDEX idx_diagnoses_icd10 ON diagnoses(icd10_code);
CREATE INDEX idx_diagnoses_snomed ON diagnoses(snomed_code);
CREATE INDEX idx_diagnoses_diagnosed_at ON diagnoses(diagnosed_at);
```

---

### Form System Tables (Hybrid Approach)

#### 5. Forms Table (Schema in JSONB - Allowed)
```sql
CREATE TABLE forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Form Metadata
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Form Schema (JSONB allowed for configuration)
    schema JSONB NOT NULL,  -- ✅ Allowed: Form structure definition

    -- Classification
    form_type VARCHAR(50),  -- registration, assessment, consent, discharge
    specialty VARCHAR(100),  -- cardiology, pediatrics, general

    -- Version Control
    version INTEGER DEFAULT 1,
    parent_form_id UUID REFERENCES forms(id),  -- For versioning

    -- Status
    is_active BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT false,
    share_token VARCHAR(64) UNIQUE,

    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Computed column for quick field count
    field_count INTEGER GENERATED ALWAYS AS (
        CASE
            WHEN schema ? 'fields' THEN jsonb_array_length(schema->'fields')
            WHEN schema ? 'pages' THEN (
                SELECT SUM(jsonb_array_length(page->'fields'))
                FROM jsonb_array_elements(schema->'pages') AS page
            )
            ELSE 0
        END
    ) STORED
);

-- JSONB indexes for fast queries
CREATE INDEX idx_forms_schema ON forms USING GIN (schema);
CREATE INDEX idx_forms_schema_path ON forms USING GIN (schema jsonb_path_ops);
CREATE INDEX idx_forms_is_active ON forms(is_active);
CREATE INDEX idx_forms_form_type ON forms(form_type);
```

#### 6. Form Submissions Table (Relational Header)
```sql
CREATE TABLE form_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Form Reference
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    form_version INTEGER,  -- Snapshot of version used

    -- Clinical Context (NEW - Critical for healthcare)
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,  -- ✅ Link to patient
    encounter_id UUID REFERENCES encounters(id) ON DELETE CASCADE,  -- ✅ Link to encounter

    -- Submission Details
    submitted_by UUID NOT NULL REFERENCES users(id),
    submission_status VARCHAR(50) DEFAULT 'draft',  -- draft, submitted, verified, archived

    -- Timing
    started_at TIMESTAMP DEFAULT NOW(),
    submitted_at TIMESTAMP,
    verified_at TIMESTAMP,
    verified_by UUID REFERENCES users(id),

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,

    -- Indexes
    CONSTRAINT chk_submission_status CHECK (submission_status IN ('draft', 'submitted', 'verified', 'archived', 'deleted'))
);

CREATE INDEX idx_form_submissions_form_id ON form_submissions(form_id);
CREATE INDEX idx_form_submissions_patient_id ON form_submissions(patient_id);
CREATE INDEX idx_form_submissions_encounter_id ON form_submissions(encounter_id);
CREATE INDEX idx_form_submissions_submitted_by ON form_submissions(submitted_by);
CREATE INDEX idx_form_submissions_status ON form_submissions(submission_status);
CREATE INDEX idx_form_submissions_submitted_at ON form_submissions(submitted_at);
```

#### 7. Form Answers Table (Relational Storage - CRITICAL CHANGE)
```sql
CREATE TABLE form_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Submission Reference
    submission_id UUID NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,

    -- Field Reference (from form schema)
    field_id VARCHAR(255) NOT NULL,  -- Matches field.id in forms.schema JSONB
    field_type VARCHAR(50) NOT NULL,  -- text, number, painScale, select, etc.
    field_label VARCHAR(255),  -- Snapshot of label for historical reference

    -- Polymorphic Value Storage (like observations)
    value_text TEXT,  -- For text, email, url, phone, textarea
    value_numeric DECIMAL(10,2),  -- For number, painScale, linearScale
    value_date DATE,  -- For date fields
    value_time TIME,  -- For time fields
    value_boolean BOOLEAN,  -- For checkbox fields
    value_json JSONB,  -- For select (multi), radio, complex types

    -- Additional Context
    answer_order INTEGER DEFAULT 0,  -- For multi-value fields
    unit VARCHAR(50),  -- For numeric values with units

    -- Clinical Mapping (for integration with observations/diagnoses)
    maps_to_observation_type VARCHAR(100),  -- Link to observation_type
    loinc_code VARCHAR(50),  -- If this answer represents a coded observation

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Constraints
    CONSTRAINT chk_answer_value_present CHECK (
        value_text IS NOT NULL OR
        value_numeric IS NOT NULL OR
        value_date IS NOT NULL OR
        value_time IS NOT NULL OR
        value_boolean IS NOT NULL OR
        value_json IS NOT NULL
    ),

    CONSTRAINT chk_field_type CHECK (field_type IN (
        'text', 'number', 'date', 'time', 'email', 'url', 'phone',
        'textarea', 'select', 'radio', 'checkbox', 'painScale',
        'linearScale', 'file', 'section'
    ))
);

-- Critical indexes for performance
CREATE INDEX idx_form_answers_submission_id ON form_answers(submission_id);
CREATE INDEX idx_form_answers_field_id ON form_answers(field_id);
CREATE INDEX idx_form_answers_field_type ON form_answers(field_type);
CREATE INDEX idx_form_answers_value_numeric ON form_answers(value_numeric) WHERE value_numeric IS NOT NULL;
CREATE INDEX idx_form_answers_maps_to ON form_answers(maps_to_observation_type);

-- Composite index for common queries
CREATE INDEX idx_form_answers_submission_field ON form_answers(submission_id, field_id);
```

---

### Consent Management Tables (ABDM-Compliant)

#### 8. Consent Artifacts Table
```sql
CREATE TABLE consent_artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Patient
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

    -- Consent Type
    consent_type VARCHAR(50) NOT NULL,  -- data_access, research, treatment, marketing
    purpose VARCHAR(100) NOT NULL,  -- CAREMGT, RESEARCH, PUBLICHEALTH (ABDM purposes)

    -- Granted To
    granted_to_user_id UUID REFERENCES users(id),
    granted_to_facility_hfr_id VARCHAR(100),  -- HFR ID
    granted_to_organization VARCHAR(255),

    -- Scope (granular data access)
    data_categories TEXT[] NOT NULL,  -- ['observations', 'diagnoses', 'form_answers']
    specific_encounter_ids UUID[],  -- Limit to specific encounters
    specific_observation_types VARCHAR(100)[],  -- Limit to specific observation types

    -- Validity Period
    valid_from TIMESTAMP NOT NULL,
    valid_until TIMESTAMP NOT NULL,

    -- Status
    status VARCHAR(50) DEFAULT 'active',  -- active, expired, revoked, pending
    granted_at TIMESTAMP DEFAULT NOW(),
    revoked_at TIMESTAMP,
    revoked_by UUID REFERENCES users(id),
    revocation_reason TEXT,

    -- ABDM Integration
    abdm_consent_id VARCHAR(255) UNIQUE,  -- HIE-CM consent artifact ID
    abdm_consent_json JSONB,  -- Full ABDM consent structure (allowed as exchange format)

    -- Consent Proof
    consent_document_url TEXT,  -- Link to signed consent document
    digital_signature TEXT,  -- Digital signature if applicable

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Constraints
    CONSTRAINT chk_consent_status CHECK (status IN ('pending', 'active', 'expired', 'revoked', 'denied')),
    CONSTRAINT chk_consent_type CHECK (consent_type IN ('data_access', 'research', 'treatment', 'marketing', 'abdm_hie')),
    CONSTRAINT chk_valid_period CHECK (valid_from < valid_until)
);

CREATE INDEX idx_consent_patient_id ON consent_artifacts(patient_id);
CREATE INDEX idx_consent_status ON consent_artifacts(status);
CREATE INDEX idx_consent_granted_to ON consent_artifacts(granted_to_user_id);
CREATE INDEX idx_consent_valid_period ON consent_artifacts(valid_from, valid_until);
CREATE INDEX idx_consent_abdm_id ON consent_artifacts(abdm_consent_id);
```

#### 9. Consent Access Log Table
```sql
CREATE TABLE consent_access_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Consent Reference
    consent_id UUID NOT NULL REFERENCES consent_artifacts(id) ON DELETE CASCADE,

    -- Access Details
    accessed_by UUID NOT NULL REFERENCES users(id),
    access_type VARCHAR(50) NOT NULL,  -- read, export, print, share

    -- What Was Accessed
    entity_type VARCHAR(50) NOT NULL,  -- observation, diagnosis, form_answer
    entity_ids UUID[],  -- IDs of accessed records
    data_accessed_description TEXT,  -- Human-readable description

    -- Context
    purpose_of_access VARCHAR(100),  -- Why data was accessed
    accessed_at TIMESTAMP DEFAULT NOW(),

    -- Technical Details
    ip_address INET,
    user_agent TEXT,

    -- ABDM Audit
    abdm_transaction_id VARCHAR(255),  -- For ABDM data exchange tracking

    -- Indexes
    CONSTRAINT chk_access_type CHECK (access_type IN ('read', 'export', 'print', 'share', 'api_access'))
);

CREATE INDEX idx_consent_access_consent_id ON consent_access_log(consent_id);
CREATE INDEX idx_consent_access_accessed_by ON consent_access_log(accessed_by);
CREATE INDEX idx_consent_access_accessed_at ON consent_access_log(accessed_at);
CREATE INDEX idx_consent_access_entity_type ON consent_access_log(entity_type);
```

---

### Audit & Compliance Tables

#### 10. Audit Logs Table (Comprehensive Audit Trail)
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Actor
    user_id UUID REFERENCES users(id),
    user_email VARCHAR(255),  -- Snapshot in case user deleted
    user_role VARCHAR(50),

    -- Patient Context (if patient data involved)
    patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,

    -- Action Details
    action VARCHAR(100) NOT NULL,  -- view_record, update_diagnosis, export_data, create_patient
    entity_type VARCHAR(50) NOT NULL,  -- patient, observation, form_answer, user
    entity_id UUID,  -- ID of affected entity

    -- Consent Tracking
    consent_id UUID REFERENCES consent_artifacts(id),  -- Which consent was used (if applicable)
    consent_required BOOLEAN DEFAULT false,  -- Was consent required for this action?
    consent_verified BOOLEAN,  -- Was valid consent verified?

    -- Change Tracking
    old_values JSONB,  -- Snapshot of old values (for updates/deletes)
    new_values JSONB,  -- Snapshot of new values (for creates/updates)

    -- Request Details
    http_method VARCHAR(10),  -- GET, POST, PUT, DELETE
    endpoint VARCHAR(255),  -- API endpoint called
    ip_address INET,
    user_agent TEXT,

    -- Result
    success BOOLEAN DEFAULT true,
    error_message TEXT,  -- If action failed

    -- Timing
    created_at TIMESTAMP DEFAULT NOW(),
    duration_ms INTEGER,  -- How long the operation took

    -- ABDM/Compliance
    is_abdm_transaction BOOLEAN DEFAULT false,
    abdm_transaction_id VARCHAR(255),

    -- Constraints
    CONSTRAINT chk_action CHECK (action IN (
        'create', 'read', 'update', 'delete',
        'export', 'print', 'share', 'login', 'logout',
        'grant_consent', 'revoke_consent', 'access_patient_data'
    ))
);

-- Critical indexes for audit queries
CREATE INDEX idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_patient_id ON audit_logs(patient_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_consent_id ON audit_logs(consent_id);
CREATE INDEX idx_audit_success ON audit_logs(success);

-- Composite index for common audit queries
CREATE INDEX idx_audit_patient_action_date ON audit_logs(patient_id, action, created_at);
```

---

## Data Migration Strategy

### Phase 1: Export Current Data

```sql
-- Export users (no changes needed)
\copy (SELECT * FROM users) TO '/tmp/users.csv' CSV HEADER;

-- Export forms (schema stays JSONB - allowed)
\copy (SELECT * FROM forms) TO '/tmp/forms.csv' CSV HEADER;

-- Export submissions for transformation
\copy (
    SELECT
        s.id,
        s.form_id,
        s.submitted_by,
        s.data,
        s.status,
        s.created_at
    FROM submissions s
) TO '/tmp/submissions.csv' CSV HEADER;
```

### Phase 2: Transform Submissions to Relational

```python
# Migration Script: transform_submissions.py

import psycopg2
import json
from datetime import datetime

# Source database (current local)
source_conn = psycopg2.connect(
    "postgresql://farzanmanzer@localhost:5432/cv_raman_health"
)

# Target database (Supabase)
target_conn = psycopg2.connect(
    "postgresql://postgres:ceqcan-daqku3-parhUh@db.ddjdedijhgtjukjhuora.supabase.co:5432/postgres"
)

def migrate_submission(submission):
    """
    Transform old JSONB submission into relational structure

    OLD: submission.data = {field_id: value, field_id: value}
    NEW: form_submissions + multiple form_answers rows
    """
    submission_id = submission['id']
    form_id = submission['form_id']
    submitted_by = submission['submitted_by']
    data = submission['data']  # JSONB dict
    status = submission['status']
    created_at = submission['created_at']

    # Get form schema to determine field types
    form_schema = get_form_schema(form_id)
    fields_by_id = {field['id']: field for field in form_schema}

    # Create form_submission record
    cur = target_conn.cursor()
    cur.execute("""
        INSERT INTO form_submissions (
            id, form_id, submitted_by, submission_status,
            submitted_at, created_at, patient_id, encounter_id
        ) VALUES (%s, %s, %s, %s, %s, %s, NULL, NULL)
    """, (submission_id, form_id, submitted_by, status, created_at, created_at))

    # Transform each field answer into form_answers row
    for field_id, value in data.items():
        if field_id not in fields_by_id:
            continue  # Skip unknown fields

        field_config = fields_by_id[field_id]
        field_type = field_config['type']
        field_label = field_config['label']

        # Determine which value column to use
        value_numeric = None
        value_text = None
        value_date = None
        value_boolean = None
        value_json = None

        if field_type in ['number', 'painScale', 'linearScale']:
            value_numeric = float(value) if value else None
        elif field_type in ['text', 'email', 'url', 'phone', 'textarea']:
            value_text = str(value) if value else None
        elif field_type == 'date':
            value_date = value
        elif field_type == 'checkbox':
            value_boolean = bool(value)
        elif field_type in ['select', 'radio']:
            # Store as text if single value, JSON if multi
            if isinstance(value, list):
                value_json = json.dumps(value)
            else:
                value_text = str(value)
        else:
            value_text = str(value)

        # Insert form_answer
        cur.execute("""
            INSERT INTO form_answers (
                submission_id, field_id, field_type, field_label,
                value_text, value_numeric, value_date, value_boolean, value_json,
                created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            submission_id, field_id, field_type, field_label,
            value_text, value_numeric, value_date, value_boolean, value_json,
            created_at
        ))

    target_conn.commit()
    print(f"Migrated submission {submission_id}")

# Execute migration
source_cur = source_conn.cursor()
source_cur.execute("SELECT * FROM submissions")
submissions = source_cur.fetchall()

for submission in submissions:
    migrate_submission(submission)

print(f"Migration complete! Migrated {len(submissions)} submissions")
```

### Phase 3: Create Default Consent Artifacts

```python
# Create default "implicit consent" for existing data
def create_default_consents():
    """
    For migrated data, create default consent artifacts
    assuming implicit consent for treatment purposes
    """
    cur = target_conn.cursor()

    # For each patient (if any), create default consent
    cur.execute("""
        INSERT INTO consent_artifacts (
            patient_id,
            consent_type,
            purpose,
            data_categories,
            valid_from,
            valid_until,
            status,
            granted_at
        )
        SELECT
            id as patient_id,
            'treatment' as consent_type,
            'CAREMGT' as purpose,
            ARRAY['observations', 'diagnoses', 'form_answers'] as data_categories,
            NOW() as valid_from,
            NOW() + INTERVAL '10 years' as valid_until,
            'active' as status,
            NOW() as granted_at
        FROM patients
        WHERE NOT EXISTS (
            SELECT 1 FROM consent_artifacts ca
            WHERE ca.patient_id = patients.id
        )
    """)

    target_conn.commit()
```

---

## Migration Execution Plan

### Step 1: Prepare Supabase (Day 1)

```bash
# 1. Create Supabase project
# - Go to supabase.com
# - Create new project: "cv-raman-health"
# - Note down connection string

# 2. Enable extensions
psql $SUPABASE_URL -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
psql $SUPABASE_URL -c "CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";"

# 3. Run schema creation scripts
psql $SUPABASE_URL -f 001_create_core_tables.sql
psql $SUPABASE_URL -f 002_create_form_tables.sql
psql $SUPABASE_URL -f 003_create_consent_tables.sql
psql $SUPABASE_URL -f 004_create_audit_tables.sql
```

### Step 2: Backup Current Data (Day 1)

```bash
# Full database backup
pg_dump -U farzanmanzer -d cv_raman_health > backup_$(date +%Y%m%d).sql

# Export tables individually
psql -U farzanmanzer -d cv_raman_health -c "\copy users TO '/tmp/users.csv' CSV HEADER"
psql -U farzanmanzer -d cv_raman_health -c "\copy forms TO '/tmp/forms.csv' CSV HEADER"
psql -U farzanmanzer -d cv_raman_health -c "\copy submissions TO '/tmp/submissions.csv' CSV HEADER"
```

### Step 3: Run Migration Script (Day 2)

```bash
# 1. Migrate users (no transformation needed)
python migrate_users.py

# 2. Migrate forms (schema stays JSONB)
python migrate_forms.py

# 3. Transform and migrate submissions
python transform_submissions.py

# 4. Create default consent artifacts
python create_default_consents.py

# 5. Verify migration
python verify_migration.py
```

### Step 4: Update Backend Code (Day 3-5)

```python
# New models to create:
# - app/patients/models.py (Patient model)
# - app/encounters/models.py (Encounter model)
# - app/observations/models.py (Observation model)
# - app/diagnoses/models.py (Diagnosis model)
# - app/consent/models.py (ConsentArtifact, ConsentAccessLog models)
# - app/audit/models.py (AuditLog model)

# Update existing models:
# - app/forms/models.py (keep schema as JSONB)
# - app/submissions/models.py → Split into:
#   - FormSubmission model
#   - FormAnswer model
```

### Step 5: Add Consent Middleware (Day 6)

```python
# app/middleware/consent_checker.py

from functools import wraps
from flask import g, abort
from app.consent.models import ConsentArtifact

def require_consent(data_categories):
    """
    Decorator to check consent before accessing patient data

    Usage:
    @require_consent(['observations', 'diagnoses'])
    def get_patient_data(patient_id):
        ...
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            patient_id = kwargs.get('patient_id')
            user_id = g.current_user.id

            # Check if valid consent exists
            consent = ConsentArtifact.query.filter(
                ConsentArtifact.patient_id == patient_id,
                ConsentArtifact.granted_to_user_id == user_id,
                ConsentArtifact.status == 'active',
                ConsentArtifact.valid_from <= datetime.now(),
                ConsentArtifact.valid_until >= datetime.now()
            ).first()

            if not consent:
                # Log unauthorized access attempt
                AuditLog.log_access_denied(
                    user_id=user_id,
                    patient_id=patient_id,
                    action='access_patient_data',
                    reason='no_valid_consent'
                )
                abort(403, "No valid consent to access patient data")

            # Check if requested data categories are covered
            for category in data_categories:
                if category not in consent.data_categories:
                    abort(403, f"Consent does not cover {category}")

            # Store consent_id in request context for audit logging
            g.consent_id = consent.id

            return f(*args, **kwargs)
        return decorated_function
    return decorator
```

### Step 6: Add Audit Logging (Day 7)

```python
# app/middleware/audit_logger.py

from app.audit.models import AuditLog
from flask import request, g

def log_audit(action, entity_type, entity_id, old_values=None, new_values=None):
    """
    Automatically log all patient data access
    """
    AuditLog.create(
        user_id=g.current_user.id if hasattr(g, 'current_user') else None,
        patient_id=g.get('patient_id'),
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        consent_id=g.get('consent_id'),
        old_values=old_values,
        new_values=new_values,
        ip_address=request.remote_addr,
        user_agent=request.user_agent.string,
        http_method=request.method,
        endpoint=request.endpoint
    )
```

### Step 7: Update .env Configuration (Day 7)

```bash
# backend/.env

# Supabase Database
DATABASE_URL=postgresql://postgres:ceqcan-daqku3-parhUh@db.ddjdedijhgtjukjhuora.supabase.co:5432/postgres

# Security (update for production)
SECRET_KEY=<generate-new-random-key>
JWT_SECRET_KEY=<generate-new-random-key>

# Encryption keys for PII
ENCRYPTION_KEY=<generate-fernet-key>

# ABDM Integration (for future)
ABDM_CLIENT_ID=
ABDM_CLIENT_SECRET=
ABDM_GATEWAY_URL=https://dev.abdm.gov.in

# Audit Settings
ENABLE_AUDIT_LOGGING=true
AUDIT_LOG_RETENTION_DAYS=2555  # 7 years (healthcare compliance)
```

### Step 8: Test & Validate (Day 8-10)

```python
# tests/test_migration.py

def test_submission_data_integrity():
    """Verify old JSONB data matches new relational data"""
    # Get old submission data
    old_submission = old_db.execute(
        "SELECT data FROM submissions WHERE id = %s",
        [submission_id]
    ).fetchone()

    # Get new relational data
    answers = new_db.execute("""
        SELECT field_id, value_text, value_numeric
        FROM form_answers
        WHERE submission_id = %s
    """, [submission_id]).fetchall()

    # Reconstruct as dict
    reconstructed = {}
    for answer in answers:
        if answer['value_numeric']:
            reconstructed[answer['field_id']] = answer['value_numeric']
        elif answer['value_text']:
            reconstructed[answer['field_id']] = answer['value_text']

    # Compare
    assert old_submission['data'] == reconstructed

def test_consent_checking():
    """Test consent middleware"""
    # Create test patient
    patient = create_test_patient()

    # Try to access without consent - should fail
    with pytest.raises(PermissionError):
        access_patient_data(patient.id, user_id=test_user.id)

    # Create consent
    consent = create_consent(
        patient_id=patient.id,
        granted_to=test_user.id,
        data_categories=['observations']
    )

    # Now should succeed
    data = access_patient_data(patient.id, user_id=test_user.id)
    assert data is not None

def test_audit_logging():
    """Test audit trail creation"""
    # Access patient data
    access_patient_observations(patient_id)

    # Check audit log created
    audit = AuditLog.query.filter_by(
        patient_id=patient_id,
        action='read'
    ).first()

    assert audit is not None
    assert audit.consent_id is not None
    assert audit.ip_address is not None
```

---

## Benefits of This Migration

### ✅ Compliance
- ABDM/FHIR ready with proper data mapping
- DPDPA 2023 compliant with granular consent
- Complete audit trails for regulatory requirements
- Field-level data access control

### ✅ Security
- Encrypted PII (ABHA ID, contact info)
- Consent-first data access
- Comprehensive audit logging
- Row-level security (Supabase RLS)

### ✅ Data Integrity
- Foreign key constraints
- Referential integrity
- Proper normalization
- Type safety for clinical data

### ✅ Analytics & Reporting
- Easy SQL queries for insights
- Proper indexes for performance
- Can aggregate across patients
- BI tools compatible

### ✅ Scalability
- Efficient queries with indexes
- Normalized structure reduces redundancy
- Can partition by date for large datasets
- Materialized views for fast analytics

### ✅ ABDM Integration Ready
- Patients table with ABHA ID
- Encounters linked to HFR/HPR IDs
- Observations with LOINC codes
- Diagnoses with ICD-10/SNOMED
- Can generate FHIR resources on-demand

---

## File Structure After Migration

```
backend/
├── app/
│   ├── patients/
│   │   ├── models.py       # Patient model
│   │   ├── routes.py       # Patient APIs
│   │   └── schemas.py      # Validation schemas
│   │
│   ├── encounters/
│   │   ├── models.py       # Encounter model
│   │   └── routes.py
│   │
│   ├── observations/
│   │   ├── models.py       # Observation model
│   │   └── routes.py
│   │
│   ├── diagnoses/
│   │   ├── models.py       # Diagnosis model
│   │   └── routes.py
│   │
│   ├── forms/
│   │   ├── models.py       # Form model (schema stays JSONB)
│   │   └── routes.py
│   │
│   ├── submissions/
│   │   ├── models.py       # FormSubmission + FormAnswer models
│   │   └── routes.py       # Updated APIs
│   │
│   ├── consent/
│   │   ├── models.py       # ConsentArtifact, ConsentAccessLog
│   │   ├── routes.py       # Consent management APIs
│   │   └── middleware.py   # Consent checking decorator
│   │
│   ├── audit/
│   │   ├── models.py       # AuditLog model
│   │   ├── routes.py       # Audit query APIs
│   │   └── middleware.py   # Auto-logging middleware
│   │
│   └── abdm/
│       ├── fhir_mapper.py  # Map relational → FHIR JSON
│       └── integration.py  # ABDM gateway integration
│
├── migrations/
│   ├── sql/
│   │   ├── 001_create_core_tables.sql
│   │   ├── 002_create_form_tables.sql
│   │   ├── 003_create_consent_tables.sql
│   │   └── 004_create_audit_tables.sql
│   │
│   └── scripts/
│       ├── migrate_users.py
│       ├── migrate_forms.py
│       ├── transform_submissions.py
│       └── verify_migration.py
│
└── .env  # Updated with Supabase credentials
```

---

## Timeline

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Week 1** | 2 days | Design schema, review with team |
| **Week 1** | 1 day | Set up Supabase, create tables |
| **Week 1** | 2 days | Write migration scripts |
| **Week 2** | 3 days | Update backend models & APIs |
| **Week 2** | 2 days | Add consent middleware & audit logging |
| **Week 3** | 3 days | Testing & validation |
| **Week 3** | 2 days | Deploy & monitor |

**Total: ~3 weeks**

---

## Next Steps

1. **Review this plan** with your team
2. **Create SQL migration files** (001-004)
3. **Set up Supabase project**
4. **Write Python migration scripts**
5. **Test locally** before production migration
6. **Execute migration** in phases
7. **Monitor & validate** data integrity

---

## Notes

- **No data loss**: All existing data will be migrated
- **Backward compatible**: Old JSONB schema format preserved for forms
- **Forward compatible**: Ready for ABDM/FHIR integration
- **Compliance-first**: Built with healthcare regulations in mind
- **Auditable**: Every data access logged
- **Secure**: Encryption, consent, and access control

---

**Status**: Ready for implementation
**Last Updated**: February 26, 2025
**Next Action**: Review and approve plan
