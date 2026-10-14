/**
 * Bulk Appointments API Client
 * API functions for bulk appointment import
 */

import apiClient from './client';

export const bulkAppointmentsApi = {
  /**
   * Upload file and extract appointments
   * @param {FormData} formData - Form data with file and llm_provider
   * @returns {Promise} Response with session_id and extracted data
   */
  upload: async (formData) => {
    const response = await apiClient.post('/appointments/bulk/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  /**
   * Validate extracted appointments
   * @param {Object} data - {session_id, appointments}
   * @returns {Promise} Validation results
   */
  validate: async (data) => {
    const response = await apiClient.post('/appointments/bulk/validate', data);
    return response.data;
  },

  /**
   * Get AI suggestions for conflict resolution
   * @param {Object} data - {session_id, auto_resolve}
   * @returns {Promise} Conflict suggestions
   */
  resolveConflicts: async (data) => {
    const response = await apiClient.post('/appointments/bulk/resolve-conflicts', data);
    return response.data;
  },

  /**
   * Manually resolve a conflict
   * @param {Object} data - {item_id, action, resolution_data}
   * @returns {Promise} Updated item
   */
  resolveManually: async (data) => {
    const response = await apiClient.post('/appointments/bulk/resolve-manually', data);
    return response.data;
  },

  /**
   * Create all validated appointments
   * @param {Object} data - {session_id}
   * @returns {Promise} Creation results
   */
  create: async (data) => {
    const response = await apiClient.post('/appointments/bulk/create', data);
    return response.data;
  },

  /**
   * List import sessions
   * @param {Object} params - {page, per_page, status}
   * @returns {Promise} Sessions list
   */
  listSessions: async (params = {}) => {
    const response = await apiClient.get('/appointments/bulk/sessions', { params });
    return response.data;
  },

  /**
   * Get session details
   * @param {string} sessionId - Session UUID
   * @returns {Promise} Session details
   */
  getSession: async (sessionId) => {
    const response = await apiClient.get(`/appointments/bulk/sessions/${sessionId}`);
    return response.data;
  },

  /**
   * Rollback an import
   * @param {string} sessionId - Session UUID
   * @param {string} reason - Rollback reason
   * @returns {Promise} Rollback result
   */
  rollback: async (sessionId, reason) => {
    const response = await apiClient.post(`/appointments/bulk/rollback/${sessionId}`, { reason });
    return response.data;
  },

  /**
   * Export results as CSV
   * @param {string} sessionId - Session UUID
   * @returns {Promise} Blob for download
   */
  exportResults: async (sessionId) => {
    const response = await apiClient.get(`/appointments/bulk/export/${sessionId}`, {
      responseType: 'blob'
    });
    return response.data;
  }
};

export default bulkAppointmentsApi;
