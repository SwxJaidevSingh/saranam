/**
 * Form Configurations API endpoints
 * Manages dynamic form assignments to services/departments
 */
import apiClient from './client';

export const formConfigurationsApi = {
  /**
   * Get all form configurations with optional filters
   * @param {Object} params - Query parameters (facility_id, service_id, form_type, is_active)
   * @returns {Promise} Response with configurations list
   */
  getAll: async (params = {}) => {
    const response = await apiClient.get('/form-configurations', { params });
    return response.data;
  },

  /**
   * Get form configuration by ID
   * @param {string} configId - Configuration ID
   * @returns {Promise} Response with configuration data
   */
  getById: async (configId) => {
    const response = await apiClient.get(`/form-configurations/${configId}`);
    return response.data;
  },

  /**
   * Get the appropriate form for a service (with fallback logic)
   * @param {string} serviceId - Service ID
   * @param {string} formType - Form type (ADMISSION, DISCHARGE, PROGRESS_NOTE, NURSING_ASSESSMENT)
   * @param {string} facilityId - Optional facility ID for fallback
   * @returns {Promise} Response with configuration and form
   */
  getForService: async (serviceId, formType, facilityId = null) => {
    const params = { form_type: formType };
    if (facilityId) {
      params.facility_id = facilityId;
    }
    const response = await apiClient.get(`/form-configurations/for-service/${serviceId}`, { params });
    return response.data;
  },

  /**
   * Create new form configuration
   * @param {Object} configData - Configuration data
   * @returns {Promise} Response with created configuration
   */
  create: async (configData) => {
    const response = await apiClient.post('/form-configurations', configData);
    return response.data;
  },

  /**
   * Update form configuration
   * @param {string} configId - Configuration ID
   * @param {Object} configData - Updated configuration data
   * @returns {Promise} Response with updated configuration
   */
  update: async (configId, configData) => {
    const response = await apiClient.put(`/form-configurations/${configId}`, configData);
    return response.data;
  },

  /**
   * Delete form configuration
   * @param {string} configId - Configuration ID
   * @returns {Promise} Response confirming deletion
   */
  delete: async (configId) => {
    const response = await apiClient.delete(`/form-configurations/${configId}`);
    return response.data;
  },

  /**
   * Create clinical documentation (progress note/nursing assessment)
   * @param {Object} docData - Documentation data
   * @returns {Promise} Response with created documentation
   */
  createClinicalDocumentation: async (docData) => {
    const response = await apiClient.post('/form-configurations/clinical-documentation', docData);
    return response.data;
  },

  /**
   * Get clinical documentation for an admission
   * @param {string} admissionId - Admission ID
   * @param {string} type - Optional documentation type filter
   * @returns {Promise} Response with documentation list
   */
  getClinicalDocumentation: async (admissionId, type = null) => {
    const params = type ? { type } : {};
    const response = await apiClient.get(`/form-configurations/clinical-documentation/admission/${admissionId}`, { params });
    return response.data;
  },

  /**
   * Get clinical documentation by ID
   * @param {string} docId - Documentation ID
   * @returns {Promise} Response with documentation data
   */
  getClinicalDocumentationById: async (docId) => {
    const response = await apiClient.get(`/form-configurations/clinical-documentation/${docId}`);
    return response.data;
  }
};

export default formConfigurationsApi;
