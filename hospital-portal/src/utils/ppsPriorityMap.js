/**
 * Bidirectional mapping between PPS score and patient priority
 * (clinical_complexity). Meeting §2.1 (2026-04-14).
 *
 *   PPS 0-40   ↔ 'high'     (worst-off — top priority)
 *   PPS 50-70  ↔ 'medium'
 *   PPS 80-100 ↔ 'low'
 *
 * Forward (PPS → priority) lives on the backend
 * (app/patients/priority_service.py). These frontend helpers implement the
 * reverse (priority → suggested default PPS) for UI defaulting:
 *
 *   Patient marked 'high' but no PPS yet  → suggest PPS 40 as the default
 *   Patient marked 'medium' but no PPS yet → suggest PPS 70
 *   Patient marked 'low' but no PPS yet   → suggest PPS 100
 *
 * The user can still pick any row; this just pre-selects the top of the
 * priority band so a one-click save writes a plausible value.
 */

/**
 * Default PPS score to suggest given a priority bucket.
 * Returns null when priority is absent or not in the mapping — caller
 * should leave the PPS form empty in that case.
 *
 * @param {string|null|undefined} complexity — 'high' | 'medium' | 'low'
 * @returns {number|null}
 */
export function defaultPpsForPriority(complexity) {
  if (complexity === 'high') return 40;
  if (complexity === 'medium') return 70;
  if (complexity === 'low') return 100;
  return null;
}

/**
 * Priority bucket derived from a PPS score. Mirror of the backend helper,
 * useful when you want to show a "derived priority" hint on the frontend
 * without a round-trip.
 *
 * @param {number|null|undefined} score — 0-100
 * @returns {string|null}
 */
export function priorityForPps(score) {
  if (score === null || score === undefined) return null;
  if (score <= 40) return 'high';
  if (score <= 70) return 'medium';
  return 'low';
}

/**
 * Display label for a priority bucket. Handles null + not_yet_determined.
 */
export function priorityLabel(complexity) {
  if (!complexity || complexity === 'not_yet_determined') return 'Not Yet Determined';
  return complexity.charAt(0).toUpperCase() + complexity.slice(1);
}
