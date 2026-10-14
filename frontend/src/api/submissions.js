/**
 * Submissions API endpoints
 */
import apiClient from './client';

export const submissionsApi = {
  /**
   * Get all submissions
   * @param {Object} params - Query parameters (form_id, date_from, date_to, page, per_page)
   * @returns {Promise} Response with submissions list
   */
  getAll: async (params = {}) => {
    const response = await apiClient.get('/submissions', { params });
    return response.data;
  },

  /**
   * Get submission by ID
   * @param {string} submissionId - Submission ID
   * @returns {Promise} Response with submission data
   */
  getById: async (submissionId) => {
    const response = await apiClient.get(`/submissions/${submissionId}`);
    return response.data;
  },

  /**
   * Create new submission
   * @param {Object} submissionData - {form_id, data}
   * @returns {Promise} Response with created submission
   */
  create: async (submissionData) => {
    const response = await apiClient.post('/submissions', submissionData);
    return response.data;
  },

  /**
   * Update submission
   * @param {string} submissionId - Submission ID
   * @param {Object} data - Updated submission data
   * @returns {Promise} Response with updated submission
   */
  update: async (submissionId, data) => {
    const response = await apiClient.put(`/submissions/${submissionId}`, { data });
    return response.data;
  },

  /**
   * Delete submission
   * @param {string} submissionId - Submission ID
   * @returns {Promise} Response
   */
  delete: async (submissionId) => {
    const response = await apiClient.delete(`/submissions/${submissionId}`);
    return response.data;
  },

  /**
   * Export submissions
   * @param {Object} params - {form_id, format}
   * @returns {Promise} Response with exported data
   */
  export: async (params = {}) => {
    const response = await apiClient.get('/submissions/export', { params });
    return response.data;
  },

  // Aliases for easier use
  getAllSubmissions: async function() { return this.getAll(); },
  getSubmission: async function(id) { return this.getById(id); },
  createSubmission: async function(data) { return this.create(data); },
  updateSubmission: async function(id, data) { return this.update(id, data); },
  deleteSubmission: async function(id) { return this.delete(id); },
  exportSubmissions: async function(formId, format = 'csv') {
    // Download export in specified format (csv or xlsx)
    const params = { format };
    if (formId) {
      params.form_id = formId;
    }

    const response = await apiClient.get('/submissions/export', {
      params,
      responseType: 'blob'
    });

    // Determine file extension and MIME type
    const extension = format === 'xlsx' ? 'xlsx' : 'csv';
    const mimeType = format === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv';

    const url = window.URL.createObjectURL(new Blob([response.data], { type: mimeType }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `submissions${formId ? '-' + formId : ''}.${extension}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export default submissionsApi;