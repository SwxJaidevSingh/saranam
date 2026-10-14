/**
 * Portal patient API — all tenant-scoped via the X-Org-Id header (client.js).
 *
 *   GET  /portal/patients?q=&page=&per_page=&sort_by=&sort_order=
 *        -> { patients, total, page, per_page, total_pages }
 *   GET  /portal/patients/:id              -> patient object
 *   POST /portal/patients                  -> { patient }
 *        body: demographic fields + { origin: { origin_type, ... } }
 *   PUT  /portal/patients/:id              -> patient object (demographics [+ origin])
 *   PUT  /portal/patients/:id/origin       -> patient object (origin only)
 *   GET  /portal/patients/:id/ai-summary   -> { summary_blocks|summary_text, ... }
 *        (org-scoped AI patient summary; may not be enabled on every backend)
 */
import apiClient from './client'

export const patientsApi = {
  list: async ({ q = '', page = 1, perPage = 20, sortBy = 'created_at', sortOrder = 'desc' } = {}) => {
    const response = await apiClient.get('/portal/patients', {
      params: { q, page, per_page: perPage, sort_by: sortBy, sort_order: sortOrder },
    })
    return response.data
  },

  get: async (id) => {
    const response = await apiClient.get(`/portal/patients/${id}`)
    return response.data
  },

  // payload: demographic fields + an `origin` object (origin_type required).
  create: async (payload) => {
    const response = await apiClient.post('/portal/patients', payload)
    return response.data
  },

  // payload: demographic fields, optionally with a nested `origin` object.
  update: async (id, payload) => {
    const response = await apiClient.put(`/portal/patients/${id}`, payload)
    return response.data
  },

  // origin: { origin_type, source_code, organization_id, source_name, referral_date, notes }
  updateOrigin: async (id, origin) => {
    const response = await apiClient.put(`/portal/patients/${id}/origin`, origin)
    return response.data
  },

  // Org-scoped AI patient summary. Returns null when the backend hasn't enabled
  // the endpoint yet (404) so the AI Summary tab can degrade gracefully rather
  // than error the whole page.
  aiSummary: async (id) => {
    try {
      const response = await apiClient.get(`/portal/patients/${id}/ai-summary`)
      return response.data
    } catch (err) {
      if (err.response?.status === 404) return null
      throw err
    }
  },
}

export default patientsApi
