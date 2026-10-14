/**
 * Forms API endpoints
 */
import apiClient from './client';

export const formsApi = {
  /**
   * Get all forms
   * @param {Object} params - Query parameters
   * @returns {Promise} Response with forms list
   */
  getAll: async (params = {}) => {
    const response = await apiClient.get('/forms', { params });
    return response.data;
  },

  /**
   * Get form by ID
   * @param {string} formId - Form ID
   * @returns {Promise} Response with form data
   */
  getById: async (formId) => {
    const response = await apiClient.get(`/forms/${formId}`);
    return response.data;
  },

  /**
   * Create new form
   * @param {Object} formData - Form data
   * @returns {Promise} Response with created form
   */
  create: async (formData) => {
    const response = await apiClient.post('/forms', formData);
    return response.data;
  },

  /**
   * Update form
   * @param {string} formId - Form ID
   * @param {Object} formData - Updated form data
   * @returns {Promise} Response with updated form
   */
  update: async (formId, formData) => {
    const response = await apiClient.put(`/forms/${formId}`, formData);
    return response.data;
  },

  /**
   * Delete form
   * @param {string} formId - Form ID
   * @returns {Promise} Response
   */
  delete: async (formId) => {
    const response = await apiClient.delete(`/forms/${formId}`);
    return response.data;
  },

  /**
   * Clone form
   * @param {string} formId - Form ID to clone
   * @param {string} name - New form name
   * @returns {Promise} Response with cloned form
   */
  clone: async (formId, name) => {
    const response = await apiClient.post(`/forms/${formId}/clone`, { name });
    return response.data;
  },

  /**
   * Enable form sharing
   * @param {string} formId - Form ID
   * @returns {Promise} Response with share token and URL
   */
  enableSharing: async (formId) => {
    const response = await apiClient.post(`/forms/${formId}/share`);
    return response.data;
  },

  /**
   * Disable form sharing
   * @param {string} formId - Form ID
   * @returns {Promise} Response
   */
  disableSharing: async (formId) => {
    const response = await apiClient.delete(`/forms/${formId}/share`);
    return response.data;
  },

  /**
   * Get public form by share token
   * @param {string} shareToken - Share token
   * @returns {Promise} Response with form data
   */
  getPublicForm: async (shareToken) => {
    const response = await apiClient.get(`/public/forms/${shareToken}`);
    return response.data;
  },

  /**
   * Submit to public form
   * @param {string} shareToken - Share token
   * @param {Object} data - Submission data
   * @returns {Promise} Response
   */
  submitPublicForm: async (shareToken, data) => {
    const response = await apiClient.post(`/public/forms/${shareToken}/submit`, data);
    return response.data;
  },

  // Aliases for easier use
  getAllForms: async function() { return this.getAll(); },
  getForm: async function(id) { return this.getById(id); },
  createForm: async function(data) { return this.create(data); },
  updateForm: async function(id, data) { return this.update(id, data); },
  deleteForm: async function(id) { return this.delete(id); },
  cloneForm: async function(id, name) { return this.clone(id, name); },
};

export default formsApi;