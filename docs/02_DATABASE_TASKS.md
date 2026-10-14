# Database & Data Logic Tasks

This document outlines the tasks needed to ensure the database layer (PostgreSQL / Supabase) operates flawlessly before launch.

## 1. Database Connection & Environment
- [ ] **Production Database Verification:** Transition from local Postgres (`postgresql://farzanmanzer@localhost:5432/cv_raman_health`) to the designated production database (Supabase or AWS RDS).
- [ ] **Connection Pooling:** Ensure SQLAlchemy is configured with reasonable pool sizes (`pool_size`, `max_overflow`) to handle concurrent production requests without dropping connections.

## 2. Schema and Migrations
- [ ] **Run All Migrations:** Execute `flask db upgrade` on the production database to ensure all tables, including `healthcare_providers`, `provider_schedules`, `encounters`, and `cohorts`, are fully instantiated.
- [ ] **Seed Essential Data:** Run production-safe seed scripts (e.g., roles, default services, form templates) without injecting dummy patient data.
- [ ] **Verify Indexes:** Double-check that foreign keys and frequently queried columns (e.g., `provider_id` in `encounters`, date ranges) have proper database indexes to prevent slow queries as data grows.

## 3. Database Logic Fixes
- [ ] **Provider Schedules `effective_from` Logic:** Fix the logic in the database schema or querying mechanism where `effective_from` dates cause future availabilities to return empty arrays. Add fallback or default logic.
- [ ] **Cohort Auto-Calculation Verification:** Ensure the criteria-based cohort population logic runs efficiently on the database level without locking tables during recalculation (`POST /api/cohorts/<id>/recalculate`).

## 4. Backups and Compliance
- [ ] **Automated Backups:** Ensure the production database has automated daily backups.
- [ ] **Audit Logging Integrity:** Verify that the `AUDIT_LOG_RETENTION_DAYS=2555` (7 years) compliance requirement is backed by a data lifecycle policy so the database does not fill up indefinitely.
