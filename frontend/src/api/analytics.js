/**
 * Analytics API endpoints
 */
import apiClient from './client';

export const analyticsApi = {
  /**
   * Get dashboard statistics
   * @returns {Promise} Response with dashboard data
   */
  getDashboard: async (params = {}) => {
    const response = await apiClient.get('/analytics/dashboard', { params });
    return response.data;
  },

  /**
   * Get form analytics
   * @param {string} formId - Form ID
   * @param {Object} params - Query parameters (date_from, date_to)
   * @returns {Promise} Response with form analytics
   */
  getFormAnalytics: async (formId, params = {}) => {
    const url = formId ? `/analytics/forms/${formId}` : '/analytics/forms';
    const response = await apiClient.get(url, { params });
    return response.data;
  },

  /**
   * Get user activity report
   * @param {Object} params - Query parameters (user_id, days)
   * @returns {Promise} Response with user activity data
   */
  getUserActivity: async (params = {}) => {
    const response = await apiClient.get('/analytics/reports/user-activity', { params });
    return response.data;
  },

  /**
   * Get form comparison report
   * @returns {Promise} Response with form comparison data
   */
  getFormComparison: async () => {
    const response = await apiClient.get('/analytics/reports/form-comparison');
    return response.data;
  },

  /**
   * Execute custom query
   * @param {string} queryType - Type of query
   * @param {Object} params - Query parameters
   * @returns {Promise} Response with query results
   */
  customQuery: async (queryType, params = {}) => {
    const response = await apiClient.post('/analytics/custom', { query_type: queryType, params });
    return response.data;
  },

  /**
   * Export analytics data
   * @param {string} type - Export type (dashboard, form_comparison)
   * @returns {Promise} Response with exported data
   */
  export: async (type = 'dashboard') => {
    const response = await apiClient.get('/analytics/export', { params: { type } });
    return response.data;
  },

  // === Advanced Form Analytics Endpoints ===

  getAdvancedFormOverview: async (formId) => {
    const response = await apiClient.get(`/analytics/forms/advanced/${formId}/overview`);
    return response.data?.data || response.data;
  },

  getAdvancedFieldDistribution: async (formId, fieldId, fieldType) => {
    const response = await apiClient.get(`/analytics/forms/advanced/${formId}/fields/${fieldId}/distribution`, {
      params: { field_type: fieldType }
    });
    return response.data?.data || response.data;
  },

  getAdvancedDropoffFunnel: async (formId) => {
    const response = await apiClient.get(`/analytics/forms/advanced/${formId}/funnel`);
    return response.data?.data || response.data;
  },

  getAdvancedUsageHeatmap: async (formId) => {
    const response = await apiClient.get(`/analytics/forms/advanced/${formId}/heatmap`);
    return response.data?.data || response.data;
  },

  // === Vitals Analytics Endpoints ===

  getVitalsSummary: async (params = {}) => {
    const response = await apiClient.get('/analytics/vitals/summary', { params });
    return response.data?.data || response.data;
  },

  getVitalsDistribution: async (params = {}) => {
    const response = await apiClient.get('/analytics/vitals/distribution', { params });
    return response.data?.data || response.data;
  },

  getVitalsCorrelation: async (scoreType = 'esas', params = {}) => {
    const response = await apiClient.get('/analytics/vitals/correlation', {
      params: { score_type: scoreType, ...params },
    });
    return response.data?.data || response.data;
  },

  getVitalsTopMovers: async (direction = 'improved', limit = 10) => {
    const response = await apiClient.get('/analytics/vitals/top-movers', {
      params: { direction, limit },
    });
    return response.data?.data || response.data;
  },

  // === Deaths / Palliative Outcomes (added per 2026-04-07 client meeting) ===

  getDeathsImpact: async (windowDays = 30, params = {}) => {
    const response = await apiClient.get('/analytics/deaths/impact', {
      params: { window_days: windowDays, ...params },
    });
    return response.data;
  },

  /**
   * Get all patient locations with risk levels
   * @returns {Promise} Response with patient locations
   */
  getPatientLocations: async (params = {}) => {
    const response = await apiClient.get('/analytics/geo/patient-locations', { params });
    return response.data;
  },

  getGeoDistribution: async (params = {}) => {
    const response = await apiClient.get('/analytics/geo/distribution', { params });
    return response.data;
  },

  getHospitalOptions: async () => {
    const response = await apiClient.get('/patients/config/hospital-options');
    return response.data;
  },

  /**
   * Get all referral hospitals
   * @returns {Promise} Response with hospital locations
   */
  getHospitals: async () => {
    const response = await apiClient.get('/analytics/geo/hospitals');
    return response.data;
  },

  /**
   * Get latest vitals and coordinates for all active patients
   * @returns {Promise} Response with patient vitals locations
   */
  getPatientVitalsLocations: async (params = {}) => {
    const response = await apiClient.get('/analytics/geo/patient-vitals', { params });
    return response.data;
  },

  /**
   * Get patient diagnoses and coordinates
   * @returns {Promise} Response with patient diagnoses data and stats
   */
  getPatientDiagnoses: async (params = {}) => {
    const response = await apiClient.get('/analytics/geo/patient-diagnoses', { params });
    return response.data;
  },
  /**
   * Get patient complexities and coordinates
   * @returns {Promise} Response with patient complexity data and stats
   */
  getPatientComplexity: async (params = {}) => {
    const response = await apiClient.get('/analytics/geo/patient-complexity', { params });
    return response.data;
  },

  /**
   * Get patient BSC and coordinates
   * @returns {Promise} Response with patient BSC data and stats
   */
  getPatientBSC: async (params = {}) => {
    const response = await apiClient.get('/analytics/geo/patient-bsc', { params });
    return response.data;
  },

  /**
 * Get monthly distribution of Initial vs Follow-up visits
 * @returns {Promise} Response with visit type distribution
 */
  getVisitTypeByMonth: async (params = {}) => {
    const response = await apiClient.get('/analytics/visits/type-by-month', { params });
    return response.data;
  },

  /**
   * Get monthly home visits
   */
  getHomeVisitsByMonth: async (params = {}) => {
    const response = await apiClient.get('/analytics/visits/home-by-month', { params });
    return response.data;
  },

  getAverageVisitsByMonth: async (params = {}) => {
    const response = await apiClient.get(
      "/analytics/visits/average-by-month",
      { params }
    );
    return response.data;
  },

  getVisitFrequencyDistribution: async (params = {}) => {
    const response = await apiClient.get(
      "/analytics/visits/frequency-distribution",
      { params }
    );
    return response.data;
  },

  getAverageTimeToFirstVisit: async (params = {}) => {
    const response = await apiClient.get(
      "/analytics/patients/time-to-first-visit",
      { params }
    );
    return response.data;
  },

  /**
   * Get patient chief complaints and coordinates
   * @returns {Promise} Response with patient chief complaints data and stats
   */
  getPatientComplaints: async (params = {}) => {
    const response = await apiClient.get('/analytics/geo/patient-complaints', { params });
    return response.data;
  },

  // === Donor Stewardship Analytics Endpoints ===
  getDonorOverview: async (params = {}) => {
    const response = await apiClient.get('/analytics/donor/overview', { params });
    return response.data;
  },
  getDonorVisitsTimeline: async (params = {}) => {
    const response = await apiClient.get('/analytics/donor/visits-timeline', { params });
    return response.data;
  },
  getDonorDeathsTimeline: async (params = {}) => {
    const response = await apiClient.get('/analytics/donor/deaths-timeline', { params });
    return response.data;
  },
  getDonorConsultationsMix: async (params = {}) => {
    const response = await apiClient.get('/analytics/donor/consultations-mix', { params });
    return response.data;
  },
  getDonorDistanceTimeline: async (params = {}) => {
    const response = await apiClient.get('/analytics/donor/distance-timeline', { params });
    return response.data;
  },
  getDonorPainLadder: async (params = {}) => {
    const response = await apiClient.get('/analytics/pain-ladder', { params });
    return response.data;
  },
  getDonorTelemedicineTimeline: async (params = {}) => {
    const response = await apiClient.get('/analytics/donor/telemedicine-timeline', { params });
    return response.data;
  },
  getTelemedicineSummary: async (params = {}) => {
    const response = await apiClient.get('/analytics/telemedicine/summary', { params });
    return response.data;
  },
  getDonorMultidisciplinary: async (params = {}) => {
    const response = await apiClient.get('/analytics/donor/multidisciplinary', { params });
    return response.data;
  },
  getDonorFollowups: async (params = {}) => {
    const response = await apiClient.get('/analytics/donor/followups', { params });
    return response.data;
  },
  getDonorPlaceOfDeathByZone: async (params = {}) => {
    const response = await apiClient.get('/analytics/donor/place-of-death-by-zone', { params });
    return response.data;
  },
  getDonorLossToFollowup: async (params = {}) => {
    const response = await apiClient.get('/analytics/donor/loss-to-followup', { params });
    return response.data;
  },
  getDonorVehicleUtilization: async (params = {}) => {
    const response = await apiClient.get('/analytics/donor/vehicle-utilization', { params });
    return response.data;
  },
  getDonorEnrollmentToDeath: async (params = {}) => {
    const response = await apiClient.get('/analytics/donor/enrollment-to-death', { params });
    return response.data;
  },
  getDonorRegistrationToFirstVisit: async (params = {}) => {
    const response = await apiClient.get('/analytics/donor/registration-to-first-visit', { params });
    return response.data;
  },
  getBeneficiaryStats: async (params = {}) => {
    const response = await apiClient.get('/analytics/patients/beneficiaries', { params });
    return response.data;
  },
  getRegistrationTrends: async (params = {}) => {
    const response = await apiClient.get('/analytics/trends/registration', { params });
    return response.data;
  },

  // Aliases for easier use
  getDashboardStats: async function () { return this.getDashboard(); },
};

export default analyticsApi;