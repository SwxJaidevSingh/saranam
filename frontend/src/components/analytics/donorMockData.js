/**
 * Mock dataset for the Donor / ToC view.
 *
 * Twelve months of credible-looking palliative-care numbers, designed to tell
 * a coherent program-maturity story for demos when real data is sparse:
 *
 *   - 2025-06 to 2025-09 — launch / ramp-up (low volumes)
 *   - 2025-10 to 2026-02 — steady scale-up
 *   - 2026-03 onward     — stable operations with stronger home-death share,
 *                          falling late-referral % (signs of program success)
 *
 * Shape matches the real API responses 1:1, so the view can swap between
 * fetched and mock data with a single state toggle.
 */

const MONTH_LABELS = [
  '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11',
  '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05',
];

// Build week labels (Mondays) covering ~52 weeks ending today.
function buildWeekLabels(weeks = 52) {
  const today = new Date();
  // Walk back to the Monday of the current week
  const day = today.getDay() || 7; // Sun=0 → 7
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - (day - 1));
  thisMonday.setHours(0, 0, 0, 0);

  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const m = new Date(thisMonday);
    m.setDate(thisMonday.getDate() - i * 7);
    out.push(m.toISOString().slice(0, 10));
  }
  return out;
}

const WEEK_LABELS = buildWeekLabels(52);

// Helper: rising series with mild noise
function rising(base, delta, noise = 0.15, n = 12) {
  return Array.from({ length: n }, (_, i) => {
    const trend = base + delta * i;
    const wobble = trend * (Math.random() - 0.5) * noise * 2;
    return Math.max(0, Math.round(trend + wobble));
  });
}

// Generate the mock once at module load — keeps numbers stable during a session
const HOME_VISITS = rising(38, 4, 0.12);                    // 38 → ~82
const OPD_VISITS = rising(12, 1, 0.20);                     // 12 → ~22
const PHONE_VISITS = rising(25, 3, 0.18);                   // 25 → ~58
const IPD_VISITS = rising(2, 0.3, 0.30);                    // light
const TOTAL_VISITS = HOME_VISITS.map((h, i) =>
  h + OPD_VISITS[i] + PHONE_VISITS[i] + IPD_VISITS[i]);
const PATIENTS_SEEN = rising(48, 5, 0.10);                  // 48 → ~100
const FOLLOWUPS = HOME_VISITS.map(h => Math.round(h * 0.55));
const FOLLOWUP_PATIENTS = Math.round(FOLLOWUPS.reduce((a, b) => a + b, 0) * 0.45); // ~330
const DEATHS_MONTHLY = [3, 4, 5, 6, 7, 8, 9, 10, 9, 11, 12, 10];
const TELE_VIDEO = rising(2, 1.2, 0.20);                    // adoption curve
const TELE_VOICE = rising(8, 0.6, 0.15);
const TELE_TOTAL = TELE_VIDEO.map((v, i) => v + TELE_VOICE[i]);
const OPIOID_DISPENSATIONS = rising(6, 1.5, 0.20);

// Slots per week — gentle uptrend across 52 weeks
const SLOTS_PER_WEEK = WEEK_LABELS.map((_, i) =>
  Math.max(15, Math.round(20 + i * 0.6 + (Math.random() - 0.5) * 8)));
const KM_PER_VISIT_AVG = 12;
const KM_PER_WEEK = SLOTS_PER_WEEK.map(s => Math.round(s * KM_PER_VISIT_AVG * 10) / 10);

// Sum totals
const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const totalHome = sum(HOME_VISITS);
const totalOpd = sum(OPD_VISITS);
const totalPhone = sum(PHONE_VISITS);
const totalIpd = sum(IPD_VISITS);
const totalAllVisits = totalHome + totalOpd + totalPhone + totalIpd;
const totalPatientsSeen = Math.round(totalAllVisits * 0.18);   // ~225
const totalConsultations = Math.round(totalAllVisits * 0.62);
const totalDeaths = sum(DEATHS_MONTHLY);
const totalKm = Math.round(sum(KM_PER_WEEK));

// 2026-05-13 client-meeting additions
const totalNewRegistrations = Math.round(totalPatientsSeen * 0.82);          // ~185
const totalHomeFirstVisits = Math.round(totalHome * 0.24);                   // first-visit share of home
const totalHomeFollowUpVisits = Math.round(totalHome * 0.70);                // follow-up share of home

// Previous-period numbers ~70% of current to show "growing" delta
const prev = (curr, factor = 0.7) => Math.round(curr * factor);
const delta = (curr, previous) => previous === 0
  ? null
  : Math.round((curr - previous) / previous * 1000) / 10;

const PREV = {
  home: prev(totalHome, 0.62),
  total: prev(totalAllVisits, 0.65),
  patients: prev(totalPatientsSeen, 0.78),
  deaths: prev(totalDeaths, 0.85),
  consultations: prev(totalConsultations, 0.66),
  newRegistrations: prev(totalNewRegistrations, 0.71),
  homeFirst: prev(totalHomeFirstVisits, 0.58),
  homeFollowUp: prev(totalHomeFollowUpVisits, 0.66),
};

export function getMockDonorData() {
  return {
    overview: {
      range: { start: '2025-06-01', end: '2026-05-31' },
      previous_range: { start: '2024-06-01', end: '2025-05-31' },
      metrics: {
        home_visits:          { value: totalHome,                  previous: PREV.home,            delta_pct: delta(totalHome, PREV.home), all_time: Math.round(totalHome * 1.4) },
        home_first_visits:    { value: totalHomeFirstVisits,       previous: PREV.homeFirst,       delta_pct: delta(totalHomeFirstVisits, PREV.homeFirst), all_time: Math.round(totalHomeFirstVisits * 1.4) },
        home_follow_up_visits:{ value: totalHomeFollowUpVisits,    previous: PREV.homeFollowUp,    delta_pct: delta(totalHomeFollowUpVisits, PREV.homeFollowUp), all_time: Math.round(totalHomeFollowUpVisits * 1.4) },
        total_visits:         { value: totalAllVisits,             previous: PREV.total,           delta_pct: delta(totalAllVisits, PREV.total), all_time: Math.round(totalAllVisits * 1.4) },
        patients_seen:        { value: totalPatientsSeen,          previous: PREV.patients,        delta_pct: delta(totalPatientsSeen, PREV.patients), all_time: Math.round(totalPatientsSeen * 1.4) },
        deaths:               { value: totalDeaths,                previous: PREV.deaths,          delta_pct: delta(totalDeaths, PREV.deaths), all_time: Math.round(totalDeaths * 1.4) },
        consultations:        { value: totalConsultations,         previous: PREV.consultations,   delta_pct: delta(totalConsultations, PREV.consultations), all_time: Math.round(totalConsultations * 1.4) },
        new_registrations:    { value: totalNewRegistrations,      previous: PREV.newRegistrations,delta_pct: delta(totalNewRegistrations, PREV.newRegistrations), all_time: Math.round(totalNewRegistrations * 1.4) },
      },
    },

    visits_timeline: {
      period: 'monthly',
      labels: MONTH_LABELS,
      series: [
        { name: 'home',  data: HOME_VISITS },
        { name: 'opd',   data: OPD_VISITS },
        { name: 'phone', data: PHONE_VISITS },
        { name: 'ipd',   data: IPD_VISITS },
      ],
    },

    deaths_timeline: {
      period: 'monthly',
      labels: MONTH_LABELS,
      data: DEATHS_MONTHLY,
    },

    consultations_mix: {
      labels: ['physician', 'nurse', 'physiotherapist', 'psycho-social', 'social_worker'],
      data:   [184, 412, 96, 58, 34],
      total_role_encounters: 784,
    },

    distance_timeline: {
      labels: WEEK_LABELS,
      slots_per_week: SLOTS_PER_WEEK,
      km_per_week: KM_PER_WEEK,
      total_km: totalKm,
      all_time_km: Math.round(totalKm * 1.4),
      avg_km_per_visit: KM_PER_VISIT_AVG,
      note:
        `Estimated from approved weekly schedules × ${KM_PER_VISIT_AVG} km/visit ` +
        `(configurable via ANALYTICS_AVG_KM_PER_VISIT env). [DEMO DATA]`,
    },

    opioid_usage: {
      period: 'monthly',
      labels: MONTH_LABELS,
      data: OPIOID_DISPENSATIONS,
      patient_count: 47,
      dispensation_count: sum(OPIOID_DISPENSATIONS),
      all_time_patient_count: 75,
      all_time_dispensation_count: sum(OPIOID_DISPENSATIONS) * 2,
      note:
        'Detected via narcotic=true, WHO ATC N02A*, or curated keyword match. [DEMO DATA]',
    },

    telemedicine_timeline: {
      period: 'monthly',
      labels: MONTH_LABELS,
      data: TELE_TOTAL,
      total: sum(TELE_TOTAL),
      all_time_total: Math.round(sum(TELE_TOTAL) * 1.4),
      video_count: sum(TELE_VIDEO),
      voice_count: sum(TELE_VOICE),
    },

    multidisciplinary: {
      total_home_visits: totalHome,
      visits_with_team_data: Math.round(totalHome * 0.92),
      multidisciplinary_visits: Math.round(totalHome * 0.46),
      multidisciplinary_pct: 46.3,
      avg_roles_per_visit: 2.1,
      all_time_multidisciplinary_pct: 48.5,
      all_time_avg_roles_per_visit: 2.25,
    },

    followups: {
      period: 'monthly',
      labels: MONTH_LABELS,
      data: FOLLOWUPS,
      patients_with_followups: FOLLOWUP_PATIENTS,
      total_followup_visits: sum(FOLLOWUPS),
    },

    // Realistic palliative split: home > hospital >> in_transit; falling
    // hospital share over time is a sign of the program working.
    place_of_death_by_zone: {
      zones: ['Central', 'East', 'North', 'South', 'West'],
      places: ['home', 'hospital', 'in_transit'],
      matrix: [
        [14, 5, 1],   // Central: 14 home / 5 hospital / 1 in-transit
        [22, 7, 1],   // East
        [11, 4, 0],   // North
        [19, 6, 1],   // South
        [9,  3, 1],   // West
      ],
      totals_by_zone:  [20, 30, 15, 26, 13],
      totals_by_place: [75, 25, 4],
      grand_total: 104,
    },

    loss_to_followup: {
      threshold_days: 60,
      total_count: 23,
      buckets: {
        '60-90_days': 11,
        '91-180_days': 7,
        '180+_days': 3,
        'never_visited': 2,
      },
      items: [],   // intentionally empty — view now uses bucket chart, not list
      limit: 50,
    },

    vehicle_utilization: {
      target_slots_per_week: 25,
      weeks: WEEK_LABELS,
      vehicles: [
        {
          vehicle_id: 'v-001',
          name: 'Saranam Ambulance #1',
          registration: 'KA-01-AB-1234',
          weeks: WEEK_LABELS,
          slots_per_week: SLOTS_PER_WEEK.map(s => Math.round(s * 0.55)),
          total_slots: Math.round(sum(SLOTS_PER_WEEK) * 0.55),
          avg_slots_per_active_week: 18.6,
          utilization_pct: 74.4,
        },
        {
          vehicle_id: 'v-002',
          name: 'Saranam Ambulance #2',
          registration: 'KA-01-CD-5678',
          weeks: WEEK_LABELS,
          slots_per_week: SLOTS_PER_WEEK.map(s => Math.round(s * 0.40)),
          total_slots: Math.round(sum(SLOTS_PER_WEEK) * 0.40),
          avg_slots_per_active_week: 13.2,
          utilization_pct: 52.8,
        },
        {
          vehicle_id: 'v-003',
          name: 'Saranam Outreach Van',
          registration: 'KA-01-EF-9012',
          weeks: WEEK_LABELS,
          slots_per_week: SLOTS_PER_WEEK.map(s => Math.round(s * 0.05)),
          total_slots: Math.round(sum(SLOTS_PER_WEEK) * 0.05),
          avg_slots_per_active_week: 4.1,
          utilization_pct: 16.4,
        },
      ],
      fleet_total_slots: sum(SLOTS_PER_WEEK),
    },

    // 2026-05-13 meeting metric: registration → first visit, in home-care
    // days (default Mon–Thu count as HC days, target ≤ 8). Healthy cohort:
    // ~88% within target, modest tail to 21+ days.
    registration_to_first_visit: {
      range: { start: '2025-06-01', end: '2026-05-31' },
      target_homecare_days: 8,
      homecare_weekdays: [0, 1, 2, 3],
      cohort_size: 165,
      within_target: 145,
      outside_target: 20,
      within_target_pct: 87.9,
      median_homecare_days: 4,
      p90_homecare_days: 9,
      distribution: {
        labels: ['0 HC-days', '1–2', '3–4', '5–6', '7–8', '9–12', '13–20', '21+'],
        data:   [5,           25,    50,    35,    30,    8,      5,       7],
      },
      note: 'Cohort = patients whose first completed visit fell in this window. [DEMO DATA]',
    },

    // Heavy left tail at 0-7 days — late-referral pattern still present but
    // shrinking as the program matures.
    enrollment_to_death: {
      labels:       ['0–7 days', '8–30 days', '31–90 days', '91–180 days', '181–365 days', '365+ days'],
      descriptions: ['Referred too late', 'Acute palliation', 'Short-course', 'Mid-course', 'Long-course', 'Multi-year'],
      data:         [22, 31, 24, 14, 9, 4],
      total_deceased_with_enrollment: 104,
      median_days_in_care: 38,
      q1_days_in_care: 9,
      q3_days_in_care: 124,
      late_referral_count: 22,
      late_referral_pct: 21.2,
    },
    pain_ladder: [
      { pain_tier: 'Mild (1-3)', 'No Analgesic': 5, 'Step 1 (Non-Opioid)': 12, 'Step 2 (Weak Opioid)': 3, 'Step 3 (Strong Opioid)': 2 },
      { pain_tier: 'Moderate (4-6)', 'No Analgesic': 2, 'Step 1 (Non-Opioid)': 8, 'Step 2 (Weak Opioid)': 15, 'Step 3 (Strong Opioid)': 4 },
      { pain_tier: 'Severe (7-10)', 'No Analgesic': 1, 'Step 1 (Non-Opioid)': 2, 'Step 2 (Weak Opioid)': 5, 'Step 3 (Strong Opioid)': 28 }
    ]
  };
}
