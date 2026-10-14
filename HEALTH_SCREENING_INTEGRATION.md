# Health Screening → CV Raman Integration Guide

**Date:** March 13, 2026
**Version:** 1.0.0
**Status:** ✅ Implementation Complete

---

## Overview

This guide covers the complete integration between the Health Screening PWA (offline-first mobile app) and CV Raman healthcare management platform. The integration enables one-way real-time data synchronization, making CV Raman the central data warehouse for all health screening activities.

---

## Architecture

```
┌─────────────────────────────────┐
│ Health Screening PWA            │
│ (Next.js + IndexedDB)           │
└──────────────┬──────────────────┘
               │ Sync when online
               ▼
┌─────────────────────────────────┐
│ Offlineappmiddleware            │
│ (Flask Backend + PostgreSQL)    │
└──────────────┬──────────────────┘
               │ Real-time webhook/sync
               ▼
┌─────────────────────────────────┐
│ CV Raman Flask Backend          │
│ (/api/external/* endpoints)     │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│ CV Raman Database               │
│ (Central Data Warehouse)        │
└─────────────────────────────────┘
```

---

## Setup Instructions

### Step 1: Run Database Migration (CV Raman)

```bash
cd "/Users/farzanmanzer/CV Health/cv-raman-health/backend"

# Apply migration
python -m flask db upgrade

# Verify migration
python -m flask db current
# Should show: 84980545a372 (head) - add external integration tracking fields
```

**What this does:**
- Adds `source_system`, `external_id`, `external_metadata` to `patients` table
- Adds `source_system`, `external_submission_id`, `external_metadata` to `form_submissions` table
- Adds `api_key_hash` to `users` table for service accounts

### Step 2: Create Service Account (CV Raman)

```bash
cd "/Users/farzanmanzer/CV Health/cv-raman-health/backend"

# Run service account creation script
python scripts/create_service_account.py
```

**Output will include:**
```
✅ SERVICE ACCOUNT CREATED SUCCESSFULLY
Email:    healthscreening_sync@system
User ID:  <uuid>
Role:     data_entry

🔑 API KEY (SAVE THIS - IT WON'T BE SHOWN AGAIN):
cvr_<long-random-string>
```

**IMPORTANT:** Save the API key immediately - it cannot be retrieved later!

### Step 3: Configure Offlineappmiddleware

Add to `/Users/farzanmanzer/offlineapp/offlineappmiddleware/.env`:

```bash
# CV Raman Integration
CV_RAMAN_API_URL=http://localhost:5002
CV_RAMAN_API_KEY=cvr_<your-api-key-from-step-2>
CV_RAMAN_SYNC_ENABLED=true
CV_RAMAN_SYNC_RETRY_ATTEMPTS=3
CV_RAMAN_SYNC_RETRY_DELAY=5
CV_RAMAN_SYNC_BATCH_SIZE=50
CV_RAMAN_SYNC_TIMEOUT=30
```

### Step 4: Create Form Mapping

Create `/Users/farzanmanzer/offlineapp/offlineappmiddleware/form_mapping.json`:

```json
{
  "10": "uuid-of-cv-raman-form-1",
  "11": "uuid-of-cv-raman-form-2",
  "12": "uuid-of-cv-raman-form-3"
}
```

**How to get CV Raman form UUIDs:**
```bash
# List all forms in CV Raman
curl -X POST http://localhost:5002/api/external/auth/token \
     -H 'X-API-Key: cvr_<your-api-key>' \
     | jq -r '.access_token'

# Use the token to list forms
TOKEN="<token-from-above>"

curl -X GET http://localhost:5002/api/external/forms \
     -H "Authorization: Bearer $TOKEN" \
     | jq '.forms[] | {id, name}'
```

### Step 5: Start Services

```bash
# Terminal 1: Start CV Raman backend
cd "/Users/farzanmanzer/CV Health/cv-raman-health/backend"
python run.py

# Terminal 2: Start offlineappmiddleware
cd /Users/farzanmanzer/offlineapp/offlineappmiddleware
python app.py
```

### Step 6: Test Integration

```bash
# Test 1: Authenticate with API key
curl -X POST http://localhost:5002/api/external/auth/token \
     -H 'X-API-Key: cvr_<your-api-key>'

# Expected response:
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {
    "id": "...",
    "email": "healthscreening_sync@system",
    "role": "data_entry"
  }
}

# Test 2: List forms
TOKEN="<access-token-from-test-1>"

curl -X GET http://localhost:5002/api/external/forms \
     -H "Authorization: Bearer $TOKEN"

# Test 3: Health check
curl -X GET http://localhost:5002/api/external/health
```

### Step 7: Run Historical Data Migration (Optional)

```bash
cd /Users/farzanmanzer/offlineapp/offlineappmiddleware

# Dry run first (doesn't actually sync)
python migrate_historical_data.py --dry-run

# Run actual migration
python migrate_historical_data.py

# Or with custom batch size
python migrate_historical_data.py --batch-size 100
```

---

## API Endpoints

### Authentication

#### Exchange API Key for JWT Token

```http
POST /api/external/auth/token
Headers:
  X-API-Key: cvr_<your-api-key>

Response (200):
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {...}
}
```

### Forms

#### List Available Forms

```http
GET /api/external/forms?limit=50&offset=0
Headers:
  Authorization: Bearer <token>

Response (200):
{
  "forms": [
    {
      "id": "uuid",
      "name": "Health Screening Form",
      "description": "...",
      "version": 1,
      "is_active": true,
      "field_count": 15
    }
  ],
  "total": 10,
  "limit": 50,
  "offset": 0
}
```

#### Get Form Schema

```http
GET /api/external/forms/{form_id}
Headers:
  Authorization: Bearer <token>

Response (200):
{
  "id": "uuid",
  "name": "Health Screening Form",
  "schema": {
    "fields": [...]
  },
  "version": 1,
  "is_active": true
}
```

### Submissions

#### Create Submission

```http
POST /api/external/submissions
Headers:
  Authorization: Bearer <token>
  Content-Type: application/json

Body:
{
  "form_id": "uuid",
  "data": {
    "bp_systolic": 130,
    "bp_diastolic": 80,
    "heart_rate": 78,
    "temperature": 98.6
  },
  "external_context": {
    "source_system": "health_screening",
    "external_submission_id": "1203",
    "external_patient_id": "501",
    "external_form_id": "10",
    "metadata": {
      "camp_id": 5,
      "camp_name": "Rural Health Camp - Patna",
      "latitude": 25.5941,
      "longitude": 85.1376
    }
  }
}

Response (201):
{
  "success": true,
  "message": "Submission processed successfully",
  "submission_id": "uuid",
  "cv_raman_id": "uuid",
  "external_submission_id": "1203",
  "patient_id": "uuid",
  "patient_created": false,
  "encounter_id": "uuid",
  "encounter_created": true,
  "observations_created": 6,
  "processing_summary": {...}
}
```

#### Bulk Create Submissions

```http
POST /api/external/submissions/bulk
Headers:
  Authorization: Bearer <token>
  Content-Type: application/json

Body:
{
  "submissions": [
    {
      "form_id": "uuid",
      "data": {...},
      "external_context": {...}
    },
    ...
  ]
}

Response (200):
{
  "total": 10,
  "success": 9,
  "failed": 1,
  "duplicates": 0,
  "errors": [...],
  "submissions": [...]
}
```

#### Check Submission Status

```http
GET /api/external/submissions/{external_id}?source_system=health_screening
Headers:
  Authorization: Bearer <token>

Response (200):
{
  "exists": true,
  "submission_id": "uuid",
  "external_submission_id": "1203",
  "source_system": "health_screening",
  "status": "submitted",
  "submitted_at": "2026-03-13T10:30:00Z"
}
```

### Health Check

```http
GET /api/external/health

Response (200):
{
  "status": "healthy",
  "service": "cv_raman_external_api",
  "version": "1.0.0",
  "timestamp": "2026-03-13T10:30:00Z"
}
```

---

## Data Mapping

### Patient Mapping

| Health Screening | CV Raman | Notes |
|------------------|----------|-------|
| `id` | `external_id` | Stored as string |
| `name` | `full_name` | Direct mapping |
| `phone_no` | `contact_encrypted` | Encrypted in CV Raman |
| `address` | `address_encrypted` | Encrypted in CV Raman |
| `gender` | `gender` | Mapped: Male/Female/Other |
| `date_of_birth` | `date_of_birth` | ISO 8601 format |
| `latitude`, `longitude` | `external_metadata` | Stored in JSONB |
| `camp_id` | `external_metadata` | Stored in JSONB |
| - | `source_system` | Set to "health_screening" |

### Submission Mapping

| Health Screening | CV Raman | Notes |
|------------------|----------|-------|
| `id` | `external_submission_id` | Original ID |
| `patient_id` | Via `external_patient_id` | Linked to CV Raman patient |
| `form_id` | Via mapping | Mapped to CV Raman form UUID |
| `responses` | `data` + `FormAnswer` records | Relational storage |
| `camp_id` | `external_metadata` | Stored in JSONB |
| - | `source_system` | Set to "health_screening" |

---

## Error Handling

### Network Failures

**Behavior:** Automatic retry with exponential backoff (5s, 10s, 20s, 40s, 80s)

**Logs:**
```
WARNING - Sync attempt 1/3 failed: Network error: Connection refused
INFO - Retrying in 5 seconds...
```

### Duplicate Detection

**Behavior:** Idempotent - returns success if submission already exists

**Response:**
```json
{
  "success": true,
  "duplicate": true,
  "message": "Submission already exists (idempotent)",
  "submission_id": "uuid"
}
```

### Validation Errors

**Response:**
```json
{
  "success": false,
  "error": "Validation error",
  "message": "Field 'bp_systolic' must be between 60 and 250"
}
```

---

## Monitoring

### Sync Status Logging

All sync operations are logged with:
- Timestamp
- Submission ID (Health Screening)
- CV Raman submission ID (if successful)
- Success/failure status
- Error messages (if failed)

### Key Metrics to Monitor

- **Sync success rate:** Should be > 99%
- **Sync latency (P95):** Should be < 5 seconds
- **Failed submissions in retry queue:** Should be < 50
- **Duplicate detection rate:** Expected due to retries

---

## Troubleshooting

### Issue: "CV_RAMAN_API_KEY not set in environment"

**Solution:**
```bash
cd /Users/farzanmanzer/offlineapp/offlineappmiddleware
echo "CV_RAMAN_API_KEY=cvr_<your-key>" >> .env
```

### Issue: "No form mapping for Health Screening form X"

**Solution:**
1. Get CV Raman form UUID (see Step 4 above)
2. Add mapping to `form_mapping.json`:
```json
{
  "X": "uuid-of-cv-raman-form"
}
```

### Issue: "Authentication failed: 401"

**Possible causes:**
- API key is invalid or expired
- Service account was disabled

**Solution:**
```bash
# Regenerate API key
cd "/Users/farzanmanzer/CV Health/cv-raman-health/backend"
python scripts/create_service_account.py
# Answer "yes" to regenerate API key
```

### Issue: "Failed to sync submission: Form not found"

**Solution:**
- Check form_id in `form_mapping.json` is correct
- Verify form exists and is active in CV Raman

---

## Files Created

### CV Raman Backend

```
backend/
├── migrations/versions/
│   └── 84980545a372_add_external_integration_tracking_fields.py
├── app/
│   ├── common/models.py (updated - added api_key_hash)
│   ├── patients/models.py (updated - added external tracking)
│   ├── submissions/models.py (updated - added external tracking)
│   └── external/
│       ├── __init__.py
│       ├── auth.py
│       ├── routes.py
│       └── services.py
└── scripts/
    └── create_service_account.py
```

### Offlineappmiddleware

```
offlineappmiddleware/
├── cv_raman_client.py
├── transformers.py
├── sync_manager.py
├── migrate_historical_data.py
└── form_mapping.json (to be created by user)
```

---

## Next Steps

1. ✅ Database migration applied
2. ✅ Service account created
3. ⏳ Configure `form_mapping.json`
4. ⏳ Test integration with sample submission
5. ⏳ Run historical data migration
6. ⏳ Monitor sync logs for errors
7. ⏳ Set up production environment variables

---

## Support

For issues or questions:
- Check logs: `/Users/farzanmanzer/offlineapp/offlineappmiddleware/app.log`
- Review CV Raman logs: `/Users/farzanmanzer/CV Health/cv-raman-health/backend/logs/`
- Check this documentation for troubleshooting steps

---

**Document Version:** 1.0.0
**Last Updated:** March 13, 2026
**Status:** ✅ Implementation Complete
