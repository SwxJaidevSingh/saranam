/**
 * UHID (Unique Health ID) display helpers.
 *
 * Format: YYYY + ZZ + NNNN
 *  - YYYY  = 4-digit year of registration
 *  - ZZ    = 2-digit zone (South=01, East=02, North=03, West=04, Central=05)
 *  - NNNN  = sequence (4 digits, grows to 5/6/etc when overflowing 9999)
 *
 * Example: 2026010001, 2026019999, 20260110000
 *
 * UHIDs are generated server-side; this file only handles display formatting.
 */

export const ZONE_TO_CODE = Object.freeze({
  South: '01',
  East: '02',
  North: '03',
  West: '04',
  Central: '05',
});

/**
 * Hospital catalog fallback — mirrors the backend _SEED_HOSPITAL_CATALOG.
 * The authoritative list is DB-backed and fetched via
 * `useHospitalOptions()` from `frontend/src/hooks/useHospitalOptions.js`.
 * This hardcoded list exists only as a last-resort fallback for code paths
 * that don't yet consume the hook (e.g. when a patient response references
 * a code that isn't in the loaded catalog). Adding a new hospital here is
 * NOT required — use the in-app "+ Add Hospital" UI instead.
 */
export const HOSPITAL_OPTIONS = Object.freeze([
  { code: 'KMIO', name: 'Kidwai Memorial Institute of Oncology', prefix: 'KAGBAKMIO', homecare_prefix: 'KAGBAKMIO' },
  { code: 'KCGH', name: 'KC General Hospital', prefix: 'KAGBAKCGH', homecare_prefix: 'KAGBAKCGH' },
  { code: 'KIMS', name: 'Kempegowda Institute of Medical Sciences', prefix: 'KAGBAKIMS', homecare_prefix: 'KAGBAKIMS' },
]);

export const DEFAULT_HOSPITAL_CODE = 'KMIO';

/**
 * Look up a hospital entry by code. Accepts either the modern DB-shaped
 * objects (`homecare_prefix`) or the legacy seed shape (`prefix`).
 * @param {string|null|undefined} hospitalCode
 * @param {Array<object>} [catalog] — optional override (typically from useHospitalOptions)
 * @returns {object|null}
 */
function findEntry(hospitalCode, catalog) {
  if (!hospitalCode) return null;
  const list = catalog && catalog.length ? catalog : HOSPITAL_OPTIONS;
  return list.find((h) => h.code === hospitalCode) || null;
}

/**
 * Return the "Homecare UHID Code" prefix for a hospital code,
 * e.g. getHomecareCode('KMIO') -> 'KAGBAKMIO'.
 *
 * If the code isn't in the passed catalog (or the fallback), we derive
 * `KAGBA + code` so display never breaks — matches backend behavior.
 *
 * @param {string|null|undefined} hospitalCode
 * @param {Array<object>} [catalog] — optional live catalog from useHospitalOptions()
 * @returns {string|null}
 */
export function getHomecareCode(hospitalCode, catalog) {
  if (!hospitalCode) return null;
  const entry = findEntry(hospitalCode, catalog);
  if (entry) return entry.homecare_prefix || entry.prefix || `KAGBA${hospitalCode}`;
  return `KAGBA${String(hospitalCode).toUpperCase()}`;
}

/**
 * Return the full hospital display name.
 *
 * @param {string|null|undefined} hospitalCode
 * @param {Array<object>} [catalog] — optional live catalog from useHospitalOptions()
 * @returns {string|null}
 */
export function getHospitalName(hospitalCode, catalog) {
  const entry = findEntry(hospitalCode, catalog);
  return entry ? entry.name : null;
}

/**
 * Format a UHID for display. Returns an em-dash for null/empty values so
 * non-Bangalore patients (and patients created before this feature) render
 * cleanly in lists and cards.
 *
 * @param {string|null|undefined} uhid
 * @returns {string}
 */
export function formatUhid(uhid) {
  if (!uhid) return '—';
  return String(uhid);
}

/**
 * Truthy if a UHID looks like a valid generated value (digits only, ≥10 chars).
 * Useful for guarding "Copy UHID" buttons.
 *
 * @param {string|null|undefined} uhid
 * @returns {boolean}
 */
export function hasUhid(uhid) {
  return Boolean(uhid && /^\d{10,}$/.test(uhid));
}
