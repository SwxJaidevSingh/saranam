/**
 * Map flat react-hook-form values to the portal API payload shapes.
 *
 * The form keeps origin fields flat (origin_type, origin_source_code, …) for
 * convenient registration; the API expects them nested under `origin` with the
 * schema's own key names (source_code, organization_id, source_name,
 * referral_date, notes). See backend/app/portal/schemas.py PatientOriginSchema.
 *
 * Empty strings are stripped so optional fields are sent as omitted rather than
 * "" (which can trip max_length / format validators on the backend).
 */

const DEMOGRAPHIC_FIELDS = [
  'full_name',
  'date_of_birth',
  'gender',
  'phone_number',
  'email',
  'address_line1',
  'address_line2',
  'city',
  'state',
  'postal_code',
  'country',
  'hospital_uhid',
  'diagnosis',
  'emergency_contact_name',
  'emergency_contact_phone',
  'blood_group',
  'preferred_language',
  'notes',
]

function clean(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
  }
  return value
}

export function buildDemographics(values) {
  const out = {}
  for (const key of DEMOGRAPHIC_FIELDS) {
    const v = clean(values[key])
    if (v !== undefined) out[key] = v
  }
  return out
}

export function buildOrigin(values) {
  const origin = {
    origin_type: clean(values.origin_type),
    source_code: clean(values.origin_source_code),
    organization_id: clean(values.origin_organization_id),
    source_name: clean(values.origin_source_name),
    referral_date: clean(values.origin_referral_date),
    notes: clean(values.origin_notes),
  }
  // Drop undefined keys.
  Object.keys(origin).forEach((k) => origin[k] === undefined && delete origin[k])
  return origin
}

// Full create payload: demographics + nested origin (origin_type required).
export function buildCreatePayload(values) {
  return { ...buildDemographics(values), origin: buildOrigin(values) }
}

// Update payload: demographics + nested origin (origin sent so origin edits in
// the same form persist).
export function buildUpdatePayload(values) {
  return { ...buildDemographics(values), origin: buildOrigin(values) }
}

// Flatten an API patient object back into the flat form value shape (for edit).
export function patientToFormValues(p) {
  if (!p) return {}
  return {
    full_name: p.full_name || '',
    date_of_birth: p.date_of_birth || '',
    gender: p.gender || '',
    phone_number: p.contact ? extractContactPhone(p.contact) : '',
    email: p.contact ? extractContactEmail(p.contact) : '',
    address_line1: p.address_line1 || '',
    address_line2: p.address_line2 || '',
    city: p.city || '',
    state: p.state || '',
    postal_code: p.postal_code || '',
    country: p.country || 'India',
    hospital_uhid: p.hospital_uhid || '',
    diagnosis: p.diagnosis || '',
    emergency_contact_name: p.emergency_contact_name || '',
    emergency_contact_phone: p.emergency_contact_phone || '',
    blood_group: p.blood_group || '',
    preferred_language: p.preferred_language || '',
    notes: p.notes || '',
    // Origin (flat).
    origin_type: p.origin_type || '',
    origin_source_code: p.origin_source_code || '',
    origin_organization_id: p.origin_organization_id || '',
    origin_source_name: p.origin_source_name || '',
    origin_referral_date: p.origin_referral_date || '',
    origin_notes: p.origin_notes || '',
  }
}

function extractContactPhone(contact) {
  try {
    const parsed = JSON.parse(contact)
    if (parsed && typeof parsed === 'object') return parsed.phone || ''
  } catch {
    // not JSON
  }
  return ''
}

function extractContactEmail(contact) {
  try {
    const parsed = JSON.parse(contact)
    if (parsed && typeof parsed === 'object') return parsed.email || ''
  } catch {
    // not JSON
  }
  return ''
}
