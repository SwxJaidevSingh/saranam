/**
 * Geographic constants for Saranam Home Care.
 *
 * Hospital catalog holds the coordinates and display metadata for each hospital
 * that runs the program. Route math and per-patient distance calculations both
 * read from this catalog:
 *   - Vehicle "base hospital" (Vehicle.base_hospital in the backend) drives the
 *     starting point of route optimization and total-km calculations.
 *   - Patient "linked hospital" (Patient.linked_hospital) drives the per-patient
 *     display: "3.1 km from KC General" on cards, info windows, and PDF columns.
 *
 * Add new hospitals here + in backend HOSPITAL_CATALOG (uhid_service.py). The
 * two catalogs must stay in sync — the backend holds the name and Homecare
 * Code prefix; the frontend additionally holds the geo coordinates.
 */

export const DEFAULT_SERVICE_RADIUS_KM = 15;

export const HOSPITALS = Object.freeze({
  KMIO: {
    code: 'KMIO',
    lat: 12.9337,
    lng: 77.5713,
    name: 'Kidwai Memorial Institute of Oncology',
    shortName: 'Kidwai',
    serviceRadiusKm: DEFAULT_SERVICE_RADIUS_KM,
    markerColor: '#1976d2',  // blue
  },
  KCGH: {
    code: 'KCGH',
    lat: 13.0067,
    lng: 77.5747,
    name: 'KC General Hospital',
    shortName: 'KC General',
    serviceRadiusKm: DEFAULT_SERVICE_RADIUS_KM,
    markerColor: '#059669',  // green
  },
  KIMS: {
    code: 'KIMS',
    lat: 12.9565,
    lng: 77.5743,
    name: 'Kempegowda Institute of Medical Sciences',
    shortName: 'KIMS',
    serviceRadiusKm: DEFAULT_SERVICE_RADIUS_KM,
    markerColor: '#0d9488',  // teal
  },
});

export const DEFAULT_HOSPITAL_CODE = 'KMIO';

/**
 * Return the full hospital object for a given code, falling back to the
 * default hospital (Kidwai) when the code is missing or unknown.
 */
export function getHospitalBase(hospitalCode) {
  return HOSPITALS[hospitalCode] || HOSPITALS[DEFAULT_HOSPITAL_CODE];
}

/**
 * Backwards-compat alias: anywhere in the codebase still referring to
 * ``KIDWAI_BASE`` gets the same object it always did.
 */
export const KIDWAI_BASE = {
  lat: HOSPITALS.KMIO.lat,
  lng: HOSPITALS.KMIO.lng,
  name: HOSPITALS.KMIO.name,
  shortName: 'Kidwai Hospital',  // preserves the old label for legacy callers
};

export const ZONE_COLORS = {
  North: { fill: '#3B82F6', stroke: '#2563EB', bg: '#EFF6FF', marker: '#2563EB' },
  South: { fill: '#10B981', stroke: '#059669', bg: '#ECFDF5', marker: '#059669' },
  East:  { fill: '#F59E0B', stroke: '#D97706', bg: '#FFFBEB', marker: '#D97706' },
  West:  { fill: '#8B5CF6', stroke: '#7C3AED', bg: '#F5F3FF', marker: '#7C3AED' },
  Central: { fill: '#EF4444', stroke: '#DC2626', bg: '#FEF2F2', marker: '#DC2626' },
};

/**
 * Calculate haversine distance between two lat/lng points.
 * @returns distance in kilometers
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Calculate distance from a specific hospital to a given point.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {string} [hospitalCode] - One of HOSPITALS keys. Defaults to Kidwai.
 * @returns {{ km: number, isWithinRadius: boolean, hospitalCode: string, hospitalShortName: string, label: string }}
 */
export function distanceFromHospital(lat, lng, hospitalCode = DEFAULT_HOSPITAL_CODE) {
  const base = getHospitalBase(hospitalCode);
  const km = haversineDistance(base.lat, base.lng, lat, lng);
  return {
    km: Math.round(km * 10) / 10,
    isWithinRadius: km <= base.serviceRadiusKm,
    hospitalCode: base.code,
    hospitalShortName: base.shortName,
    label: `${km.toFixed(1)} km from ${base.shortName}`,
  };
}

/**
 * Backwards-compat: legacy callers still import ``distanceFromKidwai`` and
 * expect Kidwai as the origin. New code should call ``distanceFromHospital``
 * with an explicit hospital code.
 */
export function distanceFromKidwai(lat, lng, radiusKm = DEFAULT_SERVICE_RADIUS_KM) {
  // Radius override is preserved for the (rare) legacy caller that passes it.
  const km = haversineDistance(KIDWAI_BASE.lat, KIDWAI_BASE.lng, lat, lng);
  return {
    km: Math.round(km * 10) / 10,
    isWithinRadius: km <= radiusKm,
    hospitalCode: 'KMIO',
    hospitalShortName: HOSPITALS.KMIO.shortName,
    label: `${km.toFixed(1)} km from ${KIDWAI_BASE.shortName}`,
  };
}

/**
 * Calculate total route distance for an ordered array of GPS points, starting
 * from a specific hospital's base location.
 *
 * @param {Array<{lat: number, lng: number, name?: string}>} points
 * @param {string|boolean} [originHospitalCode='KMIO'] - Hospital code to start
 *   from. For backwards compat, ``true`` means Kidwai (legacy boolean signature)
 *   and ``false`` means no prepended origin.
 * @returns {{ totalKm: number, segments: Array<{from: string, to: string, km: number}> }}
 */
export function calculateRouteDistances(points, originHospitalCode = DEFAULT_HOSPITAL_CODE) {
  const segments = [];
  let totalKm = 0;

  // Legacy boolean signature support
  let prependOrigin = true;
  let originCode = DEFAULT_HOSPITAL_CODE;
  if (originHospitalCode === false) {
    prependOrigin = false;
  } else if (originHospitalCode === true) {
    prependOrigin = true;
    originCode = DEFAULT_HOSPITAL_CODE;
  } else if (typeof originHospitalCode === 'string') {
    originCode = originHospitalCode;
  }

  const base = getHospitalBase(originCode);
  const allPoints = prependOrigin
    ? [{ lat: base.lat, lng: base.lng, name: base.shortName }, ...points]
    : points;

  for (let i = 1; i < allPoints.length; i++) {
    const prev = allPoints[i - 1];
    const curr = allPoints[i];
    const km = haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng);
    segments.push({
      from: prev.name || `Point ${i - 1}`,
      to: curr.name || `Point ${i}`,
      km: Math.round(km * 10) / 10,
    });
    totalKm += km;
  }

  return {
    totalKm: Math.round(totalKm * 10) / 10,
    segments,
  };
}

/**
 * Nearest-neighbor route optimization. Starts at the given hospital's base
 * coordinates (default Kidwai), greedily picks the closest unvisited point
 * at each step.
 *
 * @param {Array<{id: string, lat: number, lng: number}>} points
 * @param {string} [originHospitalCode='KMIO']
 * @returns {Array<string>} optimized order of point IDs
 */
export function nearestNeighborOrder(points, originHospitalCode = DEFAULT_HOSPITAL_CODE) {
  if (points.length <= 1) return points.map(p => p.id);

  const base = getHospitalBase(originHospitalCode);
  const visited = new Set();
  const order = [];
  let curLat = base.lat;
  let curLng = base.lng;

  while (order.length < points.length) {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      if (visited.has(i)) continue;
      const d = haversineDistance(curLat, curLng, points[i].lat, points[i].lng);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    visited.add(bestIdx);
    order.push(points[bestIdx].id);
    curLat = points[bestIdx].lat;
    curLng = points[bestIdx].lng;
  }

  return order;
}

/**
 * Generate a circle polygon path for Google Maps.
 */
export function generateCirclePolygon(centerLat, centerLng, radiusKm, numPoints = 64) {
  const points = [];
  const R = 6371;
  for (let i = 0; i < numPoints; i++) {
    const bearing = (2 * Math.PI * i) / numPoints;
    const lat1 = toRad(centerLat);
    const lng1 = toRad(centerLng);
    const d = radiusKm / R;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing)
    );
    const lng2 = lng1 + Math.atan2(
      Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );
    points.push({ lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI });
  }
  return points;
}

/**
 * Generate a wedge/sector polygon path (annular sector) for Google Maps.
 * Angles: 0 = North, clockwise.
 */
export function generateWedgePolygon(centerLat, centerLng, innerRadiusKm, outerRadiusKm, startAngleDeg, endAngleDeg, numArcPoints = 32) {
  const R = 6371;

  function pointAt(bearingDeg, distKm) {
    const bearing = toRad(bearingDeg);
    const lat1 = toRad(centerLat);
    const lng1 = toRad(centerLng);
    const d = distKm / R;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing)
    );
    const lng2 = lng1 + Math.atan2(
      Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );
    return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
  }

  const points = [];
  // Outer arc: start → end
  for (let i = 0; i <= numArcPoints; i++) {
    const angle = startAngleDeg + (endAngleDeg - startAngleDeg) * (i / numArcPoints);
    points.push(pointAt(angle, outerRadiusKm));
  }
  // Inner arc: end → start (reverse)
  for (let i = numArcPoints; i >= 0; i--) {
    const angle = startAngleDeg + (endAngleDeg - startAngleDeg) * (i / numArcPoints);
    points.push(pointAt(angle, innerRadiusKm));
  }
  return points;
}

/**
 * Zone wedge configuration for map overlays.
 * Central = small circle, directional zones = wedge sectors.
 */
export const ZONE_WEDGE_CONFIG = {
  Central: { type: 'circle', radius: 10 },
  North:   { type: 'wedge', innerRadius: 10, outerRadius: 30, startAngle: 315, endAngle: 405 },
  East:    { type: 'wedge', innerRadius: 10, outerRadius: 30, startAngle: 45,  endAngle: 135 },
  South:   { type: 'wedge', innerRadius: 10, outerRadius: 30, startAngle: 135, endAngle: 225 },
  West:    { type: 'wedge', innerRadius: 10, outerRadius: 30, startAngle: 225, endAngle: 315 },
};

/**
 * Calculate actual driving distance between two points using Google Maps Directions API.
 * @returns {Promise<number>} distance in kilometers
 */
export async function getDrivingDistance(lat1, lng1, lat2, lng2) {
  if (!window.google?.maps) {
    throw new Error('Google Maps API not loaded');
  }
  const directionsService = new window.google.maps.DirectionsService();
  return new Promise((resolve, reject) => {
    directionsService.route({
      origin: { lat: parseFloat(lat1), lng: parseFloat(lng1) },
      destination: { lat: parseFloat(lat2), lng: parseFloat(lng2) },
      travelMode: window.google.maps.TravelMode.DRIVING,
    }, (result, status) => {
      if (status === 'OK' && result.routes[0]?.legs[0]?.distance) {
        // Value in meters, convert to km
        resolve(result.routes[0].legs[0].distance.value / 1000);
      } else {
        reject(new Error(`Directions API failed with status: ${status}`));
      }
    });
  });
}

