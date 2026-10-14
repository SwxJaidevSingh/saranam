# Custom Data Report & Visualization Tab — Implementation Plan

## 1. Executive Summary & Objective

This document outlines the end-to-end plan to introduce a new **Custom Report** tab in the Analytics Dashboard. 

### Key User Requirements:
1. **Tab Placement**: Positioned directly **after "PPT Charts"** (before or alongside "Patient") in the Analytics tab bar.
2. **Column Selection**: Interactive picker allowing users to choose any single column or combination of columns across core health datasets.
3. **Hospital Distance Calculations**: Specialized geospatial columns enabling users to include calculated distance (in km) from:
   - **Kidwai Memorial Institute of Oncology (KMIO)**
   - **KC General Hospital (KCGH)**
   - **Linked Hospital** (distance to the specific hospital linked to each patient)
   - **Nearest Referral Hospital** (auto-calculates closest facility)
   - **User-Selected Custom Hospital(s)** (choose any hospital from the catalog/database, e.g. KIMS, St. John's, Baptist)
4. **Time Range & Filters**: Flexible date range selection (presets + custom start/end dates, default set to last 30 days / 1 month with 30D button active).
5. **Brief UI Visualization**: Dynamic, immediate visual preview on the screen (interactive chart summary + live data table showing the exact columns selected).
6. **Direct Download Buttons**: Two dedicated, one-click export buttons:
   - 📥 **Download as CSV**
   - 📥 **Download as XLSX**

---

## 2. Tab Placement in Analytics Dashboard

In [AnalyticsDashboard.jsx](file:///c:/Users/Omen/Downloads/saranam_vehicle/frontend/src/pages/analytics/AnalyticsDashboard.jsx), the view toggle bar will be updated so that the **"Custom Report"** tab appears immediately following **"PPT Charts"**:

```jsx
// frontend/src/pages/analytics/AnalyticsDashboard.jsx
<div className="inline-flex rounded-lg border border-border bg-card p-1 overflow-x-auto max-w-full">
  {/* 1. PPT Charts */}
  <Button variant={activeView === 'ppt' ? 'default' : 'ghost'} onClick={() => handleViewChange('ppt')}>
    <Presentation className="h-4 w-4" /> PPT Charts
  </Button>

  {/* 2. Custom Report Tab (NEW - Placed right after PPT Charts) */}
  <Button variant={activeView === 'report' ? 'default' : 'ghost'} onClick={() => handleViewChange('report')}>
    <FileSpreadsheet className="h-4 w-4" /> Custom Report
  </Button>

  {/* 3. Patient Tab */}
  <Button variant={activeView === 'patient' ? 'default' : 'ghost'} onClick={() => handleViewChange('patient')}>
    <Users className="h-4 w-4" /> Patient
  </Button>
  
  {/* Other existing tabs: Telemedicine, Vitals, Donor / ToC, Prescriptions, Diseases, Geospatial */}
</div>
```

---

## 3. Hospital Distance Calculation System

The system integrates geospatial coordinate tracking from `PatientLocation` and `external_metadata` with registered hospital coordinates.

### 3.1 Existing Geospatial Data in DB & How it Works

Yes! The system **already has geospatial tracking and distance calculations** built into the database and the Geospatial tab:

1. **Stored in Database**:
   - `patient.external_metadata['drive_distance_km']`: When patients are added/edited in the patient portal or when vehicle dispatch schedules are calculated, the Google Directions driving distance from the base hospital (Kidwai/KCGH) is pre-computed and saved directly in the patient's record.
   - `patient_locations` table ([PatientLocation](file:///c:/Users/Omen/Downloads/saranam_vehicle/backend/app/analytics/models.py#L62)): Stores individual patient GPS coordinates (`latitude`, `longitude`), `district`, and `address_full`.
   - `nearby_hospitals` table ([NearbyHospital](file:///c:/Users/Omen/Downloads/saranam_vehicle/backend/app/analytics/models.py#L94)): Stores registered hospitals with GPS coordinates.
   - `SystemSetting` & [HOSPITAL_CATALOG](file:///c:/Users/Omen/Downloads/saranam_vehicle/backend/app/patients/uhid_service.py#L73): Stores the official hospital catalog (`KMIO` - Kidwai, `KCGH` - KC General, `KIMS` - Kempegowda).

2. **Calculation Hierarchy in the Geospatial Tab ([GeospatialAnalysisView.jsx](file:///c:/Users/Omen/Downloads/saranam_vehicle/frontend/src/components/analytics/GeospatialAnalysisView.jsx#L258-L279))**:
   - **Step 1 (DB Pre-calculated Driving Distance)**: Checks `patient.drive_distance_km` or `patient.external_metadata.drive_distance_km`. If already stored in the DB, it uses that exact driving distance.
   - **Step 2 (On-the-fly Haversine Fallback)**: If driving distance is not saved, it takes the patient's `(latitude, longitude)` from `patient_locations` and computes straight-line distance to the target hospital using the Haversine formula from [geo.js](file:///c:/Users/Omen/Downloads/saranam_vehicle/frontend/src/constants/geo.js#L82) / [geo_analytics.py](file:///c:/Users/Omen/Downloads/saranam_vehicle/backend/app/analytics/geo_analytics.py#L12).

### 3.2 Available Hospital Distance Columns for Reports
The Custom Report tab will reuse this exact calculation hierarchy to ensure **100% consistency with the Geospatial tab**:
1. 📍 **Distance from Kidwai (KMIO) (km)**: Uses stored `drive_distance_km` or computes Haversine distance to Kidwai coordinates `(12.9337, 77.5713)`.
2. 📍 **Distance from KC General Hospital (KCGH) (km)**: Computes distance from patient location to KCGH Malleswaram `(13.0067, 77.5747)`.
3. 📍 **Distance from Linked Hospital (km)**: Dynamically checks the patient's `linked_hospital` (e.g. Kidwai vs KCGH) and reports distance to their assigned primary center.
4. 📍 **Nearest Hospital Name & Distance (km)**: Evaluates all registered hospitals and returns the name and distance of the closest facility.
5. 📍 **Custom Hospital Selector**: A selector allowing the user to pick any hospital (e.g. KIMS, St. John's, Bangalore Baptist) to generate a dedicated distance column.

---

## 4. User Experience & Interactive Workflow

```mermaid
flowchart TD
    A[Open Analytics → Click 'Custom Report' Tab] --> B[1. Choose Dataset & Time Range]
    B --> C[2. Select Columns: Demographics, Clinical, Hospital Distances]
    C --> D[3. Instant UI Visualization & Preview\n(Distance Distribution, Cluster breakdown, Sample Table)]
    D --> E1[Click: Download as CSV]
    D --> E2[Click: Download as XLSX]
```

### Section A: Dataset & Time Range Header
- **Dataset Dropdown / Selector**:
  - `Patients` (Demographics, status, complexity, hospital distances, diagnoses)
  - `Visits & Encounters` (Homecare visits, clinical team, visit types, distance covered)
  - `Clinical Vitals & ESAS` (Pain scores, symptom burdens, PPS scores, vitals)
  - `Prescriptions & Pain Ladder` (WHO pain step, dosages, opioid medications)
  - `Deceased & Bereavement` (Dates of death, place of death, care days)
- **Time Range Controls**:
  - Preset filters: *Last 7 Days*, *Last 30 Days*, *Last 90 Days*, *This Year (YTD)*, *All Time*.
  - Custom Date Range Picker (Start Date to End Date).
  - Date Field selector (e.g. *Registration Date*, *Visit Date*, or *Record Creation Date*).
- **Secondary Filters**:
  - Patient Care Status (*All*, *Active*, *Inactive*, *Deceased*).
  - Zone / Cluster (*North*, *South*, *East*, *West*, *Central*).
  - Linked Hospital (*All*, *Kidwai*, *KCGH*, *KIMS*, etc.).

---

### Section B: Interactive Column Selection
### Section B: Clean Column Selection Bar & Modal Dialog

To keep the page clean and distraction-free, the column selector is packaged into a **compact page bar with a modal dialog**:

1. **Page Bar**:
   - Shows total selected columns badge (e.g. `12 of 30 selected`) and a comma-separated preview of active columns.
   - Quick preset buttons right on the bar (*Demographics & Distances*, *Clinical*, *Hospital Proximity*).
   - A prominent **"Customize Columns"** button that opens the dialog.

2. **Modal Dialog (Popup)**:
   - **Search Filter**: Instant keyword search for columns.
   - **Quick Actions**: *Select All*, *Clear*, *Reset to Default*.
   - **Custom Hospital Distance**: Dropdown to add distance to any additional hospital (e.g. KIMS, St. John's, Baptist).
   - **Categorized Checkbox Grid**: Responsive 3-column category cards:
     - **Identifiers**: UHID, Hospital UHID, Full Name, ABHA ID
     - **Demographics**: Age, Gender, Date of Birth, Bangalore Resident
     - **Geographic & Hospital Distance**: Distance to Kidwai (KMIO), Distance to KC General (KCGH), Distance to Linked Hospital, Nearest Hospital Name & Distance, Cluster, District
     - **Clinical Status**: Care Status (Active/Inactive), BSC Status, Oncology/Non-Onco, Clinical Complexity, Latest PPS Score
     - **Assessments & Vitals**: Pain Score (0-10), ESAS Total Score, Blood Pressure, Pulse, SpO2, Temperature
     - **Care Team & Referral**: Origin Type, Referring Hospital, Primary Caregiver Name, Primary Caregiver Contact
     - **Outcomes**: Deceased Status, Date of Death, Place of Death, Registration Date
   - **Done Button**: Closes the modal and immediately refreshes the preview.

---

### Section C: Brief Data Visualization on the UI
Before downloading, the user gets immediate visual insight on screen:

1. **Metric Overview Cards**:
   - Total Matching Records count (e.g., `482 records matching filters`).
   - Active Column count.
   - Average Distance to Kidwai / KCGH (if distance columns selected, e.g. `Avg 14.2 km to Kidwai`).
   - Key clinical metric (e.g. `High Complexity: 34%`).

2. **Dynamic UI Visualization Chart**:
   - Depending on what column(s) the user picks:
     - **Distance Columns Selected**: Renders a **Distance Proximity Distribution** chart (`< 5 km`, `5-10 km`, `10-20 km`, `20+ km`).
     - **Categorical Columns** (e.g., *Gender*, *Cluster*, *Care Status*, *Clinical Complexity*, *Place of Death*): Generates a sleek bar chart or distribution donut showing breakdown percentages.
     - **Numeric / Score Columns** (e.g., *Age*, *PPS Score*, *Pain Score*): Generates an average distribution histogram.
     - **Date Columns** (e.g., *Registration Date*, *Visit Date*): Generates a timeline trendline chart of records over time.

3. **Live Table Preview**:
   - An interactive table displaying the first 10 matching records.
   - Shows **only the columns the user selected** (including calculated distance numbers).
   - Dynamically re-renders whenever columns are toggled.

---

### Section D: Dedicated Download Buttons
Placed prominently above the preview table and in a sticky bottom summary bar:

```
[  📥 Download as CSV  ]        [  📥 Download as XLSX  ]
```
- **Download as CSV**: Instantly triggers formatted CSV generation.
- **Download as XLSX**: Generates a professionally styled Excel file with header styles, gridlines, auto-fitted column widths, and proper cell types (distance formatted as numeric with 1 decimal).
- Both buttons display real-time loading spinners during file preparation.

---

## 5. Technical Architecture & Strict Folder Isolation

To ensure maximum modularity, **100% of the report code will reside strictly inside two dedicated folders** (one in frontend, one in backend). No other files or folders will be modified except for a single wiring line to display the tab and mount the API. This makes it trivial to change or remove in the future without any side-effects.

```
📁 frontend/src/components/analytics/report/   <-- ALL FRONTEND REPORT CODE HERE
📁 backend/app/analytics/report/              <-- ALL BACKEND REPORT CODE HERE
```

---

### 5.1 Frontend Structure (`components/analytics/report/`)

All UI components, subcomponents, and API callers are self-contained in this single directory:

```
frontend/src/components/analytics/report/
├── index.js                      # Barrel export for <ReportGeneratorView />
├── ReportGeneratorView.jsx       # Main container view for the report tab
├── DatasetAndFilterBar.jsx       # Dataset selector + DateRangePicker + filters
├── ColumnSelector.jsx            # Categorized column chip selector & hospital picker
├── ReportDataVisualizer.jsx      # Dynamic chart (including distance bands) & stat cards
├── ReportTablePreview.jsx        # Live 10-row preview grid matching selected columns
├── ExportActionButtons.jsx       # "Download as CSV" & "Download as XLSX" buttons
└── reportApi.js                  # Dedicated API client for report preview & file streaming
```

#### Only Wiring Touchpoint in Frontend:
In [AnalyticsDashboard.jsx](file:///c:/Users/Omen/Downloads/saranam_vehicle/frontend/src/pages/analytics/AnalyticsDashboard.jsx):
1. **Import** (1 line):
   ```jsx
   import { ReportGeneratorView } from '@/components/analytics/report';
   ```
2. **Tab Toggle Button** (4 lines right after PPT Charts):
   ```jsx
   <Button variant={activeView === 'report' ? 'default' : 'ghost'} size="sm" onClick={() => handleViewChange('report')} className="gap-2 shrink-0">
     <FileSpreadsheet className="h-4 w-4" />
     Custom Report
   </Button>
   ```
3. **View Render** (1 line):
   ```jsx
   {activeView === 'report' && <ReportGeneratorView />}
   ```

---

### 5.2 Backend Structure (`app/analytics/report/`)

All report generation, column definitions, geospatial distance calculations, and CSV/XLSX formatting are self-contained in this single package:

```
backend/app/analytics/report/
├── __init__.py                   # Package init & register_report_routes(bp) helper
├── report_service.py             # Dataset schemas, query builder, distance math, openpyxl/csv
└── report_routes.py              # Endpoints: /datasets, /preview, /export
```

#### Only Wiring Touchpoint in Backend:
In [backend/app/analytics/routes.py](file:///c:/Users/Omen/Downloads/saranam_vehicle/backend/app/analytics/routes.py):
1. **Mount Hook** (2 lines at the bottom of the file):
   ```python
   from app.analytics.report import register_report_routes
   register_report_routes(analytics_bp)
   ```

#### Zero Footprint Guarantee:
- **No database migrations needed**: Uses existing tables (`patients`, `patient_locations`, `patient_visits`, `nearby_hospitals`).
- **No changes to existing services**: Does not alter `services.py`, `geo_analytics.py`, or `donor_metrics.py`.
- **Easy removal**: To delete or replace the feature in the future, simply delete the two `report/` folders and remove the wiring hooks from `AnalyticsDashboard.jsx` and `routes.py`.

---

### 5.3 API Specifications

All endpoints are mounted under `/api/analytics/reports/*`:

#### 1. `GET /api/analytics/reports/datasets`
Returns metadata of available datasets, date fields, categories, available hospital distance columns, and hospital catalog options:
```json
{
  "datasets": [ ... ],
  "hospitals": [
    { "code": "KMIO", "name": "Kidwai Memorial Institute of Oncology", "lat": 12.9337, "lon": 77.5713 },
    { "code": "KCGH", "name": "KC General Hospital", "lat": 13.0067, "lon": 77.5747 },
    { "code": "KIMS", "name": "Kempegowda Institute of Medical Sciences", "lat": 12.9565, "lon": 77.5743 }
  ]
}
```

#### `POST /api/analytics/reports/preview`
Returns record count, visual aggregation (such as distance bands), and first 10 sample rows with calculated distances:
- **Request**:
  ```json
  {
    "dataset": "patients",
    "date_field": "registration_date",
    "start_date": "2026-01-01",
    "end_date": "2026-09-28",
    "columns": ["uhid", "full_name", "geographic_cluster", "distance_kmio", "distance_kcgh", "care_status"]
  }
  ```
- **Response**:
  ```json
  {
    "total_count": 512,
    "columns": ["uhid", "full_name", "geographic_cluster", "distance_kmio", "distance_kcgh", "care_status"],
    "preview_rows": [
      {
        "uhid": "2026010001",
        "full_name": "R. Sharma",
        "geographic_cluster": "South",
        "distance_kmio": 8.4,
        "distance_kcgh": 14.1,
        "care_status": "active"
      }
    ],
    "visualization": {
      "distance_summary": {
        "avg_kmio_km": 11.2,
        "avg_kcgh_km": 15.6,
        "distribution": [
          { "range": "< 5 km", "count": 82 },
          { "range": "5 - 15 km", "count": 240 },
          { "range": "15 - 30 km", "count": 145 },
          { "range": "> 30 km", "count": 45 }
        ]
      }
    }
  }
  ```

#### `POST /api/analytics/reports/export`
Generates and downloads the full file in either `csv` or `xlsx` format with calculated distance columns.

---

## 6. Implementation Steps

| Step | Scope | Description |
|---|---|---|
| **Phase 1** | **Backend Service** | Create `app/analytics/report_service.py` with dynamic query builder, Haversine hospital distance calculators (Kidwai, KCGH, KIMS, custom), and CSV/Excel generators. |
| **Phase 2** | **Backend Routes** | Add `/datasets`, `/preview`, and `/export` routes in `app/analytics/routes.py` with authentication & error handling. |
| **Phase 3** | **Frontend API** | Add report fetching, hospital catalog retrieval, and blob-download helper functions in `frontend/src/api/analytics.js`. |
| **Phase 4** | **UI Components** | Build `ReportGeneratorView.jsx`, `ColumnSelector.jsx` (with hospital distance selector), `ReportDataVisualizer.jsx` (with proximity charts), and `ReportTablePreview.jsx`. |
| **Phase 5** | **Dashboard Integration** | Insert the "Custom Report" button right after "PPT Charts" in `AnalyticsDashboard.jsx`. |
| **Phase 6** | **Testing & Verification** | Test column combinations, hospital distance calculations, preview charts, and verify both `.csv` and `.xlsx` downloads open cleanly. |

---

## 7. Next Steps

The plan has been updated with the hospital distance options (Kidwai, KCGH, Linked Hospital, Nearest Hospital, and custom options). 

Whenever you are ready, confirm to proceed and I will start implementing Phase 1 (Backend Service & Routes) followed by the Frontend UI.
