# CV Raman Health - Form Builder API Documentation

## Table of Contents
1. [Authentication](#authentication)
2. [Forms API](#forms-api)
3. [Submissions API](#submissions-api)
4. [Analytics API](#analytics-api)
5. [Public API](#public-api)
6. [Error Handling](#error-handling)

## Base URL
```
http://localhost:5002/api
```

## Authentication

All protected endpoints require a JWT access token in the Authorization header:
```
Authorization: Bearer <access_token>
```

### Register User
**POST** `/auth/register`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",  // min 8 characters
  "full_name": "John Doe",    // min 2 characters
  "role": "admin"             // optional: admin | data_entry | viewer (default: viewer)
}
```

**Response:** `201 Created`
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "admin",
    "is_active": true,
    "created_at": "2026-02-22T10:00:00Z",
    "updated_at": "2026-02-22T10:00:00Z"
  }
}
```

### Login
**POST** `/auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** `200 OK`
```json
{
  "message": "Login successful",
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "admin",
    "is_active": true
  }
}
```

### Refresh Token
**POST** `/auth/refresh`

**Headers:**
```
Authorization: Bearer <refresh_token>
```

**Response:** `200 OK`
```json
{
  "message": "Token refreshed successfully",
  "access_token": "eyJhbGc..."
}
```

### Get Current User
**GET** `/auth/me`

**Response:** `200 OK`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "admin",
    "is_active": true,
    "created_at": "2026-02-22T10:00:00Z"
  }
}
```

## Forms API

### Get All Forms
**GET** `/forms`

**Query Parameters:**
- `page` (integer, default: 1)
- `per_page` (integer, default: 50, max: 100)

**Response:** `200 OK`
```json
{
  "forms": [
    {
      "id": "uuid",
      "name": "Patient Registration Form",
      "description": "Basic patient registration",
      "schema": { /* form schema */ },
      "is_active": true,
      "is_public": false,
      "share_token": null,
      "created_by": "uuid",
      "creator_email": "user@example.com",
      "submission_count": 42,
      "version": 1,
      "created_at": "2026-02-22T10:00:00Z",
      "updated_at": "2026-02-22T10:00:00Z"
    }
  ],
  "total": 10,
  "pages": 1,
  "current_page": 1
}
```

### Get Form by ID
**GET** `/forms/<form_id>`

**Response:** `200 OK`
```json
{
  "form": {
    "id": "uuid",
    "name": "Patient Registration Form",
    "description": "Basic patient registration",
    "schema": {
      "fields": [
        {
          "id": "patient_name",
          "type": "text",
          "label": "Patient Name",
          "required": true,
          "placeholder": "Enter name",
          "defaultValue": "",
          "helpText": "Full legal name",
          "validation": {
            "pattern": "^[A-Za-z ]{2,50}$",
            "errorMessage": "Name must contain only letters",
            "maxLength": 50
          },
          "visibilityRules": []
        }
      ]
    },
    "is_active": true,
    "is_public": false,
    "submission_count": 42,
    "created_at": "2026-02-22T10:00:00Z"
  }
}
```

### Create Form
**POST** `/forms`

**Request Body:**
```json
{
  "name": "New Form",
  "description": "Form description",
  "schema": {
    "fields": [
      {
        "id": "field_1",
        "type": "text",
        "label": "Field Label",
        "required": true
      }
    ]
  }
}
```

**Multi-Page Form Schema:**
```json
{
  "name": "Multi-Page Form",
  "description": "Form with multiple pages",
  "schema": {
    "pages": [
      {
        "id": "page_1",
        "title": "Page 1",
        "description": "First page description",
        "fields": [ /* array of field objects */ ]
      },
      {
        "id": "page_2",
        "title": "Page 2",
        "description": "Second page description",
        "fields": [ /* array of field objects */ ]
      }
    ]
  }
}
```

**Supported Field Types:**
1. **text** - Single-line text input
2. **number** - Numeric input
3. **email** - Email input with validation
4. **date** - Date picker
5. **time** - Time picker
6. **url** - URL input with validation
7. **phone** - Phone number input
8. **select** - Dropdown selection
9. **radio** - Radio button group
10. **checkbox** - Single checkbox or checkbox group
11. **textarea** - Multi-line text input
12. **linearScale** - Linear scale (rating)
13. **file** - File upload
14. **section** - Section header (non-input)

**Field Configuration Examples:**

**Linear Scale Field:**
```json
{
  "id": "satisfaction",
  "type": "linearScale",
  "label": "Satisfaction Rating",
  "required": true,
  "config": {
    "min": 1,
    "max": 10,
    "minLabel": "Not Satisfied",
    "maxLabel": "Very Satisfied"
  }
}
```

**File Upload Field:**
```json
{
  "id": "profile_picture",
  "type": "file",
  "label": "Profile Picture",
  "required": false,
  "helpText": "Upload a profile picture (max 5MB)",
  "config": {
    "maxSize": 5242880,
    "acceptedTypes": ["image/jpeg", "image/png"]
  }
}
```

**Field with Validation:**
```json
{
  "id": "age",
  "type": "number",
  "label": "Age",
  "required": true,
  "validation": {
    "min": 18,
    "max": 120,
    "errorMessage": "Age must be between 18 and 120"
  }
}
```

**Field with Conditional Logic:**
```json
{
  "id": "follow_up_question",
  "type": "textarea",
  "label": "Please explain",
  "required": true,
  "visibilityRules": [
    {
      "field": "has_condition",
      "operator": "equals",
      "value": "Yes"
    }
  ]
}
```

**Supported Operators for Visibility Rules:**
- `equals` - Field value equals specified value
- `notEquals` - Field value does not equal specified value
- `contains` - Field value contains specified string (case-insensitive)
- `notContains` - Field value does not contain specified string
- `greaterThan` - Numeric field value greater than specified value
- `lessThan` - Numeric field value less than specified value
- `greaterThanOrEqual` - Numeric field value >= specified value
- `lessThanOrEqual` - Numeric field value <= specified value

**Response:** `201 Created`
```json
{
  "message": "Form created successfully",
  "form": { /* full form object */ }
}
```

### Update Form
**PUT** `/forms/<form_id>`

**Request Body:**
```json
{
  "name": "Updated Form Name",
  "description": "Updated description",
  "schema": { /* updated schema */ }
}
```

**Response:** `200 OK`
```json
{
  "message": "Form updated successfully",
  "form": { /* updated form object */ }
}
```

### Delete Form
**DELETE** `/forms/<form_id>`

**Response:** `200 OK`
```json
{
  "message": "Form deleted successfully"
}
```

### Clone Form
**POST** `/forms/<form_id>/clone`

**Response:** `201 Created`
```json
{
  "message": "Form cloned successfully",
  "form": { /* cloned form object */ }
}
```

### Enable Form Sharing
**POST** `/forms/<form_id>/share`

**Response:** `200 OK`
```json
{
  "message": "Form sharing enabled",
  "share_token": "secure_random_token",
  "share_url": "http://localhost:5173/public/forms/secure_random_token"
}
```

### Disable Form Sharing
**DELETE** `/forms/<form_id>/share`

**Response:** `200 OK`
```json
{
  "message": "Form sharing disabled"
}
```

## Submissions API

### Create Submission
**POST** `/submissions`

**Request Body:**
```json
{
  "form_id": "uuid",
  "data": {
    "field_1": "value1",
    "field_2": "value2",
    "age": 30,
    "satisfaction": 9
  }
}
```

**Response:** `201 Created`
```json
{
  "message": "Submission created successfully",
  "submission": {
    "id": "uuid",
    "form_id": "uuid",
    "form_name": "Patient Registration Form",
    "submitted_by": "uuid",
    "submitter_email": "user@example.com",
    "data": { /* submitted data */ },
    "created_at": "2026-02-22T10:00:00Z",
    "updated_at": "2026-02-22T10:00:00Z"
  }
}
```

### Get All Submissions
**GET** `/submissions`

**Query Parameters:**
- `page` (integer, default: 1)
- `per_page` (integer, default: 50, max: 100)
- `form_id` (uuid, optional) - Filter by form
- `user_id` (uuid, optional) - Filter by submitter
- `date_from` (ISO date, optional) - Filter from date
- `date_to` (ISO date, optional) - Filter to date

**Response:** `200 OK`
```json
{
  "submissions": [ /* array of submission objects */ ],
  "total": 100,
  "pages": 2,
  "current_page": 1
}
```

### Get Submission by ID
**GET** `/submissions/<submission_id>`

**Response:** `200 OK`
```json
{
  "submission": { /* full submission object */ }
}
```

### Update Submission
**PUT** `/submissions/<submission_id>`

**Request Body:**
```json
{
  "data": {
    "field_1": "updated_value"
  }
}
```

**Response:** `200 OK`
```json
{
  "message": "Submission updated successfully",
  "submission": { /* updated submission object */ }
}
```

### Delete Submission
**DELETE** `/submissions/<submission_id>`

**Response:** `200 OK`
```json
{
  "message": "Submission deleted successfully"
}
```

### Export Submissions
**GET** `/submissions/export`

**Query Parameters:**
- `format` (string, required) - `csv` or `excel`
- `form_id` (uuid, required)
- `date_from` (ISO date, optional)
- `date_to` (ISO date, optional)

**Response:** File download (CSV or Excel)

## Analytics API

### Dashboard Stats
**GET** `/analytics/dashboard`

**Response:** `200 OK`
```json
{
  "total_forms": 25,
  "total_submissions": 1542,
  "total_users": 15,
  "submission_trends": [
    {
      "date": "2026-02-15",
      "count": 45
    },
    {
      "date": "2026-02-16",
      "count": 52
    }
  ],
  "recent_submissions": [
    {
      "id": "uuid",
      "form_name": "Patient Form",
      "submitter_email": "user@example.com",
      "created_at": "2026-02-22T10:00:00Z"
    }
  ]
}
```

### Form Analytics
**GET** `/analytics/forms/<form_id>`

**Query Parameters:**
- `date_from` (ISO date, optional)
- `date_to` (ISO date, optional)

**Response:** `200 OK`
```json
{
  "analytics": {
    "form_name": "Patient Registration Form",
    "total_submissions": 150,
    "field_analytics": {
      "gender": {
        "Male": 75,
        "Female": 70,
        "Other": 5
      },
      "country": {
        "United States": 100,
        "Canada": 30,
        "Other": 20
      }
    },
    "numeric_aggregations": {
      "age": {
        "average": 32.5,
        "min": 18,
        "max": 75,
        "median": 30
      },
      "satisfaction": {
        "average": 8.5,
        "min": 1,
        "max": 10,
        "median": 9
      }
    }
  }
}
```

### Form Comparison
**GET** `/analytics/reports/form-comparison`

**Response:** `200 OK`
```json
{
  "comparison": [
    {
      "form_id": "uuid",
      "form_name": "Patient Registration",
      "total_submissions": 150,
      "last_submission": "2026-02-22T10:00:00Z",
      "created_at": "2026-01-15T10:00:00Z"
    },
    {
      "form_id": "uuid",
      "form_name": "Survey Form",
      "total_submissions": 85,
      "last_submission": "2026-02-21T15:30:00Z",
      "created_at": "2026-02-01T10:00:00Z"
    }
  ]
}
```

### User Activity Report
**GET** `/analytics/reports/user-activity`

**Response:** `200 OK`
```json
{
  "activity": [
    {
      "user_id": "uuid",
      "user_email": "user@example.com",
      "total_submissions": 45,
      "forms_created": 5,
      "last_activity": "2026-02-22T10:00:00Z"
    }
  ]
}
```

## Public API

### Get Public Form
**GET** `/public/forms/<share_token>`

**No authentication required**

**Response:** `200 OK`
```json
{
  "form": {
    "id": "uuid",
    "name": "Public Survey",
    "description": "Take our survey",
    "schema": { /* form schema without sensitive data */ }
  }
}
```

### Submit Public Form
**POST** `/public/forms/<share_token>/submit`

**No authentication required**

**Request Body:**
```json
{
  "data": {
    "field_1": "value1",
    "field_2": "value2"
  }
}
```

**Response:** `201 Created`
```json
{
  "message": "Submission created successfully",
  "submission_id": "uuid"
}
```

## Error Handling

All errors follow this format:

**4xx Client Errors:**
```json
{
  "message": "Human-readable error message",
  "error": "error_code",
  "errors": {
    "field_name": ["Validation error message"]
  }
}
```

**Common Error Codes:**
- `validation_error` - Request validation failed
- `authentication_failed` - Invalid credentials
- `unauthorized` - Missing or invalid token
- `forbidden` - Insufficient permissions
- `not_found` - Resource not found
- `creation_failed` - Resource creation failed
- `update_failed` - Resource update failed

**5xx Server Errors:**
```json
{
  "message": "Internal server error",
  "error": "internal_error"
}
```

## Rate Limiting

Currently no rate limiting is enforced in development mode.

## Versioning

API Version: 1.0.0

Future versions will be accessible via `/api/v2/` prefix.

## Testing

Use the provided test scripts in `/tmp/api_test.sh` for comprehensive API testing.

Example using cURL:
```bash
# Login
TOKEN=$(curl -X POST http://localhost:5002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}' \
  -s | jq -r '.access_token')

# Create Form
curl -X POST http://localhost:5002/api/forms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test Form",
    "description": "My test form",
    "schema": {
      "fields": [
        {
          "id": "name",
          "type": "text",
          "label": "Your Name",
          "required": true
        }
      ]
    }
  }'
```

## Support

For issues or questions, contact: support@cvraman.health
