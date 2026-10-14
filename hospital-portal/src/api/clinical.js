/**
 * Hospital Portal — Clinical API
 *
 * Wraps the portal endpoints for the editable clinical tabs (Body Map +
 * Initial Assessment Baseline). Uses the shared portal axios client
 * (`../api/client`), which auto-attaches the Authorization header and the
 * X-Org-Id header, so callers here never deal with auth/tenancy directly.
 *
 * Backend (Agent A) endpoints:
 *   GET  /portal/patients/:id/baseline           → baseline bundle
 *   PUT  /portal/patients/:id/baseline/:form      → save one baseline form
 *   GET  /portal/patients/:id/body-map            → body map read
 *   PUT  /portal/patients/:id/body-map            → body map write
 *   GET  /portal/patients/:id/visits              → visit list (for initial visit id)
 *
 * NOTE: the axios client's baseURL already includes the leading `/api`, so the
 * paths below are relative to that (no `/api` prefix here).
 */
import apiClient from './client';

/** Valid `form` keys accepted by the baseline save endpoint. */
export const BASELINE_FORMS = Object.freeze([
  'nursing',
  'doctor',
  'esas',
  'pps',
  'physio',
  'psychological',
  'plan-of-care',
]);

const clinicalApi = {
  // ── Baseline bundle ──────────────────────────────────────────────────────
  /**
   * Fetch the full Initial Assessment (Baseline) bundle for a patient.
   * @returns {Promise<{
   *   visit_id?: number|string,
   *   nursing?: object, doctor?: object, esas?: object, pps?: object,
   *   physio?: object, psychological?: object, ['plan-of-care']?: object
   * }>}
   */
  getBaseline: async (patientId) => {
    const res = await apiClient.get(`/portal/patients/${patientId}/baseline`);
    return res.data;
  },

  /**
   * Save a single baseline form.
   * @param {string} form one of BASELINE_FORMS
   * @param {object} data form payload
   */
  saveBaselineForm: async (patientId, form, data) => {
    const res = await apiClient.put(`/portal/patients/${patientId}/baseline/${form}`, data);
    return res.data;
  },

  // ── Body map ─────────────────────────────────────────────────────────────
  /**
   * Read the patient's body map.
   * @returns {Promise<{ annotations?: array, body_locations?: array, summary_text?: string }>}
   */
  getBodyMap: async (patientId) => {
    const res = await apiClient.get(`/portal/patients/${patientId}/body-map`);
    return res.data;
  },

  /**
   * Persist the patient's body map.
   * @param {object} payload { annotations?, body_locations?, summary_text? }
   */
  saveBodyMap: async (patientId, payload) => {
    const res = await apiClient.put(`/portal/patients/${patientId}/body-map`, payload);
    return res.data;
  },

  // ── Visits (optional helper) ──────────────────────────────────────────────
  listVisits: async (patientId) => {
    const res = await apiClient.get(`/portal/patients/${patientId}/visits`);
    return res.data;
  },
};

export default clinicalApi;
