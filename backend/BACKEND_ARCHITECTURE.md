# CV Raman Health - Backend Architecture Documentation

**Generated:** February 22, 2026
**Author:** System Documentation
**Version:** 1.0

---

## Table of Contents

1. [Database Information](#database-information)
2. [Database Schema](#database-schema)
3. [Complete Backend Flow](#complete-backend-flow)
4. [Architecture Layers](#architecture-layers)
5. [Component Breakdown](#component-breakdown)
6. [Data Validation Details](#data-validation-details)
7. [Security Features](#security-features)
8. [Example Data Flow](#example-data-flow)
9. [Advanced Features](#advanced-features)
10. [Key Files Reference](#key-files-reference)

---

## Database Information

### Database System
**PostgreSQL** (production-grade relational database)

**Connection Details:**
- **Database:** `cv_raman_health`
- **Host:** `localhost`
- **Port:** `5432`
- **User:** `farzanmanzer`
- **Connection URL:** `postgresql://farzanmanzer@localhost:5432/cv_raman_health`

**ORM:** SQLAlchemy (Python database toolkit)
**Migrations:** Alembic via Flask-Migrate

---

## Database Schema

### 1. USERS Table

**File:** `app/common/models.py`

```sql
CREATE TABLE users (
    -- Primary Key
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- User Authentication
    email             VARCHAR(255) NOT NULL UNIQUE,
    password_hash     VARCHAR(255) NOT NULL,

    -- User Information
    full_name         VARCHAR(255) NOT NULL,
    role              user_role NOT NULL DEFAULT 'viewer',
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,

    -- Timestamps
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Enum for user roles
CREATE TYPE user_role AS ENUM ('admin', 'data_entry', 'viewer');

-- Indexes
CREATE INDEX ix_users_email ON users(email);
```

**Key Features:**
- UUID primary keys for security
- Bcrypt password hashing (cost factor 12)
- Role-based access control (RBAC)
- Soft-delete capability via `is_active`

**Role Permissions:**

| Role | Description | Permissions |
|------|-------------|-------------|
| **admin** | Full system access | Create forms, manage users, view all data, delete forms |
| **data_entry** | Can submit forms | Submit forms, view own submissions |
| **viewer** | Read-only access | View forms, submissions, analytics |

---

### 2. FORMS Table

**File:** `app/forms/models.py`

```sql
CREATE TABLE forms (
    -- Primary Key
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Form Details
    name              VARCHAR(255) NOT NULL,
    description       TEXT,
    schema            JSONB NOT NULL,

    -- Metadata
    created_by        UUID REFERENCES users(id),
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    version           INTEGER NOT NULL DEFAULT 1,

    -- Public Sharing
    is_public         BOOLEAN NOT NULL DEFAULT FALSE,
    share_token       VARCHAR(64) UNIQUE,

    -- Timestamps
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX ix_forms_is_active ON forms(is_active);
CREATE INDEX ix_forms_is_public ON forms(is_public);
CREATE INDEX ix_forms_share_token ON forms(share_token);

-- Foreign Keys
ALTER TABLE forms ADD CONSTRAINT fk_forms_created_by
    FOREIGN KEY (created_by) REFERENCES users(id);
```

**JSONB Schema Structure:**

The `schema` column stores the complete form structure:

**Single-Page Form:**
```json
{
  "fields": [
    {
      "id": "field_1",
      "type": "text",
      "label": "Full Name",
      "required": true,
      "placeholder": "Enter your name",
      "helpText": "Please provide your legal name",
      "defaultValue": "",
      "validation": {
        "pattern": "^[A-Za-z ]{2,50}$",
        "errorMessage": "Name must contain only letters and spaces"
      },
      "visibilityRules": []
    }
  ]
}
```

**Multi-Page Form:**
```json
{
  "pages": [
    {
      "id": "page_1",
      "title": "Personal Details",
      "description": "Basic information",
      "fields": [
        {
          "id": "first_name",
          "type": "text",
          "label": "First Name",
          "required": true
        },
        {
          "id": "last_name",
          "type": "text",
          "label": "Last Name",
          "required": true
        }
      ]
    },
    {
      "id": "page_2",
      "title": "Contact Information",
      "description": "How can we reach you?",
      "fields": [
        {
          "id": "email",
          "type": "email",
          "label": "Email Address",
          "required": true
        }
      ]
    }
  ]
}
```

**Supported Field Types:**

| Type | Description | Validation |
|------|-------------|------------|
| `text` | Single-line text input | pattern, maxLength |
| `email` | Email input | Built-in email validation |
| `textarea` | Multi-line text | maxLength |
| `phone` | Phone number input | - |
| `url` | URL input | Built-in URL validation |
| `number` | Numeric input | min, max |
| `date` | Date picker | - |
| `time` | Time picker | - |
| `select` | Dropdown selection | options required |
| `radio` | Radio button group | options required |
| `checkbox` | Single or multi-select | - |
| `linearScale` | Rating scale (1-10) | config with min/max |
| `file` | File upload | maxSize, acceptedTypes |
| `section` | Section header (non-input) | - |

---

### 3. SUBMISSIONS Table

**File:** `app/submissions/models.py`

```sql
CREATE TABLE submissions (
    -- Primary Key
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Relationships
    form_id           UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    submitted_by      UUID NOT NULL REFERENCES users(id),

    -- Submission Data
    data              JSONB NOT NULL,
    status            VARCHAR(50) NOT NULL DEFAULT 'submitted',

    -- Timestamps
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX ix_submissions_form_id ON submissions(form_id);
CREATE INDEX ix_submissions_submitted_by ON submissions(submitted_by);

-- Foreign Keys
ALTER TABLE submissions ADD CONSTRAINT fk_submissions_form_id
    FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE;

ALTER TABLE submissions ADD CONSTRAINT fk_submissions_submitted_by
    FOREIGN KEY (submitted_by) REFERENCES users(id);
```

**JSONB Data Structure:**

The `data` column stores the actual form responses:

```json
{
  "full_name": "John Doe",
  "age": 30,
  "email": "john@example.com",
  "phone": "+1 (555) 123-4567",
  "date_of_birth": "1996-01-15",
  "gender": "Male",
  "country": "United States",
  "bio": "Software developer with 10 years of experience",
  "satisfaction": 9,
  "subscribe": true
}
```

**For Public/Anonymous Submissions:**
```json
{
  "full_name": "Anonymous User",
  "feedback": "Great service!",
  "_submitter_info": {
    "name": "John",
    "email": "john@example.com"
  }
}
```

**Key Features:**
- Dynamic schema (JSONB allows flexible field storage)
- Cascade delete (deleting a form deletes all submissions)
- Automatic timestamps
- Status tracking (submitted, draft, archived)

---

### Database Relationships

```
┌─────────────┐
│    USERS    │
│             │
│ - id (PK)   │
│ - email     │
│ - role      │
└──────┬──────┘
       │
       │ created_by
       │
       ├───────────────────┐
       │                   │
       │              ┌────▼────────┐
       │              │    FORMS    │
       │              │             │
       │              │ - id (PK)   │
       │              │ - schema    │
       │              │ - is_public │
       │              └────┬────────┘
       │                   │
       │                   │ form_id
       │                   │
       │              ┌────▼──────────┐
       │              │  SUBMISSIONS  │
       │              │               │
       └─────────────▶│ - id (PK)     │
         submitted_by │ - form_id (FK)│
                      │ - data (JSONB)│
                      └───────────────┘
```

**Relationship Details:**

1. **users → forms** (one-to-many)
   - One user can create many forms
   - `forms.created_by` → `users.id`

2. **forms → submissions** (one-to-many)
   - One form can have many submissions
   - `submissions.form_id` → `forms.id`
   - **CASCADE DELETE**: Deleting a form deletes all its submissions

3. **users → submissions** (one-to-many)
   - One user can submit many form responses
   - `submissions.submitted_by` → `users.id`

---

## Complete Backend Flow

### Submission Flow Architecture

When a user clicks "Submit" on a form, here's the complete journey:

```
┌──────────────┐
│   FRONTEND   │
│ (User clicks │
│   Submit)    │
└──────┬───────┘
       │
       │ POST /api/submissions
       │ Headers: Authorization: Bearer <JWT>
       │ Body: { form_id: "uuid", data: {...} }
       │
       ▼
┌──────────────────────────────────────────────────────┐
│  LAYER 1: FLASK ROUTING & MIDDLEWARE                 │
│  File: app/__init__.py                               │
├──────────────────────────────────────────────────────┤
│  1. CORS validation (app/extensions.py)              │
│     - Checks if request origin is allowed            │
│     - Validates HTTP methods                         │
│                                                      │
│  2. Request parsing                                  │
│     - Parses JSON body                               │
│     - Extracts headers                               │
│                                                      │
│  3. Route matching: /api/submissions                 │
│     - Maps to submissions_bp blueprint               │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────┐
│  LAYER 2: AUTHENTICATION                             │
│  File: app/auth/decorators.py                        │
├──────────────────────────────────────────────────────┤
│  @require_permission('submit_form')                  │
│                                                      │
│  1. verify_jwt_in_request()                          │
│     - Checks JWT token exists in Authorization       │
│     - Validates token signature                      │
│     - Checks token not expired                       │
│                                                      │
│  2. get_jwt_identity()                               │
│     - Extracts user_id from token payload            │
│                                                      │
│  3. User.query.get(user_id)                          │
│     - Loads user from database                       │
│     - Checks user exists and is active               │
│                                                      │
│  4. user.has_permission('submit_form')               │
│     - Checks RBAC permissions                        │
│     - admin: ✓ | data_entry: ✓ | viewer: ✗          │
│                                                      │
│  If failed: Return 403 Forbidden                     │
│  If success: Continue to route handler               │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────┐
│  LAYER 3: REQUEST VALIDATION                         │
│  File: app/submissions/routes.py                     │
├──────────────────────────────────────────────────────┤
│  @submissions_bp.route('', methods=['POST'])         │
│  def create_submission():                            │
│                                                      │
│  1. SubmissionSchema().load(request.json)            │
│     - Validates form_id is valid UUID                │
│     - Validates data is Dict                         │
│     - Checks required fields present                 │
│                                                      │
│  2. If validation fails:                             │
│     return jsonify({                                 │
│         'message': 'Validation error',               │
│         'errors': e.messages                         │
│     }), 400                                          │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────┐
│  LAYER 4: BUSINESS LOGIC                             │
│  File: app/submissions/services.py                   │
├──────────────────────────────────────────────────────┤
│  SubmissionService.create_submission(form_id, data)  │
│                                                      │
│  STEP 1: Validate Form Exists                        │
│    form = Form.query.get(form_id)                    │
│    if not form or not form.is_active:                │
│        return None, "Form not found or inactive"     │
│                                                      │
│  STEP 2: Create Submission Object                    │
│    submission = Submission(                          │
│        form_id=form_id,                              │
│        data=data,                                    │
│        submitted_by=current_user.id                  │
│    )                                                 │
│    submission.form = form  # Set relationship        │
│                                                      │
│  STEP 3: Validate Submission Data                    │
│    is_valid, result = submission.validate_against_   │
│                       form()                         │
│    (See detailed validation flow below)              │
│                                                      │
│  STEP 4: Save to Database                            │
│    db.session.add(submission)                        │
│    db.session.commit()                               │
│                                                      │
│  STEP 5: Return Result                               │
│    return submission, "Submission created success"   │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────┐
│  LAYER 5: DATA VALIDATION ENGINE                     │
│  File: app/submissions/models.py                     │
├──────────────────────────────────────────────────────┤
│  submission.validate_against_form()                  │
│                                                      │
│  STEP 1: Extract Form Schema                         │
│    schema = form.schema                              │
│    if 'pages' in schema:                             │
│        # Multi-page form                             │
│        all_fields = []                               │
│        for page in schema['pages']:                  │
│            all_fields.extend(page['fields'])         │
│    else:                                             │
│        # Single-page form                            │
│        all_fields = schema['fields']                 │
│                                                      │
│  STEP 2: Check Visibility Rules                      │
│    def is_field_visible(field):                      │
│        rules = field.get('visibilityRules', [])      │
│        if not rules: return True                     │
│        for rule in rules:                            │
│            # Evaluate rule based on operator         │
│            if operator == 'equals':                  │
│                if field_value != rule_value:         │
│                    return False                      │
│            # ... (8 operators total)                 │
│        return True                                   │
│                                                      │
│  STEP 3: Validate Required Fields                    │
│    for field in all_fields:                          │
│        if not is_field_visible(field):               │
│            continue  # Skip hidden fields            │
│        if field.required:                            │
│            if field.id not in submission.data:       │
│                errors.append("Field required")       │
│                                                      │
│  STEP 4: Validate Field Types                        │
│    - Number: Check min/max constraints               │
│    - Email: Regex validation                         │
│    - Select: Check value in options                  │
│    - Pattern: Regex validation                       │
│                                                      │
│  STEP 5: Return Validation Result                    │
│    if errors:                                        │
│        return False, errors                          │
│    return True, "Valid submission"                   │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────┐
│  LAYER 6: DATABASE PERSISTENCE                       │
│  File: app/extensions.py                             │
├──────────────────────────────────────────────────────┤
│  SQLAlchemy Database Transaction                     │
│                                                      │
│  1. db.session.add(submission)                       │
│     - Adds submission to transaction queue           │
│                                                      │
│  2. db.session.commit()                              │
│     - Generates SQL INSERT statement                 │
│     - Executes transaction                           │
│     - Enforces foreign key constraints               │
│                                                      │
│  3. If error: db.session.rollback()                  │
│     - Reverts transaction                            │
│     - Returns error message                          │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────┐
│  LAYER 7: RESPONSE GENERATION                        │
│  File: app/submissions/routes.py                     │
├──────────────────────────────────────────────────────┤
│  1. submission.to_dict()                             │
│     - Converts SQLAlchemy object to dictionary       │
│     - Adds computed fields                           │
│                                                      │
│  2. jsonify({                                        │
│        'message': 'Submission created successfully', │
│        'submission': {...}                           │
│    })                                                │
│                                                      │
│  3. Return with HTTP 201 Created                     │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────┐
│  FRONTEND RECEIVES RESPONSE                          │
│  - Shows success message                             │
│  - Redirects to /submissions page                    │
└──────────────────────────────────────────────────────┘
```

---

## Architecture Layers

### Layer Diagram

```
┌─────────────────────────────────────┐
│  LAYER 1: HTTP Server (Flask)      │
│  - Receives HTTP requests           │
│  - CORS handling                    │
│  - Route matching                   │
│  - Blueprint registration           │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│  LAYER 2: Authentication (JWT)     │
│  - Token verification               │
│  - User loading from database       │
│  - Permission checking (RBAC)       │
│  - Session management               │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│  LAYER 3: Request Validation       │
│  - Schema validation (Marshmallow)  │
│  - Data type checking               │
│  - Required field checking          │
│  - Format validation                │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│  LAYER 4: Business Logic           │
│  - SubmissionService                │
│  - FormService                      │
│  - AnalyticsService                 │
│  - Data processing                  │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│  LAYER 5: Data Models (SQLAlchemy) │
│  - Submission model                 │
│  - Form model                       │
│  - User model                       │
│  - Validation logic                 │
│  - Relationships                    │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│  LAYER 6: Database (PostgreSQL)    │
│  - JSONB storage                    │
│  - Foreign keys                     │
│  - Indexes                          │
│  - Transactions                     │
└─────────────────────────────────────┘
```

---

## Security Features

### 1. SQL Injection Prevention

**Method:** SQLAlchemy ORM with parameterized queries

**Example:**
```python
# SAFE - SQLAlchemy parameterizes automatically
form = Form.query.get(form_id)
submissions = Submission.query.filter_by(form_id=form_id).all()
```

---

### 2. Authentication Security

**Password Hashing:**
```python
from werkzeug.security import generate_password_hash, check_password_hash

# Registration
password_hash = generate_password_hash(password, method='bcrypt')

# Login
is_valid = check_password_hash(user.password_hash, provided_password)
```

**JWT Token Security:**
- Secret Key: Random 256-bit key
- Expiration: Access tokens expire in 1 hour
- Refresh Tokens: Expire in 30 days
- Algorithm: HS256

---

### 3. Role-Based Access Control (RBAC)

**Permission Matrix:**

| Role        | submit_form | view_submission | create_form | delete_form |
|-------------|-------------|-----------------|-------------|-------------|
| admin       | ✓           | ✓ (all)         | ✓           | ✓           |
| data_entry  | ✓           | ✓ (own only)    | ✗           | ✗           |
| viewer      | ✗           | ✓ (all)         | ✗           | ✗           |

---

## Data Validation Details

### Conditional Logic (Visibility Rules)

**Supported Operators:**

| Operator | Description | Example |
|----------|-------------|---------|
| `equals` | Exact match | `country == "USA"` |
| `notEquals` | Not equal | `answer != "No"` |
| `contains` | Contains substring | `bio contains "doctor"` |
| `notContains` | Doesn't contain | `comment not contains "spam"` |
| `greaterThan` | Numeric > | `age > 18` |
| `lessThan` | Numeric < | `score < 50` |
| `greaterThanOrEqual` | Numeric >= | `satisfaction >= 7` |
| `lessThanOrEqual` | Numeric <= | `pain_level <= 3` |

---

## Key Files Reference

### Backend Files

**Core Application:**
- `app/__init__.py` - Flask app factory
- `app/config.py` - Configuration settings
- `app/extensions.py` - Database initialization

**Authentication:**
- `app/auth/routes.py` - Login, register endpoints
- `app/auth/services.py` - Auth business logic
- `app/auth/decorators.py` - JWT verification

**Forms:**
- `app/forms/routes.py` - Form CRUD endpoints
- `app/forms/services.py` - Form management
- `app/forms/models.py` - Form model

**Submissions:**
- `app/submissions/routes.py` - Submission endpoints
- `app/submissions/services.py` - Submission logic
- `app/submissions/models.py` - Validation engine

**Analytics:**
- `app/analytics/routes.py` - Analytics endpoints
- `app/analytics/services.py` - Calculations

**Public Access:**
- `app/public/routes.py` - Anonymous submissions

---

## Summary

### Technology Stack

**Backend:**
- Web Framework: Flask 3.0.0
- Database: PostgreSQL with JSONB
- ORM: SQLAlchemy
- Authentication: Flask-JWT-Extended
- Validation: Marshmallow

**Data Storage:**
- Primary Storage: PostgreSQL `submissions` table
- Format: JSONB (flexible, queryable JSON)
- Location: localhost:5432/cv_raman_health

### Key Features

1. ✅ 14 Field Types
2. ✅ Multi-Page Forms with Progress Bar
3. ✅ Conditional Logic (8 operators)
4. ✅ Pattern Validation
5. ✅ Public Form Sharing
6. ✅ CSV/Excel Export
7. ✅ Real-time Analytics
8. ✅ Role-Based Access Control

---

**Documentation Version:** 1.0
**Last Updated:** February 22, 2026
