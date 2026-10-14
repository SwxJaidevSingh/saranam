/**
 * Small display helpers. The portal API returns the shared patient response
 * (PatientService._prepare_patient_response): `contact` is a decrypted blob
 * (may be JSON or "Phone: …; Email: …"), `city` comes from external_metadata.
 */

export function formatDate(value, opts = { year: 'numeric', month: 'short', day: 'numeric' }) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, opts)
}

export function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Best-effort phone extraction from the decrypted `contact` blob.
export function extractPhone(contact) {
  if (!contact) return null
  if (typeof contact === 'object') return contact.phone || null
  try {
    const parsed = JSON.parse(contact)
    if (parsed && typeof parsed === 'object') return parsed.phone || null
  } catch {
    // not JSON
  }
  const m = /(?:phone|mobile|ph)[:\s]*([+\d\s\-]+)/i.exec(contact)
  if (m) return m[1].trim()
  const digits = contact.replace(/[^\d+]/g, '')
  if (digits.length >= 10 && !contact.includes('@')) return digits
  return null
}

export const dash = (v) => (v === null || v === undefined || v === '' ? '—' : v)
