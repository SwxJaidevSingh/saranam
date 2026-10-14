# Backend Deployment Readiness Tasks

This document outlines the final steps required for the Python Flask backend to be 100% ready for production deployment.

## 1. Critical Bug Fixes
- [ ] **Fix Patient Creation Serialization:** Resolve the `ValueError is not JSON serializable` error in `/api/patients` endpoint (`backend/app/patients/routes.py`). Ensure all response objects return valid JSON, especially when handling validation errors.
- [ ] **Fix Availability Generation:** Resolve the issue where `GET /api/providers/<id>/availability` returns 0 slots. Check the `effective_from` logic in `schedule_services.py` and ensure future schedules generate correctly without hardcoded dates.

## 2. Security & Environment Configuration
- [ ] **Disable Debug Mode:** Ensure `FLASK_DEBUG=False` and `FLASK_ENV=production` are set for the deployment environment.
- [ ] **Secret Keys Rotation:** Generate secure, production-grade strings for `SECRET_KEY`, `JWT_SECRET_KEY`, and `ENCRYPTION_KEY`. *Never commit these to version control.*
- [ ] **CORS Configuration:** Update `CORS_ORIGINS` in production environment variables to strictly point to the deployed frontend URL, removing `localhost:5173`.
- [ ] **Rate Limiting:** Ensure proper rate limiters are in place on authentication/login endpoints to prevent brute-force attacks.

## 3. Deployment Server Setup
- [ ] **WSGI Configuration:** Ensure the `gunicorn==21.2.0` dependency is properly configured with a `gunicorn.conf.py` or startup script (e.g., `gunicorn -w 4 -b 0.0.0.0:5000 run:app`).
- [ ] **Logging & Audit:** Ensure proper integration of `ENABLE_AUDIT_LOGGING=true`. Configure log rotation and central logging if deploying to AWS/GCP/Render.

## 4. Final Pre-Deployment Checks
- [ ] Run the complete `test_e2e_appointments.py` script and ensure 100% pass rate.
- [ ] Verify that legacy JSONB backup logic works correctly without performance bottlenecks in production (`FEATURE_LEGACY_JSONB_BACKUP=true`).
