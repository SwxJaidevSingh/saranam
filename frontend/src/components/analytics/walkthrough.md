# Walkthrough - Disease Analytics Timeline Switches & Axios Clean-Up

We have completed the integration of timeline selections across all widgets in the Diseases Tab.

## Changes Made

### 1. Backend Route Filtering & Aggregations

#### [services.py](file:///c:/Users/Omen/Downloads/saranam_vehicle/backend/app/analytics/services.py)
- **Clinical Complexity & BSC status:** Updated `_get_complexity_distribution` and `_get_bsc_distribution` to accept optional `start_date` and `end_date` arguments and filter patient datasets by registration date.

#### [routes.py](file:///c:/Users/Omen/Downloads/saranam_vehicle/backend/app/analytics/routes.py)
- **Diagnoses & Chief Complaints:** Updated `get_patient_diagnoses` and `get_patient_complaints` to retrieve `start_date` and `end_date` from request query params and filter the SQL results.
- Passed down date ranges from the `/geo/patient-complexity` and `/geo/patient-bsc` endpoints.

---

### 2. Frontend Layout & Timeline Selector Integration

#### [analytics.js](file:///c:/Users/Omen/Downloads/saranam_vehicle/frontend/src/api/analytics.js)
- Updated `getPatientDiagnoses`, `getPatientComplexity`, `getPatientBSC`, and `getPatientComplaints` to accept and forward query parameters.

#### [DiseaseAnalysisView.jsx](file:///c:/Users/Omen/Downloads/saranam_vehicle/frontend/src/components/analytics/DiseaseAnalysisView.jsx)
- **Timeline Selectors:** Added independent `TimelineSwitch` selectors to all 4 cards (Types of Cancers, Clinical Complexity, BSC, and Chief Complaints).
- **Asynchronous Loaders:** Replaced the global loader with independent React `useEffect` hooks and skeleton loading animations per chart card.

---

## Verification
- Selecting different timeline dropdown values (e.g. `5D`, `1M`, `5Y`) updates individual disease widgets dynamically.
