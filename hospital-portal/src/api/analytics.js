/**
 * Portal analytics API — all tenant-scoped via the X-Org-Id header (client.js).
 * A platform admin in god view (no X-Org-Id) gets cross-org aggregates; an org
 * user gets only their org's numbers. `byOrg` is platform-admin-only (403
 * otherwise) and is the only cross-org endpoint.
 *
 *   GET /portal/analytics/summary
 *       -> { total_patients, active, inactive, deceased, new_this_week, new_this_month }
 *   GET /portal/analytics/intake-trend?period=day|week|month&periods=N
 *       -> { period, series: [{ bucket: 'YYYY-MM-DD', count }] }
 *   GET /portal/analytics/origin-breakdown
 *       -> { breakdown: [{ origin_type, count }], total }
 *   GET /portal/analytics/top-sources?limit=N
 *       -> { sources: [{ source, count }] }
 *   GET /portal/analytics/demographics
 *       -> { age_bands: [{ band, count }], gender: [{ gender, count }] }
 *   GET /portal/analytics/geography
 *       -> { clusters: [{ cluster, count }] }
 *   GET /portal/analytics/by-org   (platform admin only)
 *       -> { organizations: [{ organization_id, code, name, count }] }
 */
import apiClient from './client'

export const analyticsApi = {
  summary: async () => {
    const response = await apiClient.get('/portal/analytics/summary')
    return response.data
  },

  intakeTrend: async ({ period = 'month', periods } = {}) => {
    const params = { period }
    if (periods != null) params.periods = periods
    const response = await apiClient.get('/portal/analytics/intake-trend', { params })
    return response.data
  },

  originBreakdown: async () => {
    const response = await apiClient.get('/portal/analytics/origin-breakdown')
    return response.data
  },

  topSources: async ({ limit = 10 } = {}) => {
    const response = await apiClient.get('/portal/analytics/top-sources', {
      params: { limit },
    })
    return response.data
  },

  demographics: async () => {
    const response = await apiClient.get('/portal/analytics/demographics')
    return response.data
  },

  geography: async () => {
    const response = await apiClient.get('/portal/analytics/geography')
    return response.data
  },

  // Platform-admin only — returns 403 for org users.
  byOrg: async () => {
    const response = await apiClient.get('/portal/analytics/by-org')
    return response.data
  },

  deaths: async ({ windowDays = 30 } = {}) => {
    const response = await apiClient.get('/portal/analytics/deaths', {
      params: { window_days: windowDays },
    })
    return response.data
  },

  getPatientLocations: async () => {
    const response = await apiClient.get('/portal/analytics/patient-locations')
    return response.data
  },

  vitalsSummary: async () => {
    const response = await apiClient.get('/portal/analytics/vitals/summary')
    return response.data
  },

  vitalsDistribution: async () => {
    const response = await apiClient.get('/portal/analytics/vitals/distribution')
    return response.data
  },

  getPatientVitalsLocations: async () => {
    const response = await apiClient.get('/portal/analytics/vitals/locations')
    return response.data
  },

  diseasesDiagnoses: async () => {
    const response = await apiClient.get('/portal/analytics/diseases/diagnoses')
    return response.data
  },

  diseasesComplaints: async () => {
    const response = await apiClient.get('/portal/analytics/diseases/complaints')
    return response.data
  },
}

export default analyticsApi
