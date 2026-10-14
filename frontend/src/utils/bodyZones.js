/**
 * Body Zone Library
 *
 * Hardcoded list of anatomical zones used by the AI to highlight body
 * locations on the body map. Each slug maps to ONE zone on ONE view (front
 * or back), so the AI never has to decide "which side is this on" — the
 * zone definition tells it.
 *
 * Coordinates are normalized 0..1, calibrated against the line-art PNGs
 * `body-front.png` and `body-back.png` by visual inspection of both files
 * at native resolution. They are pre-mirrored: `left_*` slugs name the
 * PATIENT's left side, which on a front view sits on the IMAGE-RIGHT
 * (medical-imaging convention; matches the existing R/L chip convention).
 *
 * Calibration policy: zones are intentionally CONSERVATIVE — slightly
 * smaller than the actual body part they represent — so the highlight
 * stays clearly INSIDE the silhouette and never overflows. A small,
 * confident marker reads better than a big, sloppy one.
 *
 * To recalibrate, append `?calibrate=zones` to the patient page URL while
 * running locally (dev-only tool — see BodyZonesCalibrator.jsx).
 */

export const BODY_ZONES = [
  // ── Head / Neck ─────────────────────────────────────────
  { slug: 'head',           view: 'front', kind: 'ellipse', x: 0.445, y: 0.055, width: 0.11, height: 0.075, label: 'Head' },
  { slug: 'neck',           view: 'front', kind: 'rect',    x: 0.46, y: 0.135, width: 0.08, height: 0.03, label: 'Neck' },
  { slug: 'throat',         view: 'front', kind: 'rect',    x: 0.46, y: 0.155, width: 0.08, height: 0.025, label: 'Throat' },

  // ── Trunk (front) ───────────────────────────────────────
  { slug: 'chest',          view: 'front', kind: 'rect',    x: 0.38, y: 0.20, width: 0.24, height: 0.10, label: 'Chest' },
  { slug: 'upper_abdomen',  view: 'front', kind: 'rect',    x: 0.42, y: 0.30, width: 0.16, height: 0.05, label: 'Upper abdomen' },
  { slug: 'lower_abdomen',  view: 'front', kind: 'rect',    x: 0.42, y: 0.35, width: 0.16, height: 0.05, label: 'Lower abdomen' },
  { slug: 'pelvis',         view: 'front', kind: 'rect',    x: 0.42, y: 0.40, width: 0.16, height: 0.06, label: 'Pelvis' },

  // ── Trunk (back) ────────────────────────────────────────
  { slug: 'upper_back',     view: 'back',  kind: 'rect',    x: 0.36, y: 0.20, width: 0.28, height: 0.10, label: 'Upper back' },
  { slug: 'mid_back',       view: 'back',  kind: 'rect',    x: 0.38, y: 0.30, width: 0.24, height: 0.07, label: 'Mid back' },
  { slug: 'lower_back',     view: 'back',  kind: 'rect',    x: 0.40, y: 0.37, width: 0.20, height: 0.07, label: 'Lower back' },
  { slug: 'sacrum',         view: 'back',  kind: 'rect',    x: 0.43, y: 0.43, width: 0.14, height: 0.05, label: 'Sacrum' },

  // ── Shoulders (front) ──────────────────────────────────
  // patient's left shoulder = image-right on front view
  { slug: 'left_shoulder',  view: 'front', kind: 'ellipse', x: 0.61, y: 0.175, width: 0.08, height: 0.05, label: 'Left shoulder' },
  { slug: 'right_shoulder', view: 'front', kind: 'ellipse', x: 0.31, y: 0.175, width: 0.08, height: 0.05, label: 'Right shoulder' },

  // ── Hips (back) ─────────────────────────────────────────
  // back view: image-left = patient-left, so left_hip is on image-LEFT here
  { slug: 'left_hip',       view: 'back',  kind: 'ellipse', x: 0.32, y: 0.435, width: 0.08, height: 0.05, label: 'Left hip' },
  { slug: 'right_hip',      view: 'back',  kind: 'ellipse', x: 0.60, y: 0.435, width: 0.08, height: 0.05, label: 'Right hip' },

  // ── Arms (front) ────────────────────────────────────────
  { slug: 'left_upper_arm',  view: 'front', kind: 'rect',    x: 0.66, y: 0.22, width: 0.06, height: 0.10, label: 'Left upper arm' },
  { slug: 'right_upper_arm', view: 'front', kind: 'rect',    x: 0.28, y: 0.22, width: 0.06, height: 0.10, label: 'Right upper arm' },
  { slug: 'left_elbow',      view: 'front', kind: 'ellipse', x: 0.68, y: 0.32, width: 0.06, height: 0.04, label: 'Left elbow' },
  { slug: 'right_elbow',     view: 'front', kind: 'ellipse', x: 0.26, y: 0.32, width: 0.06, height: 0.04, label: 'Right elbow' },
  { slug: 'left_forearm',    view: 'front', kind: 'rect',    x: 0.70, y: 0.36, width: 0.06, height: 0.10, label: 'Left forearm' },
  { slug: 'right_forearm',   view: 'front', kind: 'rect',    x: 0.24, y: 0.36, width: 0.06, height: 0.10, label: 'Right forearm' },
  { slug: 'left_hand',       view: 'front', kind: 'ellipse', x: 0.665, y: 0.475, width: 0.075, height: 0.055, label: 'Left hand' },
  { slug: 'right_hand',      view: 'front', kind: 'ellipse', x: 0.26, y: 0.475, width: 0.075, height: 0.055, label: 'Right hand' },

  // ── Legs (front) ────────────────────────────────────────
  { slug: 'left_thigh',     view: 'front', kind: 'rect',    x: 0.51, y: 0.50, width: 0.08, height: 0.13, label: 'Left thigh' },
  { slug: 'right_thigh',    view: 'front', kind: 'rect',    x: 0.41, y: 0.50, width: 0.08, height: 0.13, label: 'Right thigh' },
  { slug: 'left_knee',      view: 'front', kind: 'ellipse', x: 0.51, y: 0.665, width: 0.08, height: 0.05, label: 'Left knee' },
  { slug: 'right_knee',     view: 'front', kind: 'ellipse', x: 0.41, y: 0.665, width: 0.08, height: 0.05, label: 'Right knee' },
  { slug: 'left_shin',      view: 'front', kind: 'rect',    x: 0.51, y: 0.72, width: 0.07, height: 0.13, label: 'Left shin' },
  { slug: 'right_shin',     view: 'front', kind: 'rect',    x: 0.42, y: 0.72, width: 0.07, height: 0.13, label: 'Right shin' },
  { slug: 'left_foot',      view: 'front', kind: 'ellipse', x: 0.505, y: 0.875, width: 0.085, height: 0.045, label: 'Left foot' },
  { slug: 'right_foot',     view: 'front', kind: 'ellipse', x: 0.41, y: 0.875, width: 0.085, height: 0.045, label: 'Right foot' },
];

// Indexed lookup for O(1) slug → zone resolution.
export const BODY_ZONES_BY_SLUG = Object.freeze(
  BODY_ZONES.reduce((acc, z) => { acc[z.slug] = z; return acc; }, {})
);

export const BODY_ZONE_SLUGS = BODY_ZONES.map(z => z.slug);

export function resolveZone(slug) {
  return BODY_ZONES_BY_SLUG[slug] || null;
}
