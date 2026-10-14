/**
 * Normalize portal API errors into a user-facing message + per-field details.
 *
 * The backend returns validation errors as:
 *   { error: 'validation_failed', message, details: [{ field, message, type }] }
 * and other errors as { message } / { error }. 409 = duplicate.
 */

export function parseApiError(err, fallback = 'Something went wrong') {
  const res = err?.response
  const data = res?.data || {}

  // Field-level validation details (map form field -> message).
  let fieldErrors = null
  if (Array.isArray(data.details)) {
    fieldErrors = {}
    for (const d of data.details) {
      if (d.field) fieldErrors[d.field] = d.message || 'Invalid value'
    }
  }

  let message = data.message || data.error || fallback
  if (res?.status === 403 && (data.error === 'no_org_access' || !data.message)) {
    message = 'You do not have access to this organization.'
  }
  if (res?.status === 409) {
    message = data.message || 'A matching patient already exists.'
  }

  return { message, fieldErrors, status: res?.status }
}

// Map a backend origin field name back to the flat form field name.
const ORIGIN_FIELD_MAP = {
  origin_type: 'origin_type',
  source_code: 'origin_source_code',
  organization_id: 'origin_organization_id',
  source_name: 'origin_source_name',
  referral_date: 'origin_referral_date',
  notes: 'origin_notes',
}

export function toFormFieldName(backendField) {
  return ORIGIN_FIELD_MAP[backendField] || backendField
}
