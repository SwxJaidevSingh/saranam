/**
 * Resolve the locked "Patient origin hospital" for the Add-Patient modal.
 *
 * The field formerly labeled "Linked Hospital" in the main app is, in the
 * portal, AUTO-SELECTED from the logged-in user's active organization and shown
 * read-only (no dropdown, no edit). We read it from GET /api/portal/orgs/me:
 *
 *   - primary:  active_org.linked_hospital_code  (the org's intake default)
 *   - fallback: active_org.code / active_org.name (when linked_hospital_code is null)
 *
 * The value sent to the API as `linked_hospital` MUST be a code in the live
 * hospital catalog (the backend PatientCreateSchema validates it against
 * get_valid_hospital_codes()). So:
 *   - `code`        — the resolved org hospital code (for display + payload candidate)
 *   - `label`       — human label to show in the locked field
 *   - `isValidCode(catalog)` — true only when `code` exists in the loaded catalog
 *
 * Callers send `linked_hospital: code` only when isValidCode() is true; otherwise
 * the field is display-only and `linked_hospital` is omitted from the payload so
 * a non-catalog org code can never trip the server-side validator.
 */
import { useEffect, useState } from 'react'
import { orgsApi } from '../../api/orgs'

export default function useOriginHospital(open) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // { code, name, label } | null
  const [hospital, setHospital] = useState(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)

    orgsApi
      .getMine()
      .then((data) => {
        if (cancelled) return
        const org = data.active_org || null
        if (!org) {
          setHospital(null)
          return
        }
        // Primary: the org's configured linked_hospital_code. Fallbacks: the
        // org's own code / name (display only).
        const code = org.linked_hospital_code || org.code || null
        const name = org.display_name || org.name || null
        const label = name ? (code ? `${name} (${code})` : name) : code || '—'
        setHospital({ code, name, label })
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.message || 'Failed to load organization')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open])

  return { loading, error, hospital }
}
