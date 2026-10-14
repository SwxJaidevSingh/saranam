# Analytics — Theory of Change-Aligned Rebuild

**Status:** Plan, awaiting client sign-off (Anish / Anvita / Ashwini / Ramesh)
**Source:** 2026-04-28 meeting transcript · Theory of Change PDF · Arnav (M16) WhatsApp note 23/04/26
**Today:** 2026-05-01 · Demo window: Thu/Fri week of 2026-05-04

---

## 1 · Context — what this is for

Saranam Palliative Care needs analytics that serve **two very different audiences**:

| Audience | What they need | What they don't care about |
|---|---|---|
| **Donors / external stakeholders** | "You funded X — here's the volume of care delivered, geographic reach, deaths supported." Stewardship reporting in 30-second scans. | Clinical scores, BSC vs non-BSC nuance, opioid mg/day. |
| **Program team / clinical leadership** | "Is the care actually working? Are patients suffering less? Are they dying at home? Do we have access to opioids?" Drives weekly clinical decisions and program improvement. | Big counts, fundraiser-friendly headlines. |

The meeting decision: **two separate dashboards**, sharing the same underlying data layer but with completely different default views, depth, and access.

This is **not a greenfield build**. The repo already has `backend/app/analytics/` (14 modules, ~2.5k LOC) and `frontend/src/components/analytics/` with multiple existing views. This plan is a **refactor + extension** that wraps the existing work into the ToC framework and fills the gaps the meeting called out.

---

## 2 · What already exists (working code we keep / reuse)

### Backend modules (`backend/app/analytics/`)
- `clinical_analytics.py` — patient-level clinical aggregations
- `deaths_analytics.py` — mortality queries (✅ has the framework; needs the spike fix)
- `geo_analytics.py` — geographic distribution (✅ basis for Kidwai 25km radius)
- `operational_analytics.py` — visit / consultation counts
- `provider_analytics.py` — workload per provider
- `risk_analytics.py` — risk-stratification
- `symptom_analytics.py` — symptom-level summaries (✅ basis for ESAS trajectory)
- `vitals_analytics.py` — vitals trends (✅ basis for PPS trajectory)
- `advanced_form_service.py` — form-based aggregations
- `age_bands.py` — age-distribution helper
- `models.py`, `services.py`, `routes.py` — wiring

### Frontend (`frontend/src/components/analytics/`, `frontend/src/pages/analytics/`)
- `AnalyticsDashboard.jsx` (page)
- `ChartCard`, `StatCard`, `DateRangePicker`, `ExportButton` — reusable primitives
- 8 view modules: ClinicalOutcomes, FormAnalysis, GeospatialAnalysis, OperationalFinancial, PatientAnalysis, ProviderOptimization, RiskAnalysis, SymptomAnalysis, VitalsAnalysis

### Models (`backend/app/saranam/models/`)
- `pps_score.py` — time-stamped PPS records (✅ trajectory-ready)
- `esas_score.py` — time-stamped ESAS records (✅ trajectory-ready)
- `patient_visit.py` — visit log (✅ basis for visit volume + KMs)
- `geographic_cluster.py` — zone definitions (✅ basis for zone breakdowns)
- `patient_ai_summary.py` — AI-generated narratives

**Verdict:** the foundation is ~70% built. Most of the work is regrouping the existing endpoints into the two ToC tiers and filling 6–8 specific gaps.

---

## 3 · Cross-cutting design decisions

### 3.1 Two routes, one data layer
- `/analytics/donor` — Donor / Stakeholder dashboard (public-clinic-facing)
- `/analytics/program` — Program / Clinical dashboard (RBAC: clinical roles only, may include patient drill-downs)

Both share the same backend metric functions; the dashboards differ in **which** metrics they display, the default time grain, and whether they expose patient-level drill-downs.

### 3.2 Shared filter state
Every metric endpoint accepts:
```
period:    daily | monthly | quarterly | yearly       (default: monthly)
start_date, end_date                                  (default: last 12 months)
zone:      <bbmp_zone_id> | "all"                     (default: all)
patient_filter: bsc | non_bsc | all                   (default: all; non_bsc for trajectory metrics)
```

A single `<DateRangeAndFilterBar />` component lifts state to the dashboard root and fans out to all charts via context.

### 3.3 Comparison mode
Donor dashboard supports "vs previous period" delta on every StatCard ("+12% vs last quarter"). Program dashboard does not — clinicians find period-over-period comparisons noisy at small N.

### 3.4 Caching strategy
- All metric endpoints memoized for 5 min (Flask-Caching with simple in-memory backend; upgrade to Redis if data scale demands)
- Cache key includes all filter args so every distinct dashboard view caches independently
- Manual "Refresh" button on the dashboard root busts the cache

### 3.5 Export
- Every chart card has Export → CSV / PNG
- "Save as Report" button on the dashboard root produces a single-page PDF snapshot of the current view (donor stewardship reports + Kidwai monthly report ride on this same primitive)

### 3.6 Empty / loading / error states
- Empty: "No deaths recorded this period" — not a blank chart
- Loading: skeleton cards, not spinners
- Error: inline error with a Retry button; failed metric doesn't break the whole dashboard

### 3.7 Performance & integrity
- Indexes verified on `visits.visit_date`, `patients.is_active`, `pps_scores.recorded_at`, `esas_scores.recorded_at`, `(patient_id, visit_date)`
- Materialized views for daily aggregates if/when data volume demands (not now)
- Every aggregation is **inclusive of deceased patients** (CRITICAL: deaths must count for mortality metrics — explicitly verify the existing `is_active` filter doesn't accidentally exclude them)

### 3.8 RBAC
- **Donor dashboard:** all authenticated users; no PII; no patient-level drill-down
- **Program dashboard:** roles in `{doctor, nurse, admin, program_manager}`; patient drill-down allowed (audit-logged)

---

## 4 · The metrics — full breakdown with deep notes

> Format: **Status** = ✅ ready / 🟡 needs backfill / 🆕 new field/form / 🚫 blocked on client. **Effort** = S (≤ ½ day) / M (½ to 1 day) / L (1+ days). Status reflects against existing repo as of today.

---

### A · Donor / Stakeholder Dashboard (DMQY-style)

| # | Metric | Chart | Source / Status | Effort | Notes |
|---|---|---|---|---|---|
| A1 | Total **home-care visits** per period | StatCard + line over time | `patient_visit.visit_type='home'` ✅ | S | Daily/Monthly/Quarterly/Yearly via `period` param. Reuses `operational_analytics.py`. |
| A2 | Total **consultations** by type | Stacked bar: physician / nurse / physio / psycho-social | `patient_visit.visit_type` ✅ for first three, 🆕 for psycho-social | S–M | If `psycho-social` isn't in the visit_type taxonomy, add it before building. Quick model migration + dropdown update. |
| A3 | Total **deaths** per period | Line chart | `patients.date_of_death` 🟡 | S | **The spike fix:** filter out deaths where `date_of_death = <import-date>` until backfilled. Long-term: import script must populate real DoD per source records. |
| A4 | **Kilometers covered** in home-care visits | Cumulative bar / total card | 🟡 — visit doesn't currently store distance | M | Two implementation paths: (a) add `home_visit.distance_km` field, populated by Google Maps Distance Matrix API at visit-creation time; (b) compute from clinic-centroid → patient-zone-centroid via Haversine — cheaper but less accurate. Recommend (a) for production; ship (b) as v1 for the demo. |
| A5 | **Total patients seen** per period | StatCard + sparkline | `COUNT(DISTINCT patient_id) JOIN visits` ✅ | S | Two variants worth showing side-by-side: *(a)* Patients with ≥1 visit in period, *(b)* New enrollments in period. Different stories. |

**Donor dashboard layout:** 5 big StatCards in a row across the top + 4 charts below (volume over time, consultation mix, deaths over time, KMs cumulative). Comparison badge on each StatCard ("+12% vs Q1"). One "Save Donor Report" button generates a single-page PDF.

---

### B · Program-Effectiveness Metrics (clinical depth)

| # | Metric | Chart | Source / Status | Effort | Why it matters clinically |
|---|---|---|---|---|---|
| B1 | **Death chart** over time | Line, with annotation for high-mortality clusters | `patients.date_of_death` 🟡 | S | Fix the import-spike. Add a "raw vs cleaned" toggle so users can audit. |
| B2 | **Place-of-death** distribution (pareto) | Pareto chart: home / hospital / in-transit / unknown, varying over time | `deceased_patient.place_of_death` 🆕 — needs ingestion of Satish's zone-wise line-list | M | Core palliative outcome. Home-death rate is the single most-cited quality indicator. Need an ingestion endpoint or CSV import for Satish's spreadsheet. |
| B3 | **PPS score trajectory** (non-BSC) | Median PPS at week-from-enrollment with IQR shading | `pps_score` table ✅ + 🆕 BSC flag on patient | M | PPS measures functional decline. Non-BSC patients should ideally show *slower* decline if our interventions work. **Filter: exclude BSC patients.** |
| B4 | **ESAS score trajectory** (non-BSC) | Multi-line: total ESAS + sub-symptoms (pain, fatigue, dyspnea, etc.) over weeks-from-enrollment | `esas_score` table ✅ + BSC flag | M | ESAS measures suffering directly. Falling ESAS = our care is working. **9 sub-scores** so the chart needs a sub-symptom selector. |
| B5 | **Morphine / opioid usage** | (i) StatCard: # patients ever dispensed an opioid in period · (ii) Line: total mg-morphine-equivalent dispensed over time | `prescriptions` + `inventory.dispensations` 🟡 — needs curated opioid list with mg-equivalence factors | M | WHO's primary indicator for palliative care quality. Need to define which inventory items are "opioid" (probably an `is_opioid` boolean on the Medicine catalog + an `mme_factor` for morphine-milligram-equivalent conversion). |
| B6 | **BSC vs non-BSC** patient counts | Pie + line over time | 🆕 — `patient.is_best_supportive_care` boolean field | S | Add a one-click toggle on the patient header (with date set + reason note for audit). Drives the filter on B3 / B4. |
| B7 | **FAITH spiritual-distress** distribution | Histogram of distress scores | 🚫 — form not built yet | L | **Future work.** Need new spiritual-assessment form capturing the 5-dimension FAITH questionnaire score. Confirmed by Dr. Ashwini as the standardized tool. **Phase 3.** |
| B8 | **Total visits** across all patients | Stacked bar by visit_type per period | `patient_visit` ✅ | S | **Replaces** the misleading "average visits before death" metric. The mean is meaningless when one patient has 4 visits and another has 1; total + median + a histogram tell the real story. Show median + IQR alongside the total. |
| B9 | **Follow-up activity** graph | Heatmap by day-of-week × ISO-week, OR line per ISO-week | `phone_followup` events ✅ (once Phone Follow-up widget ships) | S–M | Helps the team see "Mondays are crazy, Fridays are dead" so they can rebalance outreach. Depends on §6 / Phone Follow-up widget being live first. |

**Program dashboard layout:** 5 tabs — *Overview · Mortality · Symptom Trajectories · Volume & Visits · Quality (opioids/BSC)*. Each tab has 2–4 charts. Patient-level drill-down on every chart (click a data point → see contributing patients).

---

### C · Connection-to-Other-Organizations Module (ToC Outcome 3)

This is **a CRUD module, not a dashboard**. Different workstream, but stays in scope because the meeting put it under "analytics."

#### Schema (proposed — confirm with Anvita / Ashwini / Ramesh)

```
saranam_org_directory
├── id, created_at, updated_at, created_by
├── category          enum  -- govt_scheme / ngo / survivor_specialist /
│                          -- scholarship / vocational / ambulance / crematorium /
│                          -- religious_org
├── subcategory       string  -- e.g. "national" vs "state" for govt_scheme;
│                              -- "Hindu" / "Muslim" / "Christian" / "Jain" for religious_org
├── name              string
├── description       text
├── services_offered  text[]
├── address           string
├── zone              fk → geographic_clusters (optional)
├── distance_km       decimal (from clinic centroid)
├── lat, lng          decimal (for map plotting)
├── contacts          jsonb  -- [{type:'phone', value, name, role}, ...]
├── docs_required     text   -- for crematoria/ambulance: "death certificate, ID proof, ..."
├── verified_at       timestamp
├── notes             text
└── source            enum  -- manual / web_scraped / partner_data
```

#### Phasing

- **Phase 3a (after schema sign-off):** CRUD UI + DB table + API. Filter/search by category, zone, distance.
- **Phase 3b (web-scrape):** browser-automation utility (Google Maps Places API) to seed entries by category + zone. Crematoria within 25km of a patient zone, ambulance services, NGO offices. Operator reviews before activation.
- **Phase 3c (patient-facing):** on the patient page, a "Connect to Resources" button that lists relevant orgs filtered by patient zone + needs (e.g. "scholarship orgs" if the patient has school-aged children flagged in the social assessment).

**Status:** 🚫 blocked on client schema confirmation. Plan above is our proposal; expect iteration.

---

### D · Activity-Based Metrics (ToC PDF alignment)

| # | Metric | Chart | Source / Status | Effort | Notes |
|---|---|---|---|---|---|
| D1 | Home-visit count vs **25 km radius from Kidwai Hospital** | Geographic histogram + map (concentric rings around Kidwai centroid) | `geo_analytics.py` ✅ + Kidwai coords (single config) | M | Already have geo distribution; need the Kidwai-centric ring overlay. |
| D2 | **Multi-disciplinary team participation** per visit | Avg distinct provider roles per home visit | `patient_visit.providers` (M2M) ✅ if relationship exists, 🟡 else | M | Verify visits store ≥1 provider link with role. May need a `visit_providers` join table if visits currently have a single provider only. |
| D3 | **Telemedicine consultation count** | Line chart by month | `tele_sessions` ✅ | S | Trivial — already shipped infrastructure. |
| D4 | **Capacity-building sessions** conducted | Bar chart by session type | 🆕 — needs new model | M | Confirm with client whether internal training, community awareness, or both. New model: `capacity_building_session` (date, type, audience, attendees_count, location, lead_facilitator). |
| D5 | **Monthly death-record reporting to Kidwai** | Auto-generated PDF report | 🆕 — recurring job | M | Recurring APScheduler job (1st of month) → generates PDF using the existing PDF primitive → emails Kidwai contact. Needs Kidwai email config + sign-off on report format. |

---

## 5 · Phased delivery roadmap

### Phase 1 — Demo-ready (this week, 2026-05-04 to 2026-05-08)

**Goal: walk the client through working donor dashboard + 3 program-tab charts at the demo.**

1. Refactor existing `/analytics` dashboard into two routes (`/donor`, `/program`) with shared filter state. Move existing views into appropriate tabs.
2. **Donor dashboard A1–A5** with comparison mode and Save-Report PDF.
3. **B1 death-chart spike fix** (filter import-date deaths).
4. **B8 total-visits replacement** (kill the "average before death" metric, ship totals + median + histogram).
5. **B6 BSC flag** UI on patient header.
6. **A2 psycho-social visit type** added to the taxonomy if confirmed needed.
7. **Analytics Suggestions Document** (this file, polished) shared with Anish for sign-off before any post-demo build.

### Phase 2 — Clinical depth (week of 2026-05-11)

8. **B3 PPS trajectory** + **B4 ESAS trajectory** charts (non-BSC filter).
9. **B5 opioid usage** — define `is_opioid` + `mme_factor` on Medicine catalog; build the two views.
10. **A4 KMs** — Haversine v1 (patient zone centroid → clinic).
11. **D3 telemedicine count** chart.
12. **D2 multi-disciplinary participation** if visit→provider relation exists.

### Phase 3 — ToC + Outcome 3 module (after client schema sign-off)

13. **B2 place-of-death** ingestion of Satish's line-list.
14. **C** Connection-to-Orgs module (schema → CRUD → search/filter UI).
15. **D1 Kidwai 25km radius** map overlay.
16. **D4 capacity-building sessions** model + chart.

### Phase 4 — Automation + future forms

17. **A4 KMs v2** — Distance Matrix API for accurate per-visit distances.
18. **D5 monthly Kidwai auto-report** — recurring PDF email.
19. **C web-scrape seeding** — Google Maps Places API utility.
20. **B7 FAITH** spiritual-distress form + analytics.

---

## 6 · Key decisions / clarifications needed from client (Anish + team) before Phase 2

1. **Psycho-social visit type** — does this exist as a distinct visit type, or is it logged under nurse / physician with a sub-flag? Affects A2.
2. **Death-import backfill** — can the data team correct the historic `date_of_death` values from source records, or do we permanently filter out the import-date spike? Affects B1.
3. **Opioid catalog** — confirm the list of opioid medications in your formulary so we can flag them with `is_opioid=true` and assign MME factors. Affects B5.
4. **BSC criteria** — what triggers marking a patient as Best Supportive Care? Doctor's clinical judgment only, or guided by PPS / ESAS thresholds? Affects B6 UI design.
5. **Kidwai contact + report format** — for D5 monthly auto-report: who at Kidwai receives it, and what columns/sections are mandatory?
6. **Org directory schema** — confirm or adjust the schema in §C above. Specifically: are docs_required and distance_km useful or out-of-scope for v1?
7. **FAITH form rollout window** — Phase 4 work, but if it's a near-term priority we should pull it forward.

---

## 7 · Out-of-scope (explicit non-goals)

- **Real-time analytics / streaming** — all metrics are batch with 5-min cache.
- **Predictive models / risk scoring** — `risk_analytics.py` exists but ToC framework doesn't ask for predictions; we don't extend it here.
- **Donor-facing public link** — donor dashboard is internal-only behind login. A "share read-only link" feature can come later if Anish needs it for a board meeting.
- **Multi-tenancy** — single-tenant for now; design leaves room but doesn't implement.
- **Cohort comparisons across organizations** — only Saranam's own data.

---

## 8 · Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Death-spike isn't fixable at source (historic records lack DoD) | B1, B2 charts misleading | Add explicit "imported records" annotation band on charts; ship a one-time data-cleanup script that takes a CSV from the data team and updates DoD per UHID. |
| Visit-distance computation overestimates (zone centroid ≠ actual home) | A4 KM totals inflated | Ship Haversine v1 with a footnote "approximation by zone centroid"; v2 with per-visit Distance Matrix API removes the caveat. |
| BSC flag has no clinical adoption | B3/B4 trajectory charts always include all patients (signal washed out) | UI nudge: when a doctor enters PPS < 30 or ESAS-pain ≥ 7 sustained, prompt "Consider marking BSC?" Don't auto-flip; clinical decision stays with provider. |
| Opioid catalog is incomplete | B5 undercounts | Show count + list of dispensed-but-unflagged medicines for the operator to triage; iterative catalog expansion. |
| Phase 3 schema for Org Directory takes longer than expected | C blocked | Ship a minimum viable schema (category / name / phone / address) on our side and let client refine in production. |

---

## 9 · Engineering notes — implementation skeleton

### Backend file additions / refactors

```
backend/app/analytics/
├── donor_metrics.py          NEW — A1-A5 wrapped for donor view
├── program_metrics.py        NEW — orchestrates B/D for program view
├── opioid_analytics.py       NEW — B5
├── kidwai_radius.py          NEW — D1 specifically
├── kidwai_report.py          NEW — D5 monthly PDF generator
├── trajectory_analytics.py   NEW — B3/B4 PPS+ESAS over weeks-from-enrollment
├── deaths_analytics.py       MODIFY — B1 spike fix + B2 place-of-death
├── operational_analytics.py  MODIFY — A1/A2/A8 add BSC filter param
├── routes.py                 MODIFY — split /donor and /program endpoints
└── shared.py                 NEW — shared filter parsing, period bucketing helpers
```

### Backend model changes

```
patients.is_best_supportive_care   boolean default false   (B6)
patients.bsc_flagged_at            timestamp                (audit)
patients.bsc_flagged_by            uuid → users
medicines.is_opioid                boolean default false   (B5)
medicines.mme_factor               decimal nullable        (B5)
deceased_patients.place_of_death   string                  (B2 — if not present)

NEW tables:
- saranam_org_directory          (C)
- capacity_building_session      (D4)
```

### Frontend file additions / refactors

```
frontend/src/pages/analytics/
├── AnalyticsDashboard.jsx        REFACTOR — becomes a router shell
├── DonorDashboard.jsx            NEW — A1-A5 layout
└── ProgramDashboard.jsx          NEW — tabbed B + D layout

frontend/src/components/analytics/
├── DateRangeAndFilterBar.jsx     NEW — shared filter bar w/ period + zone + BSC
├── ComparisonBadge.jsx           NEW — "+12% vs prev period" pill
├── PdfReportButton.jsx           NEW — current-view → PDF
├── DonorReportTemplate.jsx       NEW — PDF layout for stewardship report
├── KidwaiReportTemplate.jsx      NEW — PDF layout for monthly Kidwai report
├── PPSTrajectoryChart.jsx        NEW — B3
├── ESASTrajectoryChart.jsx       NEW — B4
├── OpioidUsageChart.jsx          NEW — B5
├── PlaceOfDeathPareto.jsx        NEW — B2
└── (existing views moved into program-dashboard tabs)
```

### Tests
- Unit tests for each metric function with seeded data covering: empty period, single-data period, period-spanning year boundary, BSC-filter behavior.
- Snapshot tests for PDF reports.
- Integration test: schedule a death + a visit → metrics update correctly post-cache-bust.

---

## 10 · Sign-off checklist (share with client)

- [ ] Confirm two-tier dashboard split (donor + program) is the right framing
- [ ] Confirm metric list in §4 — flag any missing or unwanted
- [ ] Confirm phasing in §5 — anything urgent that should jump to Phase 1?
- [ ] Answer §6 clarifications (psycho-social, death backfill, opioid list, BSC criteria, Kidwai contact, org-directory schema, FAITH timing)
- [ ] Confirm out-of-scope items in §7

Once the above is signed, Phase 1 ships within the demo window. Phases 2–4 become the post-demo roadmap.
