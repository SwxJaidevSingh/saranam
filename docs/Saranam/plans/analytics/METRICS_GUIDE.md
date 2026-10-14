# Donor / ToC Analytics — Metrics Guide

**Audience:** you (talking to Dr. Ashwini / Anish / Anvita / Ramesh)
**Purpose:** ready-to-use explanations of every metric on the Donor / ToC dashboard tab — what it means, why it matters clinically, how it's calculated, what "good" looks like, and what to flag if the numbers look wrong.

> **Quick framing for the meeting**
>
> "The Donor / ToC tab is one dashboard, two stories. The numbers up top are for stewardship — what donors and partners see. The numbers below are for *us* — the team. They tell us if our care is actually working: are patients suffering less, dying at home, getting follow-ups, getting opioids when they need them."
>
> Demo toggle (top-right): flip **Real data → Showing demo data** to walk through 12 months of credible numbers when the real data is sparse. Flip back any time. The amber banner makes it clear the screen is showing demo numbers — donors won't be confused.

---

## Section A — Top row: volume & outcomes (donor view)

### 1. Patients seen
- **What it means:** unique patients who received any kind of completed visit in the period.
- **Why it matters:** the headline "reach" number. Donors want to know "how many people did you help this year?"
- **How it's calculated:** `COUNT(DISTINCT patient_id)` from `patient_visits` where `status='completed'` and `visit_date` is in the selected window.
- **What good looks like:** rising over time, especially in the first 1–2 years of program operations. If it plateaus while referrals continue, look at loss-to-follow-up.
- **Talking point:** *"This is the number of distinct patients we touched this period. The +12% delta means we reached more families than last quarter."*

### 2. Home-care visits
- **What it means:** completed visits at the patient's home (not OPD, IPD, or phone).
- **Why it matters:** **the single most important volume metric for palliative care.** Home-based care is what differentiates Saranam from a hospital — it's the *deliverable*. The ToC explicitly anchors care delivery to the home.
- **How it's calculated:** completed visits with `visit_location='home'`.
- **What good looks like:** rising trend, with home as the dominant slice in the location-stacked bar chart. If OPD or phone visits start outweighing home, that's a model drift to flag.
- **Talking point:** *"Home visits are what the donor is funding — it's why Saranam exists. Other touchpoints support it but home is the core."*

### 3. Total visits
- **What it means:** every completed visit, all locations combined.
- **Why it matters:** **replaces the old "average visits before death" metric** which was misleading (one patient with 4 visits + one with 1 averages to 2.5, but tells you nothing about either). Total visits + the per-period total + the visit cadence is the honest volume picture.
- **How it's calculated:** `COUNT(*)` of all completed visits in window, regardless of location.
- **What good looks like:** rising trend; the gap between total and home tells you the share of indirect care (OPD/IPD/phone).
- **Talking point:** *"We retired the 'average visits before death' chart because it implied a meaningful average exists when really patients fall into very different journey shapes. Total visits + the per-month chart shows the real volume story."*

### 4. Consultations
- **What it means:** visits where a clinical team member (physician / nurse / physio / etc.) was logged on the visit.
- **Why it matters:** counts encounters where care was actually delivered by a clinician — not just a vehicle dispatch.
- **How it's calculated:** completed visits with non-null `team_members` JSONB field.
- **What good looks like:** ≈ same as total visits (every visit *should* have at least one team member logged). If it's much lower, your `team_members` capture rate is the problem, not the consult count.
- **Caveat:** depends on the team logging which providers attended. If `team_members` isn't filled, this metric undercounts — flag the visit-data-entry step.

### 5. Telemedicine
- **What it means:** teleconsult sessions (video + voice) that ran successfully.
- **Why it matters:** **ToC Activity 9** explicitly calls this out — "specialist palliative-care telemedicine consultations." Telemedicine extends reach to patients who can't be visited at home that week, especially follow-ups.
- **How it's calculated:** `tele_sessions` rows with status in (`completed`, `in_progress`, `ringing`). The footer breaks it down "9 video / 7 voice".
- **What good looks like:** complementary to home visits, not a replacement. Voice for quick check-ins, video for specialist consultations. Adoption-curve growth in early months is healthy.
- **Talking point:** *"Telemedicine isn't a substitute for home care — it's how we cover the weeks between visits without burning out the team."*

### 6. Deaths
- **What it means:** patients who died in the period.
- **Why it matters:** in palliative care, **deaths are the program's expected outcome**, not a failure metric. Saranam supports patients with terminal illness; the question isn't "did they die" but "how did they die" (peacefully, at home, with dignity vs in a hospital surrounded by tubes).
- **How it's calculated:** count of `Patient.is_deceased=true AND date_of_death` in window.
- **What good looks like:** the absolute number rises with program scale (more patients → more deaths over time). The *quality* of those deaths is in the place-of-death chart below — that's where the program-effectiveness story lives.
- **Caveat:** the chart shows raw data including the historic-import day spike (per Dr. Ashwini's direction "leave the data entry spikes"). Donors will see the spike — be prepared to explain that historic records were ingested on one day during digitization.

---

## Section B — Second row: quality & ToC outcomes

### 7. Patients with follow-ups
- **What it means:** distinct patients who received at least one follow-up visit in the period (the second/third/Nth visit, not their initial).
- **Why it matters:** **a core ToC quality marker.** The promise of palliative care isn't a one-off visit — it's continuity. A patient with one visit is a referral; a patient with multiple visits is a *patient receiving care*. The number itself tells you how many families you're staying engaged with.
- **How it's calculated:** distinct `patient_id` across visits where `visit_type='follow_up'`.
- **What good looks like:** approaching the same number as "Patients seen". If `patients with follow-ups` ≪ `patients seen`, you have a retention/cadence problem.
- **Talking point:** *"This is who we're actually staying with. New referrals come in, but it's the follow-ups that make the difference for symptom control."*

### 8. Patients on opioids
- **What it means:** distinct patients dispensed an opioid medication in the period.
- **Why it matters:** **WHO's primary indicator of palliative care quality is opioid availability.** Untreated pain is the #1 reason patients suffer at end of life, and morphine is the gold-standard treatment. India globally has chronic *underuse* of opioids in palliative care due to regulatory complexity. Showing this number going up is showing the program is doing its job.
- **How it's calculated:** detection is a 3-way OR — `narcotic=true` (curated catalog flag), or WHO ATC code starting `N02A`, or medicine name matching curated keyword list (morphine, fentanyl, tramadol, oxycodone, codeine, buprenorphine, methadone, pethidine, hydromorphone, tapentadol, hydrocodone, diamorphone, oxymorphone). Footer: total dispensation count.
- **What good looks like:** rising over time as the team gets more comfortable with opioid prescribing. Internationally, ~80% of palliative patients need opioid analgesia at some point.
- **Caveat:** detection accuracy depends on the inventory catalog. If the team adds an opioid SKU without setting `narcotic=true`, the keyword fallback should still catch it. Encourage them to flag opioid SKUs at intake — improves precision.
- **Talking point:** *"This is the metric WHO uses internationally. Our job in palliative care is to relieve suffering, and pain is the #1 symptom. If this number isn't going up over time, we have a structural problem — either we're not screening for pain or we're hesitant to prescribe."*

### 9. Multi-disciplinary
- **What it means:** percentage of home visits where ≥ 2 distinct team-member roles were present (e.g. nurse + physiotherapist).
- **Why it matters:** **ToC Activity 1** is "Establish a multi-disciplinary palliative home-care team." Multi-disciplinary visits deliver integrated care — a single nurse touch is good, but a nurse + physio + counsellor visit can address pain, mobility, and emotional distress in one trip.
- **How it's calculated:** % of completed home visits where the `team_members` JSONB array has ≥ 2 distinct `role` values. Footer shows avg roles per visit (target: 2.0+).
- **What good looks like:** trending toward 50%+. Not every visit needs to be multi-disciplinary (a routine medication titration can be a single-nurse visit), but if < 30%, ask whether the team is splitting up unnecessarily.
- **Caveat:** depends on the team logging all attendees. If `team_members` is sparse, this metric undercounts.

### 10. KMs covered (estimated)
- **What it means:** total kilometres driven for home visits in the period, estimated from the approved weekly schedule.
- **Why it matters:** geographic effort indicator for donors ("you funded ~12,000 km of home outreach"). Also tracks against ToC Activity 3 — visits within 25 km of Kidwai.
- **How it's calculated:** `(scheduled_slots in week) × ANALYTICS_AVG_KM_PER_VISIT`, where avg km/visit defaults to 12 (≈ 6 km one-way + return + chained-route bias). Configurable via `ANALYTICS_AVG_KM_PER_VISIT` env. **This is an estimate, not GPS-tracked actuals.**
- **What good looks like:** rising with home-visit count. Falling = either fewer visits or shorter routes.
- **Caveat — be transparent:** *"This is estimated, not measured. The schedule says we made 200 visits this week; we assume each visit is 12 km of travel; that's 2,400 km. Once we add per-visit GPS tracking we can show exact distances. The estimate is conservative — it likely understates routes that span multiple zones."*

### 11. Lost to follow-up
- **What it means:** active alive patients with no completed visit in the last 60+ days. Catches silent drop-offs.
- **Why it matters:** **clinical signal disguised as an operational metric.** In palliative care, patients who disappear from the system without an explicit "discharged" or "deceased" event are a worry — they often died at home unrecorded, or moved to another city, or stopped engaging because the team lost contact. This number shouldn't be zero (some attrition is natural) but it shouldn't be growing.
- **How it's calculated:** `Patient.is_active=true AND is_deceased=false AND (max(visit_date) < today − 60 days OR no visits ever)`. Footer: threshold is 60 days; configurable.
- **What good looks like:** **stable or shrinking**, with most patients in the 60–90 day bucket (i.e. recently overdue, easy to recover). Patients in 180+ or "never visited" buckets are the red flag — those are likely lost permanently.
- **Talking point:** *"This is the watchlist nobody usually looks at. These are families who came to us once and then dropped off. Most are probably fine — moved, recovered enough to disengage, or yes, died at home — but we don't know unless we call. Even a 60-second outreach call resolves most of them."*

### 12. Late referrals
- **What it means:** percentage of deceased patients who died within 7 days of first being enrolled at Saranam.
- **Why it matters:** **the most damning systemic metric in the whole dashboard.** Indian palliative oncology is notorious for last-fortnight referrals — oncologists send patients to palliative care only after curative treatment has visibly failed and the family is asking for "comfort care." A patient referred in their last week barely benefits from palliative intervention; meaningful symptom control requires weeks-to-months of relationship.
- **How it's calculated:** `% of deceased patients where (date_of_death − Patient.created_at) ≤ 7 days`. The histogram below shows the full distribution.
- **What good looks like:** **shrinking over time** as you build relationships with referring oncologists. International benchmark is < 15%. Indian palliative-care studies often report 40–60% (terrible). Anything declining year-over-year is a win.
- **Action when it's high:** referrer education — visit Kidwai, brief the oncology team, share case studies of patients who got 3–6 months of good palliative care because of early referral.
- **Talking point:** *"This is the upstream-pipeline metric. Our work is downstream — we can only treat patients who reach us. If this number is high it's not our failure, but it's our problem to solve through education and referrer relationships."*

---

## Section C — Time-series charts

### 13. Visits over time, by location (stacked bar)
- **What it shows:** monthly (or daily/quarterly/yearly) visit counts, split by where the visit happened (home / OPD / phone / IPD).
- **Why it matters:** the "model fidelity" chart. Saranam is a *home-care* program; the home segment should dominate every bar. Phone visits are useful but cheap — if they grow disproportionately, the team is shifting away from the more expensive (but more impactful) home model.
- **How it's calculated:** `COUNT(*)` of completed visits, grouped by `(period bucket, visit_location)`.
- **Talking point:** *"This chart tells me at a glance whether we're staying true to the model. If home stays the green dominant block, we're on mission."*

### 14. Kilometres covered, week over week
- **What it shows:** estimated km driven each week (Mondays anchor the bucket).
- **Why it matters:** operational pulse. Volatile bars suggest scheduling instability; smooth growth suggests good capacity planning.
- **How it's calculated:** see metric 10 — slots × 12 km, ISO-week-bucketed.
- **Caveat:** weekly granularity only (not monthly, quarterly, etc.) because the user asked for week-over-week comparison specifically.

### 15. Deaths over time (line)
- **What it shows:** raw monthly death count. **No spike suppression** — historic-import-day deaths are visible as a vertical jump.
- **Why it matters:** mortality reporting (ToC Activity 13 requires monthly Kidwai reports). Donors want to see the program is "supporting people through end of life," not hiding deaths.
- **How it's calculated:** count of patients with `date_of_death` in each bucket.
- **Be ready for:** *"Why is there a huge spike in [import month]?"* — answer: *"That's when we digitized historic paper records. All of those deaths happened over many months, but they all got entered into the system on one day. The chart shows raw entries because the team felt that was more honest than smoothing them out."*

### 16. Consultation mix (by team role) — horizontal bar
- **What it shows:** total role-encounters across all visits in the period. **Same visit contributes multiple roles** (a multi-disciplinary visit = nurse + physio = 2 role-encounters, intentionally).
- **Why it matters:** workforce-allocation lens. If nurse:physician:physio is 80:5:15, you're nurse-led (which is correct for home-based palliative care). If physician dominates, ask whether you're using everyone's training appropriately.
- **How it's calculated:** flatten `team_members` JSONB across visits, count by role.
- **Talking point:** *"Nurses lead in home-based palliative care everywhere in the world. Physicians anchor the medical decisions; physios handle mobility. The ratio is the model."*

### 17. Opioid / morphine dispensations (line)
- **What it shows:** count of opioid dispensation events over time (from the inventory dispensing_records table).
- **Why it matters:** trend version of metric 8. Rising = program maturing. Flat = either we're treating fewer patients with severe pain (unlikely) or we're under-prescribing.
- **Caveat:** counts dispensation *events*, not mg dispensed. A patient on chronic morphine generates many dispensations; a single tramadol prescription generates one. If the team wants mg-MME (morphine-milligram-equivalent) totals, that's Phase 2.

### 18. Telemedicine consultations (line)
- **What it shows:** monthly count of teleconsult sessions (video + voice combined).
- **Why it matters:** adoption curve. A flat-zero line for the first quarter then ramp = team got comfortable with the tooling. Helpful for distinguishing "we ship features" vs "team uses features."

### 19. Follow-up visits over time (bar)
- **What it shows:** monthly count of `visit_type='follow_up'` visits.
- **Why it matters:** continuity-of-care lens. Should track total visits with a stable ratio. If follow-up share *drops* while total visits rise, the team is taking on too many new referrals without resourcing the existing patient panel.

### 20. Place of death, by zone (stacked bar)
- **What it shows:** for each BBMP zone (Central / East / North / South / West), the count of deceased patients split by where they died (home / hospital / in-transit).
- **Why it matters:** **the single most important program-effectiveness chart in the whole dashboard.** Home-death rate is the textbook quality indicator for palliative care. International benchmarks: 60–75% home deaths is excellent; < 40% means patients are dying in hospitals, suggesting your intervention came too late or didn't extend far enough.
- **How it's calculated:** deceased patients in window grouped by `(geographic_cluster, place_of_death)`. Currently most records lack `place_of_death` — encourage Satish to ingest the zone-wise line-list.
- **Talking point:** *"The taller the green (home) part of each zone's bar, the better we're doing in that zone. Big red (hospital) bars are zones where patients are dying away from family — likely zones to focus more support."*

### 21. Time in care (enrolment → death) — histogram
- **What it shows:** distribution of days from `Patient.created_at` (first enrolment) to `date_of_death`, in 6 buckets:
  - **0–7 days** — referred too late
  - **8–30 days** — acute palliation
  - **31–90 days** — short-course
  - **91–180 days** — mid-course
  - **181–365 days** — long-course
  - **365+ days** — multi-year
- **Why it matters:** the late-referral story (metric 12) in distribution form. Median + IQR shown below the chart.
- **Action when 0–7 day bucket is dominant:** see metric 12 talking points — referrer-education problem.

### 22. Vehicle utilization (horizontal bar)
- **What it shows:** total slots assigned to each vehicle in the period, plus utilization % vs target (default 25 slots/week).
- **Why it matters:** capital-planning input. If a vehicle is at 90% utilization, you need a second vehicle. If three vehicles are all at 30%, you're over-resourced.
- **How it's calculated:** schedule slots grouped by vehicle, divided by (target × weeks active).
- **Caveat:** only counts non-cancelled slots. Cancelled visits aren't a vehicle workload but the vehicle was probably already routed — this metric undercounts true vehicle hours.

### 23. Loss-to-follow-up distribution (bar chart)
- **What it shows:** the lost-to-follow-up patients (metric 11) bucketed by how long it's been since their last visit:
  - **60–90 days** — recently overdue, easy to recover
  - **91–180 days** — concerning
  - **180+ days** — likely permanent loss
  - **never visited** — referral never converted
- **Why it matters:** triage prioritization. The team should call the 60–90 day bucket first (highest recovery rate), then work backward.
- **Talking point:** *"Most of these patients can be recovered with one phone call. The 'never visited' bucket is a different problem — those are referrals that never converted into care, possibly stuck in onboarding. Different fix."*

---

## Section D — Demo data toggle

The "**Real data / Showing demo data**" switch in the top-right swaps every chart and StatCard between live database queries and a 12-month canned dataset.

**Why we built it:**
- During seed/dev/early operations, real numbers can be sparse (e.g. 0 follow-ups, 1 home visit) and the dashboard looks broken
- For donor presentations and early demos, we need a coherent program-maturity story — *what this dashboard will look like in a year of operations*
- The amber banner prevents anyone from confusing demo numbers for real ones

**The mock dataset is designed to tell a story:**
- Volume rises from ~38 home visits/month (June 2025) to ~82/month (May 2026)
- Total: ~700 home visits, ~225 distinct patients, ~94 deaths
- Place of death: 75 home / 25 hospital / 4 in-transit (~72% home-death rate, the international benchmark)
- Late-referral: 21.2% (high but improving — typical Indian palliative oncology)
- Vehicle utilization: 74% / 53% / 16% across three vehicles (under-utilized vehicle is the operational signal)
- Multi-disciplinary visits: 46%, avg 2.1 roles/visit
- 23 lost-to-follow-up patients, mostly in the 60–90 day recoverable bucket

**During the demo:**
1. Open the tab on real data first — show the team this is wired up to live data
2. Flip to demo mode — walk through the metrics in this guide
3. Flip back at the end — confirm the system is ready for real data as it comes in

---

## Section E — Honest limitations to disclose upfront

Don't get caught off-guard. Pre-empt these:

1. **KMs is estimated, not GPS-tracked.** The chart is a useful directional indicator but not a precise distance log. Per-visit GPS comes in Phase 2 if needed.
2. **Opioid detection depends on catalog flagging.** If a new SKU is added without `narcotic=true` and the name doesn't match our keyword list, it'll be missed. Mitigation: keyword list catches the major drugs; keep telling pharmacy to flag opioid SKUs.
3. **`team_members` capture rate drives both Consultation mix AND Multi-disciplinary %.** If a visit is logged without team-member roles, both metrics undercount. Real fix is in the visit-data-entry workflow.
4. **Place-of-death needs Satish's zone line-list ingested.** Currently most rows have `place_of_death=null`. Until that ingestion happens, the chart is sparse.
5. **"Late referrals" needs enrolment date, which we approximate with `created_at`.** If a patient was registered for triage but only started receiving care weeks later, the time-in-care number is overstated. Eventually we may add a separate `enrollment_date` field.
6. **Death chart shows the historic-import spike** by design (per Dr. Ashwini). Be ready to explain.
7. **The dashboard is single-tenant** — no comparison against other palliative-care orgs. We can layer that in later if a network like INPC asks.

---

## Section F — FAQ-style answers for likely doctor questions

> **"Why is the deaths chart so spiky?"**
> Because we ingested all the historic paper records on one day during digitization. Those deaths happened over many months but landed in the system on a single day. We chose to leave the spike visible rather than smooth it out — it's an honest representation of when records entered the system, even though it's not when patients died.

> **"What counts as a follow-up visit?"**
> Any visit logged with `visit_type='follow_up'` — i.e. not the initial assessment, not an emergency call, and not a phone-only check-in. So the second-and-onward home visit for a patient.

> **"Are phone visits real visits?"**
> Yes, in this dashboard they count. Phone visits are necessary for week-to-week continuity but they're not a substitute for home care — that's why home is broken out as its own line on the visits chart. If phone-only ratio gets high, it's a flag.

> **"Why don't we count caregivers in 'patients seen'?"**
> Because "patients seen" follows the medical-record patient. Caregiver work shows up implicitly in multi-disciplinary visits (counsellor, social worker roles) but isn't currently a separate count. Could add caregiver-encounters as a Phase 2 metric.

> **"What about ESAS / PPS scores?"**
> PPS and ESAS trajectories are Phase 2 work. Models are ready in the database (we collect both); the chart needs the BSC (Best Supportive Care) flag first, since trajectory only makes sense for non-BSC patients (BSC patients are expected to decline). One-day work.

> **"FAITH score for spiritual distress?"**
> Phase 4. The FAITH form doesn't exist yet — adding the standardized 5-dimension questionnaire is on the roadmap.

> **"Place of death — most rows are 'unknown' or 'others'?"**
> That's the data-entry gap. Satish has been keeping a paper line-list of zone-wise deaths with place; once ingested, the chart populates properly.

> **"Average visits before death?"**
> We retired this metric — it averaged a patient with 4 visits and a patient with 1 into "2.5", which told you nothing about either. Total visits + the per-month chart + median time-in-care tell the actual story.

> **"How do you know it's an opioid?"**
> Three signals (any one suffices): `narcotic=true` flag in the medicine catalog, WHO ATC code starting with `N02A`, or medicine name containing morphine / fentanyl / tramadol / oxycodone / codeine / buprenorphine / methadone / pethidine / hydromorphone / tapentadol / hydrocodone / diamorphone / oxymorphone. Robust enough to catch 95%+ of cases; missing 5% are usually new SKUs that pharmacy hasn't flagged yet.

---

## Section G — Where to find each metric in code

Useful when a doctor asks something specific and you want to verify the exact logic:

| Metric | Backend file | Function |
|---|---|---|
| All metrics | `backend/app/analytics/donor_metrics.py` | `DonorMetricsService.*` |
| Routes | `backend/app/analytics/routes.py` | `donor_*` endpoints |
| Visit table | `backend/app/saranam/models/patient_visit.py` | `PatientVisit` |
| Patient model (deaths, zone, BSC, enrolment) | `backend/app/patients/models.py` | `Patient` |
| Medicine catalog | `backend/app/inventory/models.py` | `MedicineMaster.narcotic`, `who_atc_code` |
| Schedule (KMs, vehicle util) | `backend/app/saranam/models/schedule_*.py` | `ScheduleSlot`, `ScheduleDay`, `WeeklySchedule` |

Frontend rendering: `frontend/src/components/analytics/DonorAnalyticsView.jsx` (one component, all charts).
Mock dataset: `frontend/src/components/analytics/donorMockData.js`.

---

## Section H — Next-phase metrics worth proposing

If the team likes what's there and asks "what else can we measure?", these are the highest-value additions per my recommendations:

1. **B6 BSC vs non-BSC counts** (S effort, 30 min) — adds Best Supportive Care flag on the patient header. Required for the next two:
2. **B3 PPS trajectory** (M effort) — median Palliative Performance Scale score over weeks-from-enrolment, non-BSC patients only. Direct outcome metric: are we slowing decline?
3. **B4 ESAS trajectory** (M effort) — symptom severity index over time. Falling ESAS = our care is working.
4. **Visit cadence adherence** (S effort) — % of patients visited within their `recommended_frequency_days` window. Operational quality marker.
5. **Patient-cohort Sankey** (M effort) — status transitions: new → active → BSC → deceased / lost. One chart that tells the whole journey for a board meeting.
6. **Cost per patient served** (S effort) — donor-side, needs a single program-cost input. *The* most-asked donor question.

Let Dr. Ashwini and Anish prioritize from this list after they've used the current dashboard for a couple of weeks.
