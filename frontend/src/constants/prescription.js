/**
 * Shared prescription/medication constants used across all prescription forms
 * (OPD, HomeCare, Physio, Saranam VisitDetail, PlanOfCare).
 */

// ─── Structured Dosage (Morning / Afternoon / Night) ──────────────
export const DOSAGE_AMOUNTS = ['0', '¼', '½', '1', '1½', '2'];
export const DOSAGE_AMOUNTS_NIGHT = ['0', '¼', '½', '1', '1½', '2', '3', '4']; // Night allows higher for 2x dosing

// ─── Time-Based Dosage Slots (opioid preset) ─────────────────────
export const TIME_DOSAGE_SLOTS = [
  { key: 'dosage_6am', label: '6 AM' },
  { key: 'dosage_10am', label: '10 AM' },
  { key: 'dosage_2pm', label: '2 PM' },
  { key: 'dosage_6pm', label: '6 PM' },
  { key: 'dosage_10pm', label: '10 PM' },
];

// ─── Schedule modes (meeting §5.2, 2026-04-14) ───────────────────
// Drives which timing columns are displayed/saved per medicine row.
export const SCHEDULE_MODES = [
  { value: 'opioid', label: 'Opioid (6/10/2/6/10)', description: '5 fixed slots for morphine / opioid protocols' },
  { value: 'tds', label: 'Morning / Afternoon / Night', description: '3 slots for standard non-opioid dosing' },
  { value: 'custom', label: 'Custom schedule', description: 'Add any number of time-dose pairs' },
];

// Legacy 3-slot columns reused for the TDS mode.
export const TDS_SLOTS = [
  { key: 'dosage_morning', label: 'Morning' },
  { key: 'dosage_afternoon', label: 'Afternoon' },
  { key: 'dosage_night', label: 'Night' },
];

// ─── Frequency ────────────────────────────────────────────────────
export const FREQUENCY_OPTIONS = [
  { value: 'OD', label: 'Once daily (OD)' },
  { value: 'BD', label: 'Twice daily (BD)' },
  { value: 'TDS', label: 'Three times daily (TDS)' },
  { value: 'QDS', label: 'Four times daily (QDS)' },
  { value: 'HS', label: 'At bedtime (HS)' },
  { value: 'STAT', label: 'Immediately (STAT)' },
  { value: 'Q4H', label: 'Every 4 hours' },
  { value: 'Q6H', label: 'Every 6 hours' },
  { value: 'Q8H', label: 'Every 8 hours' },
];

// ─── Route ────────────────────────────────────────────────────────
export const ROUTE_OPTIONS = [
  { value: 'oral', label: 'Oral' },
  { value: 'IV', label: 'Intravenous (IV)' },
  { value: 'IM', label: 'Intramuscular (IM)' },
  { value: 'SC', label: 'Subcutaneous (SC)' },
  { value: 'topical', label: 'Topical' },
  { value: 'inhalation', label: 'Inhalation' },
  { value: 'sublingual', label: 'Sublingual' },
  { value: 'rectal', label: 'Rectal' },
  { value: 'transdermal', label: 'Transdermal' },
];

// ─── Duration ─────────────────────────────────────────────────────
export const DURATION_OPTIONS = [
  '1 day', '2 days', '3 days', '5 days', '7 days',
  '10 days', '14 days', '1 month', 'Ongoing',
];

export const DURATION_UNIT_OPTIONS = [
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
  { value: 'months', label: 'Months' },
];

// ─── Instructions (Req 5.2) ──────────────────────────────────────
export const INSTRUCTION_OPTIONS = [
  'Before food',
  'After food',
  'With food',
  'Empty stomach',
  'At bedtime',
  'As directed',
];

// ─── Medicine Type (Req 5.3) ─────────────────────────────────────
export const MEDICINE_TYPE_OPTIONS = [
  { value: 'immediate_release', label: 'Immediate Release' },
  { value: 'sustained_release', label: 'Sustained Release' },
  { value: 'extended_release', label: 'Extended Release' },
];

// ─── Dosage Form (Req 5.4) ──────────────────────────────────────
export const DOSAGE_FORM_OPTIONS = [
  { value: 'tablet', label: 'Tablet' },
  { value: 'syrup', label: 'Syrup' },
  { value: 'suspension', label: 'Suspension' },
  { value: 'capsule', label: 'Capsule' },
  { value: 'injection', label: 'Injection' },
  { value: 'drops', label: 'Drops' },
  { value: 'cream_ointment', label: 'Cream/Ointment' },
  { value: 'inhaler', label: 'Inhaler' },
  { value: 'suppository', label: 'Suppository' },
  { value: 'patch', label: 'Patch' },
  { value: 'enema', label: 'Enema' },
  { value: 'respules', label: 'Respules' },
  { value: 'spray', label: 'Spray' },
];

// ─── Backward Compatibility ──────────────────────────────────────
const FREQ_LEGACY_MAP = {
  'Once daily': 'OD',
  'Twice daily': 'BD',
  'Three times daily': 'TDS',
  'Four times daily': 'QDS',
  'Every 4 hours': 'Q4H',
  'Every 6 hours': 'Q6H',
  'Every 8 hours': 'Q8H',
  'As needed': 'SOS',
  'Stat': 'STAT',
};

/** Map old frequency text ("Once daily") to abbreviation ("OD"). */
export function normalizeFrequency(freq) {
  if (!freq) return '';
  return FREQ_LEGACY_MAP[freq] || freq;
}

/** Format structured dosage as "½-0-1" display string (legacy 3-slot). */
export function formatDosageDisplay(morning, afternoon, night) {
  const m = morning || '0';
  const a = afternoon || '0';
  const n = night || '0';
  if (m === '0' && a === '0' && n === '0') return '';
  return `${m}-${a}-${n}`;
}

/** Format time-based dosage as "1-0-1-0-2" display string (5-slot). */
export function formatTimeDosageDisplay(d6am, d10am, d2pm, d6pm, d10pm) {
  const vals = [d6am || '0', d10am || '0', d2pm || '0', d6pm || '0', d10pm || '0'];
  if (vals.every(v => v === '0')) return '';
  return vals.join('-');
}

// ─── Dosage form helpers (bridge inventory ⇄ prescription vocab) ──
// Inventory medicines use the DosageForm enum (tablet…patch); older API
// responses/snapshots may even carry "DosageForm.TABLET". These helpers clean
// that up for display and map it onto a prescription <select> option value.
const _DOSAGE_FORM_INVENTORY_MAP = { cream: 'cream_ointment', ointment: 'cream_ointment' };

/** Human label for a dosage_form value, tolerant of legacy "DosageForm.X". */
export function formatDosageForm(v) {
  if (!v) return '';
  const clean = String(v).replace('DosageForm.', '').toLowerCase();
  const mapped = _DOSAGE_FORM_INVENTORY_MAP[clean] || clean;
  const opt = DOSAGE_FORM_OPTIONS.find(o => o.value === mapped);
  return opt ? opt.label : clean.charAt(0).toUpperCase() + clean.slice(1);
}

/** Map an inventory dosage_form to the closest prescription <select> option value. */
export function toPrescriptionDosageForm(v) {
  if (!v) return '';
  const clean = String(v).replace('DosageForm.', '').toLowerCase();
  const mapped = _DOSAGE_FORM_INVENTORY_MAP[clean] || clean;
  return DOSAGE_FORM_OPTIONS.some(o => o.value === mapped) ? mapped : '';
}

/** Normalize medications loaded from a saved / carried-forward prescription so they
 *  match the current form vocabulary: clean dosage_form, and ensure a strength string
 *  (older snapshots predate the structured-strength flow — fall back to `dosage`). */
export function normalizeLoadedMeds(meds) {
  if (!Array.isArray(meds)) return [];
  return meds.map(m => ({
    ...m,
    dosage_form: toPrescriptionDosageForm(m.dosage_form),
    strength: m.strength || m.dosage || '',
  }));
}
