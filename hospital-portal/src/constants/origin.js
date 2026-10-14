/**
 * Structured referral origin — mirrors backend ORIGIN_TYPES
 * (backend/app/portal/schemas.py). `origin_type` is REQUIRED at intake.
 *
 * When origin_type === 'hospital': capture origin_source_code (referring
 * hospital catalog code) + optional origin_organization_id (referrer tenant).
 * Otherwise: capture origin_source_name (free text — doctor / camp / NGO / ...).
 */
export const ORIGIN_TYPES = [
  { value: 'hospital', label: 'Hospital' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'camp', label: 'Camp' },
  { value: 'self', label: 'Self' },
  { value: 'ngo', label: 'NGO' },
  { value: 'govt_scheme', label: 'Government Scheme' },
  { value: 'online', label: 'Online' },
  { value: 'other', label: 'Other' },
]

export const ORIGIN_TYPE_LABELS = ORIGIN_TYPES.reduce((acc, t) => {
  acc[t.value] = t.label
  return acc
}, {})

export const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say']

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
