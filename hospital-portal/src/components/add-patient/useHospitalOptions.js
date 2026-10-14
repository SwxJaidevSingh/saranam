/**
 * Fetch the DB-backed hospital master list and expose an `add()` that POSTs a
 * new hospital. COPIED from frontend/src/hooks/useHospitalOptions.js, repointed
 * to the portal-local addPatientApi (which uses the portal client).
 *
 * Shape of `options`: array of
 *   { code, name, homecare_prefix, is_default, is_active, lat?, lng? }.
 * Only `is_active: true` entries are returned (soft-deleted ones hidden).
 */
import { useCallback, useEffect, useState } from 'react'
import addPatientApi from './addPatientApi'

export default function useHospitalOptions() {
  const [options, setOptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await addPatientApi.getHospitalOptions()
      setOptions(res.options || [])
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Failed to load hospitals')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const add = useCallback(async (payload) => {
    const res = await addPatientApi.addHospitalOption(payload)
    // Server returns the full list after insert — trust it over optimistic append.
    if (res.options) setOptions(res.options)
    return res.added || null
  }, [])

  return { options, loading, error, add, refresh }
}
