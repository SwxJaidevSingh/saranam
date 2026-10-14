# Backend Architecture and Database Flow Analysis

**Date:** March 9, 2026
**Status:** ✅ Evaluated

This document provides a full analysis of how the backend is structured, its execution flow, and how APIs interact with the PostgreSQL database. Specifically, it addresses how form data is handled and stored.

---

## 1. Backend Architecture & Flow

The backend is built with **Python 3 and Flask** and follows a Service-Oriented Architecture (SOA) design pattern. The flow of data is heavily structured into four distinct layers:

1.  **API Routes (Blueprints):** 
    Found in `app/<module>/routes.py`. These act as the entry points for the React frontend. They handle HTTP requests, authenticate users (via `flask_jwt_extended`), validate incoming JSON payloads using `Marshmallow` schemas, and return JSON responses.
2.  **Service Layer:**
    Found in `app/<module>/services.py`. This layer encapsulates the core business logic. Routes pass validated data to services, which handle operations like checking for schedule conflicts or calculating cohort eligibility.
3.  **Processing Layer (Hybrid Pipeline):**
    Found in `app/processing/`. This is a specialized layer specifically for handling complex form submissions (e.g., `SubmissionProcessor`, `ClinicalExtractor`, `RelationalTransformer`).
4.  **Data Access Layer (Models):**
    Found in `app/<module>/models.py`. The backend uses `SQLAlchemy` ORM. Models map Python classes directly to database tables.

### Execution Flow Example (Submitting a Form):
1. **Frontend** sends `POST /api/submissions` with JSON payload.
2. **Route** (`submissions_bp.create_submission`) validates the payload structure.
3. **Route** instantiates `SubmissionProcessor` and calls `process_submission()`.
4. **Processor** extracts clinical semantics using `ClinicalExtractor`.
5. **Processor** retrieves or creates a `Patient` and an `Encounter` in the DB.
6. **Processor** transforms the raw data using `RelationalTransformer` into relational records.
7. **Processor** commits everything to the database via `SQLAlchemy` transaction.

---

## 2. API to Database Connection

The backend connects to the PostgreSQL database using **Flask-SQLAlchemy**. 
- It uses a connection string defined in the `.env` file (`DATABASE_URL`).
- All database interactions are transactional. If any step of an API request fails (e.g., a required field is missing, or a DB constraint is violated), `db.session.rollback()` is automatically called, ensuring the database remains in a consistent state.

**Database Entities:**
The system is comprehensive and highly relational. Core tables include:
- `users`, `patients`, `healthcare_providers`
- `encounters`, `appointments`, `provider_schedules`
- `forms`, `form_submissions`, `form_answers`
- `observations`, `diagnoses`

---

## 3. Data Structuring: Is it raw JSON or parsed?

**Answer:** The data is **intelligently parsed and structured** before saving. It is NOT just dumped as raw JSON into the database.

### The Hybrid Pipeline Approach
Historically, many healthcare form systems dump form answers into a single `JSON/JSONB` column, making it incredibly difficult to query specific data points (like finding all patients with a blood pressure > 140) or perform analytics.

Your backend uses a **Hybrid Processing Pipeline**:
1. The frontend forms builder sends raw JSON payloads to the backend so the frontend doesn't have to worry about complex relational structures.
2. The `SubmissionProcessor` intercepts this JSON and **parses it**.
3. The `RelationalTransformer` maps specific form fields to their correct, typed data structures.

### How it is stored in the Database:
Instead of a single JSON column, the data is unpacked into the `form_answers` table (represented by the `FormAnswer` model). This table uses **Polymorphic Value Storage**. 

Depending on the field type, the backend places the answer into a specific, strictly typed column:
*   `value_text`: For text, email, url, phone, textarea
*   `value_numeric`: For numbers, pain scales (e.g., Blood Pressure: `120.00`)
*   `value_date`: For dates
*   `value_time`: For times
*   `value_boolean`: For checkboxes (True/False)
*   `value_json`: *(Only used for complex arrays like multi-select dropdowns)*

**Clinical Extraction:**
Furthermore, the `ClinicalExtractor` scans the form submission. If it detects fields that represent crucial medical data (like Vitals or Diagnoses), it doesn't just save them as form answers. It automatically generates records in the `observations` and `diagnoses` tables, ensuring the patient's core medical record is logically structured.

### Conclusion on Data Integrity
The backend is exceptionally well-architected regarding data storage. By parsing the JSON and distributing it logically to relationally structured tables (and strongly typed columns), the database is highly robust, analytics-ready, and compliant with standard healthcare data models.

*Note: The backend currently stores a copy of the raw JSON in the `data_backup` column of the `form_submissions` table for safety, but the actual querying and logic rely on the properly parsed relational tables.*
