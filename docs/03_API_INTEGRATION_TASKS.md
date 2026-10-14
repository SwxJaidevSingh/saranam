# API Integration & Documentation Tasks

This document outlines the tasks needed to ensure the API layer is correctly documented, secure, and functioning as intended before deployment.

## 1. Documentation Fixes
The `API_DOCUMENTATION.md` needs to reflect the reality of the codebase to prevent integration errors.
- [ ] **Remove Non-Existent Endpoints:** Remove `GET /api/appointments/upcoming`, `GET /api/providers/<provider_id>/stats`, and `POST /api/appointments/<appointment_id>/confirm` from documentation, as these are superseded by query parameter filters on existing endpoints.
- [ ] **Update Cohorts Endpoints:** Correct the URLs from `/members` to `/patients` (e.g., `GET /api/cohorts/<cohort_id>/patients`). Remove manual add/remove cohort member documentation, and replace it with instructions on criteria-based auto-population (`POST /api/cohorts/<cohort_id>/recalculate`).

## 2. API Bug Fixes
- [ ] **Patient Creation Serialization:** The `POST /api/patients` endpoint occasionally throws "Object of type ValueError is not JSON serializable". Fix the error handler to catch and serialize validation issues correctly.
- [ ] **Availability Slots API:** The `GET /api/providers/<provider_id>/availability` endpoint currently returns 0 slots for future dates due to incomplete `effective_from` query logic.

## 3. Testing & Coverage
- [ ] **Test Coverage:** Test remaining untested endpoints documented in `API_DOCUMENTATION.md`, specifically the Auth refresh and Forms endpoints.
- [ ] **Automated Tests:** Ensure the `test_e2e_appointments.py` succeeds 100% after fixing the Availability API and Patient Creation endpoints.

## 4. API Security
- [ ] **Payload Validation:** Ensure strict input validation using Marshmallow or Pydantic for all `POST` and `PUT` request bodies, discarding unallowed fields.
- [ ] **JWT Refresh:** Verify that JWT Access Token (1-hour expiry) and Refresh Token (30-day expiry) flows function correctly across all secured endpoints.
