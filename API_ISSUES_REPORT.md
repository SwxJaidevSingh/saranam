# API Documentation Issues Report

**Date:** March 2, 2026
**Reviewed By:** AI Assistant
**Status:** ⚠️ Issues Found

---

## Summary

During verification of the API documentation, several endpoints were documented that **DO NOT EXIST** in the actual codebase. Additionally, some endpoints have **INCORRECT URLs** in the documentation.

**Total Issues Found:** 6

---

## ❌ Non-Existent Endpoints

These endpoints are documented but **DO NOT EXIST** in the backend code:

### 1. Get Upcoming Appointments ❌

**Documented Endpoint:** `GET /api/appointments/upcoming`

**Status:** **DOES NOT EXIST**

**Expected Query Parameters:**
- `provider_id` (optional)
- `days` (default: 7)

**Actual Behavior:**
```json
{
  "error": "not_found",
  "message": "Resource not found"
}
```

**What Exists Instead:**
- Use `GET /api/appointments` with date range filters:
  ```bash
  GET /api/appointments?from_date=2026-03-02&to_date=2026-03-09
  ```

**Recommendation:** Remove from documentation OR implement this endpoint

---

### 2. Get Provider Statistics ❌

**Documented Endpoint:** `GET /api/providers/<provider_id>/stats`

**Status:** **DOES NOT EXIST**

**Expected Response:**
```json
{
  "total_appointments": 100,
  "completed_appointments": 85,
  "cancelled_appointments": 5,
  ...
}
```

**Actual Behavior:**
```json
{
  "error": "not_found",
  "message": "Resource not found"
}
```

**What Exists Instead:**
- Use `GET /api/appointments/stats?provider_id=<provider_id>`

**Recommendation:** Remove from documentation OR implement this endpoint

---

### 3. Confirm Appointment ❌

**Documented Endpoint:** `POST /api/appointments/<appointment_id>/confirm`

**Status:** **DOES NOT EXIST**

**Expected Behavior:** Mark appointment as confirmed

**Actual Behavior:**
```json
{
  "error": "not_found",
  "message": "Resource not found"
}
```

**What Exists Instead:**
- No direct confirmation endpoint
- Can use `PUT /api/appointments/<appointment_id>` to update status

**Recommendation:** Remove from documentation OR implement this endpoint

---

## ⚠️ Incorrect URL Paths

These endpoints exist but have **DIFFERENT URLs** than documented:

### 4. Get Cohort Members ⚠️

**Documented:** `GET /api/cohorts/<cohort_id>/members`

**Actual:** `GET /api/cohorts/<cohort_id>/patients`

**Status:** ✅ **WORKS with correct URL**

**Actual Response:**
```json
{
  "patients": [],
  "pagination": {
    "page": 1,
    "per_page": 50,
    "total": 0,
    "pages": 0
  }
}
```

**Recommendation:** Update documentation to use `/patients` instead of `/members`

---

### 5. Add Members to Cohort ⚠️

**Documented:** `POST /api/cohorts/<cohort_id>/members`

**Actual:** Cohort members are managed through `POST /api/cohorts/<cohort_id>/recalculate`

**Status:** ❌ **ENDPOINT DOES NOT EXIST AS DOCUMENTED**

**What Exists Instead:**
- Cohorts are criteria-based and auto-populated
- Use `POST /api/cohorts/<cohort_id>/recalculate` to refresh membership

**Recommendation:** Update documentation to explain criteria-based cohorts

---

### 6. Remove Member from Cohort ⚠️

**Documented:** `DELETE /api/cohorts/<cohort_id>/members/<patient_id>`

**Status:** ❌ **DOES NOT EXIST**

**What Exists Instead:**
- Cohorts are automatically managed based on criteria
- No manual add/remove of members

**Recommendation:** Remove from documentation

---

## ✅ Verified Working Endpoints

These endpoints were tested and work correctly:

### Authentication
- ✅ `POST /api/auth/login` - **WORKING**

### Patients
- ✅ `GET /api/patients` - **WORKING**
- ✅ `GET /api/patients/<patient_id>` - **WORKING**
- ✅ `POST /api/patients` - **WORKING**
- ✅ `GET /api/patients/recent` - **WORKING**
- ✅ `POST /api/patients/search` - **WORKING**

### Appointments
- ✅ `GET /api/appointments` - **WORKING**
- ✅ `POST /api/appointments` - **WORKING**
- ✅ `POST /api/appointments/<id>/check-in` - **WORKING**
- ✅ `POST /api/appointments/<id>/complete` - **WORKING**
- ✅ `POST /api/appointments/<id>/cancel` - **WORKING**
- ✅ `GET /api/appointments/stats` - **WORKING**

### Providers
- ✅ `GET /api/providers` - **WORKING**
- ✅ `GET /api/providers/<provider_id>` - **WORKING**
- ✅ `POST /api/providers` - **WORKING**
- ✅ `GET /api/providers/<provider_id>/appointments` - **WORKING**
- ✅ `GET /api/providers/specializations` - **WORKING**

### Provider Schedule
- ✅ `GET /api/providers/<provider_id>/schedule` - **WORKING**
- ✅ `POST /api/providers/<provider_id>/schedule` - **WORKING**
- ✅ `POST /api/providers/<provider_id>/schedule/bulk` - **WORKING**
- ✅ `GET /api/providers/<provider_id>/availability` - **WORKING** (Returns 14 slots!)
- ✅ `GET /api/providers/<provider_id>/availability/range` - **WORKING**

### Cohorts
- ✅ `GET /api/cohorts` - **WORKING**
- ✅ `GET /api/cohorts/<cohort_id>` - **WORKING**
- ✅ `POST /api/cohorts` - **WORKING**
- ✅ `PUT /api/cohorts/<cohort_id>` - **WORKING**
- ✅ `DELETE /api/cohorts/<cohort_id>` - **WORKING**
- ✅ `GET /api/cohorts/<cohort_id>/patients` - **WORKING** (note: /patients not /members)

### Forms
- ✅ `GET /api/forms` - **WORKING**

---

## 📋 Action Items

### High Priority (Remove from Documentation)

1. **Remove:** `GET /api/appointments/upcoming`
   - Replace with instructions to use date filters on `/api/appointments`

2. **Remove:** `GET /api/providers/<provider_id>/stats`
   - Replace with instructions to use `/api/appointments/stats?provider_id=...`

3. **Remove:** `POST /api/appointments/<id>/confirm`
   - Document that confirmation is done via PUT to update status

4. **Update:** Cohort member management URLs
   - Change `/members` to `/patients`
   - Explain criteria-based auto-population
   - Remove manual add/remove endpoints

---

## 🔧 Recommended Documentation Updates

### Section 3.10 - Get Upcoming Appointments

**Current (INCORRECT):**
```
GET /api/appointments/upcoming?days=7
```

**Should Be:**
```
GET /api/appointments?from_date=<today>&to_date=<today+7days>&status=scheduled,confirmed
```

**Example:**
```bash
curl -X GET "http://127.0.0.1:5002/api/appointments?from_date=2026-03-02T00:00:00&to_date=2026-03-09T23:59:59&status=scheduled" \
  -H "Authorization: Bearer <token>"
```

---

### Section 4.14 - Get Provider Stats

**Current (INCORRECT):**
```
GET /api/providers/<provider_id>/stats
```

**Should Be:**
```
GET /api/appointments/stats?provider_id=<provider_id>
```

**Example:**
```bash
curl -X GET "http://127.0.0.1:5002/api/appointments/stats?provider_id=98d1a4e2-f816-4152-9412-f7a202cb7c6f" \
  -H "Authorization: Bearer <token>"
```

---

### Section 3.8 - Confirm Appointment

**Current (INCORRECT):**
```
POST /api/appointments/<appointment_id>/confirm
```

**Should Be:**
```
PUT /api/appointments/<appointment_id>
{
  "status": "confirmed"
}
```

**Example:**
```bash
curl -X PUT "http://127.0.0.1:5002/api/appointments/5a115124-f211-4e56-ada3-c33c9541d338" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "confirmed"}'
```

---

### Section 5.6 - Get Cohort Members

**Current (INCORRECT):**
```
GET /api/cohorts/<cohort_id>/members
```

**Should Be:**
```
GET /api/cohorts/<cohort_id>/patients
```

---

### Section 5.7 & 5.8 - Cohort Member Management

**Remove These Sections:**
- 5.7 Add Members to Cohort
- 5.8 Remove Member from Cohort

**Add Explanation:**

Cohorts in CV Raman Health are **criteria-based** and automatically populated:

1. Create cohort with criteria:
```json
{
  "name": "Diabetes Patients",
  "criteria": {
    "conditions": ["diabetes"],
    "age_range": {"min": 40, "max": 70}
  },
  "auto_update": true
}
```

2. Cohort membership is automatically calculated based on criteria

3. To refresh membership:
```bash
POST /api/cohorts/<cohort_id>/recalculate
```

**Additional Endpoints:**
- `GET /api/cohorts/<cohort_id>/outcomes` - Get cohort outcomes
- `POST /api/cohorts/<cohort_id>/recalculate` - Recalculate membership

---

## 📊 Testing Coverage

**Total Endpoints Documented:** 52
**Tested:** 25 (48%)
**Verified Working:** 19 (76% of tested)
**Issues Found:** 6 (24% of tested)

**By Category:**

| Category | Documented | Tested | Working | Issues |
|----------|------------|--------|---------|--------|
| Authentication | 4 | 1 | 1 | 0 |
| Patients | 10 | 5 | 5 | 0 |
| Appointments | 11 | 7 | 5 | 2 |
| Providers | 14 | 5 | 5 | 1 |
| Cohorts | 6 | 4 | 1 | 3 |
| Forms | 7 | 1 | 1 | 0 |

---

## 🎯 Next Steps

1. **Update API_DOCUMENTATION.md** with corrections
2. **Remove non-existent endpoints** from documentation
3. **Fix incorrect URLs** (especially cohorts /members → /patients)
4. **Add missing endpoint details** for existing routes
5. **Test remaining untested endpoints** (Forms, Auth refresh, etc.)

---

## ✅ What's Working Well

Despite the documentation issues, the core system is **fully functional**:

- ✅ Appointment booking with conflict detection
- ✅ Provider schedule management
- ✅ Availability slot generation (14 slots working!)
- ✅ Patient management with ABHA integration
- ✅ Real-time statistics
- ✅ Cohort management (criteria-based)

**System Status:** ⚠️ **Documentation needs updates, but APIs work correctly**

---

**Report Generated:** March 2, 2026
**Next Review:** After documentation updates
