/**
 * Risk Assessment API endpoints
 */
import apiClient from './client';

export const riskApi = {
  // Risk Rules
  getRiskRules: async (formId) => {
    const response = await apiClient.get(`/forms/${formId}/risk-rules`);
    return response.data;
  },

  createRiskRule: async (formId, ruleData) => {
    const response = await apiClient.post(`/forms/${formId}/risk-rules`, ruleData);
    return response.data;
  },

  updateRiskRule: async (formId, ruleId, ruleData) => {
    const response = await apiClient.put(`/forms/${formId}/risk-rules/${ruleId}`, ruleData);
    return response.data;
  },

  deleteRiskRule: async (formId, ruleId) => {
    const response = await apiClient.delete(`/forms/${formId}/risk-rules/${ruleId}`);
    return response.data;
  },

  // Risk Levels
  getRiskLevels: async (formId) => {
    const response = await apiClient.get(`/forms/${formId}/risk-levels`);
    return response.data;
  },

  setRiskLevels: async (formId, levelsData) => {
    const response = await apiClient.post(`/forms/${formId}/risk-levels`, levelsData);
    return response.data;
  },

  // Risk Score Calculation
  calculateRiskScore: async (submissionId) => {
    const response = await apiClient.post(`/submissions/${submissionId}/calculate-risk`);
    return response.data;
  },

  getRiskScore: async (submissionId) => {
    const response = await apiClient.get(`/submissions/${submissionId}/risk-score`);
    return response.data;
  },

  recalculateFormRisk: async (formId) => {
    const response = await apiClient.post(`/forms/${formId}/recalculate-risk`);
    return response.data;
  },

  getHighRiskSubmissions: async (formId, riskLevel = 'High') => {
    const response = await apiClient.get(`/forms/${formId}/high-risk-submissions`, {
      params: { risk_level: riskLevel }
    });
    return response.data;
  },

  getRiskDistribution: async (formId) => {
    const response = await apiClient.get(`/forms/${formId}/risk-distribution`);
    return response.data;
  },

  // Field Sections
  getFieldSections: async (category = null) => {
    const params = category ? { category } : {};
    const response = await apiClient.get('/field-sections', { params });
    return response.data;
  },

  createFieldSection: async (sectionData) => {
    const response = await apiClient.post('/field-sections', sectionData);
    return response.data;
  },

  getFieldSection: async (sectionId) => {
    const response = await apiClient.get(`/field-sections/${sectionId}`);
    return response.data;
  },

  updateFieldSection: async (sectionId, sectionData) => {
    const response = await apiClient.put(`/field-sections/${sectionId}`, sectionData);
    return response.data;
  },

  deleteFieldSection: async (sectionId) => {
    const response = await apiClient.delete(`/field-sections/${sectionId}`);
    return response.data;
  },
};

export default riskApi;
