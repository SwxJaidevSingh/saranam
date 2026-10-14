/**
 * Data layer for the portal's "Register New Patient" modal.
 *
 * COPIED + repointed from the main app's patient intake (frontend/src/api/patients.js
 * + frontend/src/context/PatientContext.jsx), adapted to the portal client
 * (../../api/client) which auto-attaches Authorization + X-Org-Id.
 *
 * Two classes of endpoint are used:
 *
 *  1. GLOBAL config / helper endpoints (NOT org-scoped, plain @jwt_required on the
 *     backend) — reused as-is from the main app so the modal behaves identically:
 *       GET/POST  /patients/config/diagnosis-options
 *       GET/POST  /patients/config/referral-partners
 *       GET/POST  /patients/config/hospital-options
 *       POST      /patients/zones/detect
 *       POST      /patients/duplicate-check
 *     The X-Org-Id header is harmless here (these routes ignore it).
 *
 *  2. The org-scoped CREATE — POST /portal/patients. The owning org is forced
 *     server-side from X-Org-Id, so `organization_id` is NEVER sent. A required
 *     structured `origin` object is included (the portal endpoint validates it).
 */
import apiClient from '../../api/client'

export const addPatientApi = {
  // ── Global config: diagnosis options ──
  getDiagnosisOptions: async () => {
    const res = await apiClient.get('/patients/config/diagnosis-options')
    return res.data
  },
  addDiagnosisOption: async (option) => {
    const res = await apiClient.post('/patients/config/diagnosis-options', { option })
    return res.data
  },

  // ── Global config: referral partners ──
  getReferralPartners: async () => {
    const res = await apiClient.get('/patients/config/referral-partners')
    return res.data
  },
  addReferralPartner: async (option) => {
    const res = await apiClient.post('/patients/config/referral-partners', { option })
    return res.data
  },

  // ── Global config: hospital master list ──
  // Each entry: { code, name, homecare_prefix, is_default, is_active, lat?, lng? }
  getHospitalOptions: async ({ includeInactive = false } = {}) => {
    const res = await apiClient.get('/patients/config/hospital-options', {
      params: includeInactive ? { include_inactive: 1 } : {},
    })
    return res.data
  },
  addHospitalOption: async ({ code, name, homecare_prefix, lat, lng }) => {
    const res = await apiClient.post('/patients/config/hospital-options', {
      code, name, homecare_prefix, lat, lng,
    })
    return res.data
  },

  // ── Zone detection (lat/long point-in-polygon against GBA boundaries) ──
  detectZone: async (lat, lng) => {
    const res = await apiClient.post('/patients/zones/detect', { lat, lng })
    return res.data.zone
  },

  checkDuplicate: async (checkParams) => {
    const res = await apiClient.post('/patients/duplicate-check', checkParams)
    return res.data
  },

  // ── Org-scoped create (org forced server-side from X-Org-Id) ──
  // payload: demographic fields + required nested `origin` object.
  createPatient: async (payload) => {
    const res = await apiClient.post('/portal/patients', payload)
    return res.data
  },
}

export default addPatientApi
