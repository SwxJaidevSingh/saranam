/**
 * Pure Logic Bulk Appointments API Client
 * API functions for deterministic bulk appointment import (no LLM)
 */

import apiClient from './client';

export const pureLogicBulkApi = {
  /**
   * Upload file for pure logic processing
   * @param {File} file - CSV or XLSX file
   * @returns {Promise} Response with session data
   */
  uploadFile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post('/bulk-appointments/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  /**
   * Process and validate uploaded file
   * @param {string} sessionId - Session UUID
   * @returns {Promise} Processing results with statistics
   */
  processFile: async (sessionId) => {
    const response = await apiClient.post(`/bulk-appointments/process/${sessionId}`);
    return response.data;
  },

  /**
   * Get session details
   * @param {string} sessionId - Session UUID
   * @returns {Promise} Session details with statistics
   */
  getSession: async (sessionId) => {
    const response = await apiClient.get(`/bulk-appointments/sessions/${sessionId}`);
    return response.data;
  },

  /**
   * List import items (paginated and filterable)
   * @param {string} sessionId - Session UUID
   * @param {Object} params - {page, per_page, status, has_conflict, filter_type}
   * @returns {Promise} Items list with pagination
   */
  listItems: async (sessionId, params = {}) => {
    const response = await apiClient.get(`/bulk-appointments/sessions/${sessionId}/items`, { params });
    return response.data;
  },

  /**
   * Get single item details
   * @param {string} sessionId - Session UUID
   * @param {string} itemId - Item UUID
   * @returns {Promise} Item details
   */
  getItem: async (sessionId, itemId) => {
    const response = await apiClient.get(`/bulk-appointments/sessions/${sessionId}/items/${itemId}`);
    return response.data;
  },

  /**
   * Resolve a conflict manually
   * @param {string} sessionId - Session UUID
   * @param {string} itemId - Item UUID
   * @param {Object} data - {action, resolution_data}
   * @returns {Promise} Updated item
   */
  resolveConflict: async (sessionId, itemId, data) => {
    const response = await apiClient.post(
      `/bulk-appointments/sessions/${sessionId}/items/${itemId}/resolve`,
      data
    );
    return response.data;
  },

  /**
   * Create all approved appointments
   * @param {string} sessionId - Session UUID
   * @returns {Promise} Creation results
   */
  createAppointments: async (sessionId) => {
    const response = await apiClient.post(`/bulk-appointments/sessions/${sessionId}/create`);
    return response.data;
  },

  /**
   * Download CSV template
   * @returns {Promise} Blob for download
   */
  downloadTemplate: async () => {
    const response = await apiClient.get('/bulk-appointments/template', {
      responseType: 'blob'
    });
    return response.data;
  },

  /**
   * Get missing providers grouped by name
   * @param {string} sessionId - Session UUID
   * @returns {Promise} Missing providers list
   */
  getMissingProviders: async (sessionId) => {
    const response = await apiClient.get(`/bulk-appointments/sessions/${sessionId}/missing-providers`);
    return response.data;
  },

  /**
   * Resolve missing providers in batch
   * @param {string} sessionId - Session UUID
   * @param {Object} data - {resolutions: [...]}
   * @returns {Promise} Resolution results with updated statistics
   */
  resolveMissingProviders: async (sessionId, data) => {
    const response = await apiClient.post(
      `/bulk-appointments/sessions/${sessionId}/resolve-missing-providers`,
      data
    );
    return response.data;
  }
};

export default pureLogicBulkApi;
