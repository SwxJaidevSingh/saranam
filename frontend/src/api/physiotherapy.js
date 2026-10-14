/**
 * Physiotherapy API endpoints
 */
import apiClient from './client';

const physioApi = {
  // ==================== Dashboard & Queue ====================

  getStats: async () => {
    const response = await apiClient.get('/physiotherapy/stats');
    return response.data;
  },

  getQueue: async (date = null) => {
    const params = {};
    if (date) params.date = date;
    const response = await apiClient.get('/physiotherapy/queue', { params });
    return response.data;
  },

  // ==================== Visits ====================

  listVisits: async (filters = {}, page = 1, perPage = 50) => {
    const params = { ...filters, page, per_page: perPage };
    const response = await apiClient.get('/physiotherapy/visits', { params });
    return response.data;
  },

  createVisit: async (data) => {
    const response = await apiClient.post('/physiotherapy/visits', data);
    return response.data;
  },

  getVisit: async (visitId) => {
    const response = await apiClient.get(`/physiotherapy/visits/${visitId}`);
    return response.data;
  },

  updateProvider: async (visitId, providerId) => {
    const response = await apiClient.patch(`/physiotherapy/visits/${visitId}/provider`, { provider_id: providerId });
    return response.data;
  },

  // ==================== Status Transitions ====================

  checkIn: async (visitId) => {
    const response = await apiClient.post(`/physiotherapy/visits/${visitId}/check-in`);
    return response.data;
  },

  markNoShow: async (visitId) => {
    const response = await apiClient.post(`/physiotherapy/visits/${visitId}/no-show`);
    return response.data;
  },

  completeVisit: async (visitId, data = {}) => {
    const response = await apiClient.post(`/physiotherapy/visits/${visitId}/complete`, data);
    return response.data;
  },

  // ==================== Vitals ====================

  saveVitals: async (visitId, vitalsData) => {
    const response = await apiClient.post(`/physiotherapy/visits/${visitId}/vitals`, { vitals: vitalsData });
    return response.data;
  },

  saveNursingAssessment: async (visitId, { vitals, assessment_data, visit_summary }) => {
    const response = await apiClient.post(`/physiotherapy/visits/${visitId}/vitals`, {
      vitals,
      assessment_data,
      visit_summary,
    });
    return response.data;
  },

  getVitals: async (visitId) => {
    const response = await apiClient.get(`/physiotherapy/visits/${visitId}/vitals`);
    return response.data;
  },

  // ==================== Physiotherapy Assessment ====================

  savePhysioAssessment: async (visitId, assessment) => {
    const response = await apiClient.post(`/physiotherapy/visits/${visitId}/physio-assessment`, { assessment });
    return response.data;
  },

  getPhysioAssessment: async (visitId) => {
    const response = await apiClient.get(`/physiotherapy/visits/${visitId}/physio-assessment`);
    return response.data;
  },

  // ==================== Diagnoses ====================

  saveDiagnoses: async (visitId, diagnoses) => {
    const response = await apiClient.post(`/physiotherapy/visits/${visitId}/diagnoses`, { diagnoses });
    return response.data;
  },

  getDiagnoses: async (visitId) => {
    const response = await apiClient.get(`/physiotherapy/visits/${visitId}/diagnoses`);
    return response.data;
  },

  // ==================== Prescriptions ====================

  savePrescription: async (visitId, data) => {
    const response = await apiClient.post(`/physiotherapy/visits/${visitId}/prescriptions`, data);
    return response.data;
  },

  getPrescription: async (visitId) => {
    const response = await apiClient.get(`/physiotherapy/visits/${visitId}/prescriptions`);
    return response.data;
  },

  updatePrescriptionStatus: async (visitId, status) => {
    const response = await apiClient.patch(`/physiotherapy/visits/${visitId}/prescriptions/status`, { status });
    return response.data;
  },

  // ==================== Lab Orders ====================

  saveLabOrder: async (visitId, data) => {
    const response = await apiClient.post(`/physiotherapy/visits/${visitId}/lab-orders`, data);
    return response.data;
  },

  getLabOrder: async (visitId) => {
    const response = await apiClient.get(`/physiotherapy/visits/${visitId}/lab-orders`);
    return response.data;
  },
};

export default physioApi;
