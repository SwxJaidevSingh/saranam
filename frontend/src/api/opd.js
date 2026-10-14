/**
 * OPD (Out-Patient Department) API endpoints
 */
import apiClient from './client';

const opdApi = {
  // ==================== Dashboard & Queue ====================

  getStats: async () => {
    const response = await apiClient.get('/opd/stats');
    return response.data;
  },

  getQueue: async (date = null) => {
    const params = {};
    if (date) params.date = date;
    const response = await apiClient.get('/opd/queue', { params });
    return response.data;
  },

  // ==================== Visits ====================

  listVisits: async (filters = {}, page = 1, perPage = 50) => {
    const params = { ...filters, page, per_page: perPage };
    const response = await apiClient.get('/opd/visits', { params });
    return response.data;
  },

  createVisit: async (data) => {
    const response = await apiClient.post('/opd/visits', data);
    return response.data;
  },

  getVisit: async (visitId) => {
    const response = await apiClient.get(`/opd/visits/${visitId}`);
    return response.data;
  },

  updateProvider: async (visitId, providerId) => {
    const response = await apiClient.patch(`/opd/visits/${visitId}/provider`, { provider_id: providerId });
    return response.data;
  },

  // ==================== Status Transitions ====================

  checkIn: async (visitId) => {
    const response = await apiClient.post(`/opd/visits/${visitId}/check-in`);
    return response.data;
  },

  markNoShow: async (visitId) => {
    const response = await apiClient.post(`/opd/visits/${visitId}/no-show`);
    return response.data;
  },

  completeVisit: async (visitId, data = {}) => {
    const response = await apiClient.post(`/opd/visits/${visitId}/complete`, data);
    return response.data;
  },

  // ==================== Vitals ====================

  saveVitals: async (visitId, vitalsData) => {
    const response = await apiClient.post(`/opd/visits/${visitId}/vitals`, { vitals: vitalsData });
    return response.data;
  },

  saveNursingAssessment: async (visitId, { vitals, assessment_data, visit_summary }) => {
    const response = await apiClient.post(`/opd/visits/${visitId}/vitals`, {
      vitals,
      assessment_data,
      visit_summary,
    });
    return response.data;
  },

  getVitals: async (visitId) => {
    const response = await apiClient.get(`/opd/visits/${visitId}/vitals`);
    return response.data;
  },

  // ==================== Doctor's Assessment ====================

  saveDoctorAssessment: async (visitId, assessment) => {
    const response = await apiClient.post(`/opd/visits/${visitId}/doctor-assessment`, { assessment });
    return response.data;
  },

  getDoctorAssessment: async (visitId) => {
    const response = await apiClient.get(`/opd/visits/${visitId}/doctor-assessment`);
    return response.data;
  },

  // ==================== Diagnoses ====================

  saveDiagnoses: async (visitId, diagnoses) => {
    const response = await apiClient.post(`/opd/visits/${visitId}/diagnoses`, { diagnoses });
    return response.data;
  },

  getDiagnoses: async (visitId) => {
    const response = await apiClient.get(`/opd/visits/${visitId}/diagnoses`);
    return response.data;
  },

  // ==================== Prescriptions ====================

  savePrescription: async (visitId, data) => {
    const response = await apiClient.post(`/opd/visits/${visitId}/prescriptions`, data);
    return response.data;
  },

  getPrescription: async (visitId) => {
    const response = await apiClient.get(`/opd/visits/${visitId}/prescriptions`);
    return response.data;
  },

  updatePrescriptionStatus: async (visitId, status) => {
    const response = await apiClient.patch(`/opd/visits/${visitId}/prescriptions/status`, { status });
    return response.data;
  },

  // ==================== Lab Orders ====================

  saveLabOrder: async (visitId, data) => {
    const response = await apiClient.post(`/opd/visits/${visitId}/lab-orders`, data);
    return response.data;
  },

  getLabOrder: async (visitId) => {
    const response = await apiClient.get(`/opd/visits/${visitId}/lab-orders`);
    return response.data;
  },
};

export default opdApi;
