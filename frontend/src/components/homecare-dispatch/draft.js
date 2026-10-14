/**
 * Planning-board draft rules shared by the dispatch tabs.
 * Mirrors the Saranam Streamlit console: a draft is a list of assignments
 * { patient_id, vehicle_id, slot_order, priority, type, visit_type, gap,
 *   urgency, homecare_days, sla_days } plus display fields.
 */

const DAY_INDEX = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

export const homecareDaysString = (config) => (config?.homecare_weekdays || ['Monday', 'Tuesday', 'Thursday', 'Friday']).join(', ');

const slaFor = (config, priority) => config?.sla_days?.[priority] ?? 4;

const displayFields = (p) => ({
  patient_name: p?.name ?? p?.patient_name,
  uhid: p?.uhid,
  hospital_uhid: p?.hospital_uhid,
  zone: p?.zone,
  lat: p?.lat,
  lon: p?.lon,
  phone: p?.phone,
  address: p?.address,
  is_deceased: !!p?.is_deceased,
  date_of_death: p?.date_of_death,
});

/** Saved schedule row (API shape) -> draft assignment. */
export function draftFromSavedSlot(s, config) {
  const priority = s.priority_at_visit;
  return {
    patient_id: String(s.patient_id),
    vehicle_id: String(s.vehicle_id),
    slot_order: s.slot_order || 1,
    priority,
    type: s.patient_type_at_visit,
    visit_type: s.visit_type || (s.patient_type_at_visit === 'new' ? 'initial' : 'follow_up'),
    gap: s.gap_days_at_visit,
    urgency: s.urgency_score_at_visit,
    homecare_days: s.homecare_days_at_schedule || homecareDaysString(config),
    sla_days: s.sla_days_at_visit || slaFor(config, priority || 'Medium'),
    ...displayFields(s),
  };
}

export function aliveAssignment(candidate, vehicleId, config) {
  return {
    patient_id: String(candidate.id),
    vehicle_id: String(vehicleId),
    slot_order: 1,
    priority: candidate.priority,
    type: candidate.type,
    visit_type: candidate.type === 'new' ? 'initial' : 'follow_up',
    gap: candidate.gap_days,
    urgency: candidate.urgency_score,
    homecare_days: homecareDaysString(config),
    sla_days: slaFor(config, candidate.priority),
    ...displayFields(candidate),
  };
}

export function bereavementAssignment(deceased, vehicleId, config) {
  return {
    patient_id: String(deceased.id),
    vehicle_id: String(vehicleId),
    slot_order: 1,
    priority: 'Medium',
    type: 'existing',
    visit_type: 'bereavement',
    gap: Number.isInteger(deceased.days_since_death) ? deceased.days_since_death : 0,
    urgency: 0.0,
    homecare_days: homecareDaysString(config),
    sla_days: 4,
    ...displayFields(deceased),
  };
}

/** Add display fields to assignments returned by the auto-draft endpoint. */
export function enrichAssignments(assignments, patientsById) {
  return assignments.map(a => {
    const p = patientsById.get(String(a.patient_id));
    return { ...a, patient_id: String(a.patient_id), vehicle_id: String(a.vehicle_id), ...(p ? displayFields(p) : {}) };
  });
}

/** Renumber stops per vehicle in list order. */
export function reindexByVehicle(slots) {
  const counters = {};
  return slots.map(s => {
    const vid = String(s.vehicle_id);
    counters[vid] = (counters[vid] || 0) + 1;
    return { ...s, slot_order: counters[vid] };
  });
}

/**
 * Replace one vehicle's alive stops (Alive view) or bereavement stops (Deceased view).
 * The untouched kind stays first in the run, as on the Streamlit board.
 */
export function replaceVehicleStops(draft, vehicleId, kind, newStops) {
  const vid = String(vehicleId);
  const others = draft.filter(s => String(s.vehicle_id) !== vid);
  const mine = draft.filter(s => String(s.vehicle_id) === vid);
  const kept = mine.filter(s => (kind === 'bereavement'
    ? s.visit_type !== 'bereavement'
    : s.visit_type === 'bereavement'));
  const run = [...kept, ...newStops].map((s, i) => ({ ...s, slot_order: i + 1 }));
  return [...others, ...run];
}

/**
 * Alive candidates for a vehicle: not on another vehicle today, in the vehicle's
 * zones (or already on it), and due (urgency > 0) unless already on it.
 */
export function aliveCandidatesForVehicle(allCandidates, vehicle, draft) {
  if (!vehicle) return [];
  const vid = String(vehicle.id);
  const vZones = (vehicle.zones || []).map(z => String(z).trim().toUpperCase());
  const assignedToOther = new Set();
  const assignedToThisAlive = new Set();
  for (const s of draft) {
    if (String(s.vehicle_id) === vid) {
      if (s.visit_type !== 'bereavement') assignedToThisAlive.add(String(s.patient_id));
    } else {
      assignedToOther.add(String(s.patient_id));
    }
  }
  return allCandidates.filter(p => {
    if (p.is_deceased) return false;
    const pid = String(p.id);
    if (assignedToOther.has(pid)) return false;
    const zoneCovered = vZones.includes(String(p.zone || '').trim().toUpperCase());
    if (!zoneCovered && !assignedToThisAlive.has(pid)) return false;
    if ((p.urgency_score || 0) === 0 && !assignedToThisAlive.has(pid)) return false;
    return true;
  });
}

/** Deceased patients for bereavement visits on a vehicle (already sorted by the API). */
export function deceasedCandidatesForVehicle(deceased, vehicle, draft) {
  if (!vehicle) return [];
  const vid = String(vehicle.id);
  const vZones = (vehicle.zones || []).map(z => String(z).trim().toUpperCase());
  const assignedToOther = new Set();
  const assignedToThisBereav = new Set();
  for (const s of draft) {
    if (String(s.vehicle_id) === vid) {
      if (s.visit_type === 'bereavement') assignedToThisBereav.add(String(s.patient_id));
    } else {
      assignedToOther.add(String(s.patient_id));
    }
  }
  return deceased.filter(p => {
    const pid = String(p.id);
    if (assignedToOther.has(pid)) return false;
    const zoneCovered = vZones.includes(String(p.zone || '').trim().toUpperCase());
    return zoneCovered || assignedToThisBereav.has(pid);
  });
}

/** True when the board's (patient, vehicle) pairs differ from what is saved. */
export function hasUnsavedChanges(draft, savedSlots) {
  if (!draft.length) return false;
  const key = s => `${s.patient_id}|${s.vehicle_id}`;
  const a = new Set(draft.map(key));
  const b = new Set(savedSlots.map(key));
  if (a.size !== b.size) return true;
  for (const k of a) if (!b.has(k)) return true;
  return false;
}

/** Patients marked deceased but booked for a normal (non-bereavement) visit. */
export function deceasedInDraft(savedSlots, draft, deceasedById) {
  const seen = new Set();
  const out = [];
  for (const s of savedSlots) {
    const pid = String(s.patient_id);
    if (s.is_deceased && s.visit_type !== 'bereavement' && !seen.has(pid)) {
      out.push({ id: pid, name: s.patient_name, uhid: s.uhid });
      seen.add(pid);
    }
  }
  for (const s of draft) {
    const pid = String(s.patient_id);
    if (seen.has(pid) || s.visit_type === 'bereavement') continue;
    const dead = s.is_deceased || deceasedById.has(pid);
    if (dead) {
      const info = deceasedById.get(pid) || {};
      out.push({ id: pid, name: s.patient_name || info.name, uhid: s.uhid || info.uhid });
      seen.add(pid);
    }
  }
  return out;
}

/** Operational homecare days elapsed after start up to and including end (YYYY-MM-DD strings). */
export function countHomecareDays(startStr, endStr, weekdays) {
  const active = new Set((weekdays || ['Monday', 'Tuesday', 'Thursday', 'Friday']).map(d => DAY_INDEX[d]));
  const start = new Date(`${startStr}T00:00:00`);
  const end = new Date(`${endStr}T00:00:00`);
  if (!(start < end)) return 0;
  let count = 0;
  const cur = new Date(start);
  cur.setDate(cur.getDate() + 1);
  while (cur <= end) {
    if (active.has(cur.getDay())) count += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const nums = [lat1, lon1, lat2, lon2].map(Number);
  if (nums.some(n => Number.isNaN(n))) return 0;
  const [a1, o1, a2, o2] = nums.map(n => (n * Math.PI) / 180);
  const dLat = a2 - a1;
  const dLon = o2 - o1;
  let h = Math.sin(dLat / 2) ** 2 + Math.cos(a1) * Math.cos(a2) * Math.sin(dLon / 2) ** 2;
  h = Math.min(1, Math.max(0, h));
  return 2 * 6371 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function formatRemaining(seconds, cappedByMidnight) {
  const mins = Math.floor(Math.max(0, seconds) / 60);
  const base = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${Math.max(1, mins)} min${mins !== 1 ? 's' : ''}`;
  return cappedByMidnight ? `${base} (Date Ends at Midnight)` : base;
}
