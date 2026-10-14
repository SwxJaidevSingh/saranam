import { useCallback, useEffect, useState } from 'react';
import patientsApi from '../api/patients';

/**
 * Fetch the DB-backed hospital master list and expose an `add()` that POSTs
 * a new hospital. Consumed by the three forms that let users pick a hospital
 * (PatientQuickAdd, PatientEdit, ScheduleSettingsPage).
 *
 * Shape of `options`: array of `{ code, name, homecare_prefix, is_default, is_active, lat?, lng? }`.
 * Only `is_active: true` entries are returned (soft-deleted ones hidden).
 */
export default function useHospitalOptions() {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await patientsApi.getHospitalOptions();
      setOptions(res.options || []);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Failed to load hospitals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const add = useCallback(async (payload) => {
    const res = await patientsApi.addHospitalOption(payload);
    // Server returns the full list after insert — trust it over optimistic append.
    if (res.options) setOptions(res.options);
    return res.added || null;
  }, []);

  return { options, loading, error, add, refresh };
}
