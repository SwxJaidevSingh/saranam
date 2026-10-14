/**
 * Dedicated API client for PPT Charts
 * Completely independent of the legacy analytics module.
 */
import apiClient from './client';

export const pptChartsApi = {
  /**
   * Get overview statistics (e.g. total registered patients count)
   * @param {Object} params - Optional filters (status, complexity, start_date, end_date)
   */
  getOverviewStats: async (params = {}) => {
    const response = await apiClient.get('/ppt-charts/overview-stats', { params });
    return response.data;
  },

  /**
   * Get monthly registration trends with optional filters
   * @param {Object} params - Optional filters (status, complexity, start_date, end_date)
   */
  getMonthlyRegistrations: async (params = {}) => {
    const response = await apiClient.get('/ppt-charts/monthly-registrations', { params });
    return response.data;
  },

  /**
   * Get age category distribution of cases
   * @param {Object} params - Optional filters (status, complexity, start_date, end_date)
   */
  getAgeCategory: async (params = {}) => {
    const response = await apiClient.get('/ppt-charts/age-category', { params });
    return response.data;
  },

  /**
   * Get gender profile distribution of cases
   * @param {Object} params - Optional filters (status, complexity, start_date, end_date)
   */
  getGenderProfile: async (params = {}) => {
    const response = await apiClient.get('/ppt-charts/gender-profile', { params });
    return response.data;
  },

  /**
   * Get zone-wise categorization of registered patients
   * @param {Object} params - Optional filters (status, complexity, start_date, end_date)
   */
  getZoneCategorization: async (params = {}) => {
    const response = await apiClient.get('/ppt-charts/zone-categorization', { params });
    return response.data;
  },

  /**
   * Get distance distribution of registered patients from Kidwai Hospital
   * @param {Object} params - Optional filters (status, complexity, start_date, end_date)
   */
  getDistanceDistribution: async (params = {}) => {
    const response = await apiClient.get('/ppt-charts/distance-distribution', { params });
    return response.data;
  },

  /**
   * Get zone-wise categorization of patients seen
   * @param {Object} params - Optional filters (status, complexity, start_date, end_date)
   */
  getZoneSeenCategorization: async (params = {}) => {
    const response = await apiClient.get('/ppt-charts/zone-seen', { params });
    return response.data;
  },

  /**
   * Get distance distribution of patients seen from Kidwai Hospital
   * @param {Object} params - Optional filters (status, complexity, start_date, end_date)
   */
  getDistanceSeenDistribution: async (params = {}) => {
    const response = await apiClient.get('/ppt-charts/distance-seen', { params });
    return response.data;
  },

  /**
   * Get categorization by number of visits (for alive and deceased patients)
   * @param {Object} params - Optional filters (status, complexity, start_date, end_date)
   */
  getVisitsCategorization: async (params = {}) => {
    const response = await apiClient.get('/ppt-charts/visits-categorization', { params });
    return response.data;
  },

  /**
   * Get type of home-visit analysis (First, Follow-up, Bereavement) grouped by month
   * @param {Object} params - Optional filters (status, complexity, start_date, end_date)
   */
  getVisitTypeAnalysis: async (params = {}) => {
    const response = await apiClient.get('/ppt-charts/visit-type-analysis', { params });
    return response.data;
  },

  /**
   * Get responsiveness analysis (average calendar days from registration to first contact)
   * @param {Object} params - Optional filters (status, complexity, start_date, end_date)
   */
  getResponsivenessAnalysis: async (params = {}) => {
    const response = await apiClient.get('/ppt-charts/responsiveness-analysis', { params });
    return response.data;
  },

  /**
   * Get homecare decline percentage trend
   * @param {Object} params - Optional filters (status, complexity, start_date, end_date)
   */
  getHomecareDecline: async (params = {}) => {
    const response = await apiClient.get('/ppt-charts/homecare-decline', { params });
    return response.data;
  },

  /**
   * Get incoming vs outgoing phone call consultations distribution
   * @param {Object} params - Optional filters (status, complexity, start_date, end_date)
   */
  getPhoneCallDistribution: async (params = {}) => {
    const response = await apiClient.get('/ppt-charts/phone-call-distribution', { params });
    return response.data;
  },

  /**
   * Get monthly volume trend of phone call consultations
   * @param {Object} params - Optional filters (status, complexity, start_date, end_date)
   */
  getPhoneCallTrend: async (params = {}) => {
    const response = await apiClient.get('/ppt-charts/phone-call-trend', { params });
    return response.data;
  },

  /**
   * Get breakup of consultations into Home care vs Phone call consultations
   * @param {Object} params - Optional filters (status, complexity, start_date, end_date)
   */
  getConsultationBreakup: async (params = {}) => {
    const response = await apiClient.get('/ppt-charts/consultation-breakup', { params });
    return response.data;
  },

  /**
   * Get monthwise trend of consultations (Home care, Phone care, Total)
   * @param {Object} params - Optional filters (status, complexity, start_date, end_date)
   */
  getConsultationMonthlyTrend: async (params = {}) => {
    const response = await apiClient.get('/ppt-charts/consultation-monthly-trend', { params });
    return response.data;
  },

  /**
   * Get split of consultations across provider roles (Physiotherapist, Counsellor, Nurse, Doctor)
   * @param {Object} params - Optional filters (status, complexity, start_date, end_date)
   */
  getConsultationSplit: async (params = {}) => {
    const response = await apiClient.get('/ppt-charts/consultation-split', { params });
    return response.data;
  },

  /**
   * Get monthwise trend of at-home clinical procedures (Nurse, Counsellor, Physio, Doctor)
   * @param {Object} params - Optional filters (status, complexity, start_date, end_date)
   */
  getClinicalProceduresTrend: async (params = {}) => {
    const response = await apiClient.get('/ppt-charts/clinical-procedures-trend', { params });
    return response.data;
  },

  /**
   * Get Palliative Performance Scale (PPS) analysis distribution (High, Medium, Low)
   * @param {Object} params - Optional filters (status, complexity, start_date, end_date)
   */
  getPpsAnalysis: async (params = {}) => {
    const response = await apiClient.get('/ppt-charts/pps-analysis', { params });
    return response.data;
  },

  /**
   * Get Patient Category distribution (BSC Onco, N-BSC Onco, N-BSC Non Onco)
   * @param {Object} params - Optional filters (status, complexity, start_date, end_date)
   */
  getPatientCategory: async (params = {}) => {
    const response = await apiClient.get('/ppt-charts/patient-category', { params });
    return response.data;
  },

  /**
   * Get Cancer Category bifurcation based on diagnosis field
   * @param {Object} params - Optional filters (status, complexity, start_date, end_date)
   */
  getCancerCategory: async (params = {}) => {
    const response = await apiClient.get('/ppt-charts/cancer-category', { params });
    return response.data;
  },

  /**
   * Get Place of Death distribution for deceased patients (Home, Hospital, On The Way, Others)
   * @param {Object} params - Optional filters (complexity, start_date, end_date)
   */
  getPlaceOfDeath: async (params = {}) => {
    const response = await apiClient.get('/ppt-charts/place-of-death', { params });
    return response.data;
  },

  /**
   * Get monthwise trend of deaths (Month Wise Deaths line chart)
   * @param {Object} params - Optional filters (complexity, start_date, end_date)
   */
  getMonthlyDeaths: async (params = {}) => {
    const response = await apiClient.get('/ppt-charts/monthly-deaths', { params });
    return response.data;
  },

  /**
   * Get monthwise trend of distance travelled per vehicle from vehicle_logs table
   * @param {Object} params - Optional filters (start_date, end_date)
   */
  getVehicleDistance: async (params = {}) => {
    const response = await apiClient.get('/ppt-charts/vehicle-distance', { params });
    return response.data;
  },

  /**
   * Get monthwise trend of homecare visits (visit_type != 'teleconsult') from patient_visits table
   * @param {Object} params - Optional filters (status, complexity, start_date, end_date)
   */
  getHomecareVisits: async (params = {}) => {
    const response = await apiClient.get('/ppt-charts/homecare-visits', { params });
    return response.data;
  },

  /**
   * Get monthwise homecare days count (distinct visit dates) from patient_visits table
   * @param {Object} params - Optional filters (status, complexity, start_date, end_date)
   */
  getHomecareDays: async (params = {}) => {
    const response = await apiClient.get('/ppt-charts/homecare-days', { params });
    return response.data;
  },
};


export default pptChartsApi;
