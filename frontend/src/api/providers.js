/**
 * Healthcare Providers API endpoints
 */
import apiClient from './client';

export const providersApi = {
  /**
   * List/search providers
   * @param {Object} params - Search and filter parameters
   * @returns {Promise} Response with providers list
   */
  list: async (params = {}) => {
    const response = await apiClient.get('/providers', { params });
    return response.data;
  },

  /**
   * Get provider by ID
   * @param {string} id - Provider UUID
   * @returns {Promise} Response with provider data
   */
  getById: async (id) => {
    const response = await apiClient.get(`/providers/${id}`);
    return response.data;
  },

  /**
   * Create a new provider
   * @param {Object} providerData - Provider information
   * @returns {Promise} Response with created provider
   */
  create: async (providerData) => {
    const response = await apiClient.post('/providers', providerData);
    return response.data;
  },

  /**
   * Update an existing provider
   * @param {string} id - Provider UUID
   * @param {Object} providerData - Updated provider information
   * @returns {Promise} Response with updated provider
   */
  update: async (id, providerData) => {
    const response = await apiClient.put(`/providers/${id}`, providerData);
    return response.data;
  },

  /**
   * Deactivate a provider
   * @param {string} id - Provider UUID
   * @returns {Promise} Response with success message
   */
  delete: async (id) => {
    const response = await apiClient.delete(`/providers/${id}`);
    return response.data;
  },

  /**
   * Get provider's appointments
   * @param {string} id - Provider UUID
   * @param {Object} params - Filter parameters (from_date, to_date, status)
   * @returns {Promise} Response with appointments list
   */
  getAppointments: async (id, params = {}) => {
    const response = await apiClient.get(`/providers/${id}/appointments`, { params });
    return response.data;
  },

  /**
   * Get provider's schedule
   * @param {string} id - Provider UUID
   * @returns {Promise} Response with weekly schedule
   */
  getSchedule: async (id) => {
    const response = await apiClient.get(`/providers/${id}/schedule`);
    return response.data;
  },

  /**
   * Create or update provider schedule
   * @param {string} id - Provider UUID
   * @param {Object} scheduleData - Schedule information
   * @returns {Promise} Response with created schedule
   */
  createSchedule: async (id, scheduleData) => {
    const response = await apiClient.post(`/providers/${id}/schedule`, scheduleData);
    return response.data;
  },

  /**
   * Create bulk schedules
   * @param {string} id - Provider UUID
   * @param {Array} schedules - Array of schedule objects
   * @returns {Promise} Response with created schedules
   */
  createBulkSchedule: async (id, schedules) => {
    const response = await apiClient.post(`/providers/${id}/schedule/bulk`, { schedules });
    return response.data;
  },

  /**
   * Update schedule for specific day
   * @param {string} id - Provider UUID
   * @param {number} dayOfWeek - Day of week (0-6)
   * @param {Object} scheduleData - Schedule information
   * @returns {Promise} Response with updated schedule
   */
  updateDaySchedule: async (id, dayOfWeek, scheduleData) => {
    const response = await apiClient.put(`/providers/${id}/schedule/${dayOfWeek}`, scheduleData);
    return response.data;
  },

  /**
   * Delete schedule for specific day
   * @param {string} id - Provider UUID
   * @param {number} dayOfWeek - Day of week (0-6)
   * @returns {Promise} Response with success message
   */
  deleteDaySchedule: async (id, dayOfWeek) => {
    const response = await apiClient.delete(`/providers/${id}/schedule/${dayOfWeek}`);
    return response.data;
  },

  /**
   * Get available slots for a date
   * @param {string} id - Provider UUID
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {number} duration - Appointment duration in minutes (optional)
   * @returns {Promise} Response with available slots
   */
  getAvailability: async (id, date, duration = null) => {
    const params = { date };
    if (duration) {
      params.duration = duration;
    }
    const response = await apiClient.get(`/providers/${id}/availability`, { params });
    return response.data;
  },

  /**
   * Get available slots for a date range
   * @param {string} id - Provider UUID
   * @param {string} fromDate - Start date in YYYY-MM-DD format
   * @param {string} toDate - End date in YYYY-MM-DD format
   * @param {number} duration - Appointment duration in minutes (optional)
   * @returns {Promise} Response with availability range
   */
  getAvailabilityRange: async (id, fromDate, toDate, duration = null) => {
    const params = { from_date: fromDate, to_date: toDate };
    if (duration) {
      params.duration = duration;
    }
    const response = await apiClient.get(`/providers/${id}/availability/range`, { params });
    return response.data;
  },

  /**
   * Get all specializations
   * @returns {Promise} Response with specializations list
   */
  getSpecializations: async () => {
    const response = await apiClient.get('/providers/specializations');
    return response.data;
  },

  /**
   * Get all departments
   * @returns {Promise} Response with departments list
   */
  getDepartments: async () => {
    const response = await apiClient.get('/providers/departments');
    return response.data;
  },

  /**
   * Add a custom specialization
   * @param {string} name - Specialization name
   * @returns {Promise} Response with created specialization
   */
  addSpecialization: async (name) => {
    const response = await apiClient.post('/providers/specializations', { name });
    return response.data;
  },

  deleteSpecialization: async (name) => {
    const response = await apiClient.delete(`/providers/specializations/${encodeURIComponent(name)}`);
    return response.data;
  },

  /**
   * Add a custom department
   * @param {string} name - Department name
   * @returns {Promise} Response with created department
   */
  addDepartment: async (name) => {
    const response = await apiClient.post('/providers/departments', { name });
    return response.data;
  },

  /**
   * Quick create provider for bulk import flow
   * @param {Object} providerData - Provider information {full_name, specialization, phone, email, bulk_import_session_id}
   * @returns {Promise} Response with created provider
   */
  quickCreate: async (providerData) => {
    const response = await apiClient.post('/providers/quick-create', providerData);
    return response.data;
  },

  /**
   * Get or create Unknown Provider placeholder
   * @returns {Promise} Response with Unknown Provider data
   */
  getUnknownProvider: async () => {
    const response = await apiClient.get('/providers/unknown-provider');
    return response.data;
  },

  /**
   * Upload a doctor's signature image (meeting §5.4, 2026-04-14).
   * Multipart upload — backend pushes to Cloudinary (if configured) or
   * stores as base64. Either way the returned `signature_image` is a
   * string suitable for jsPDF.addImage (data URL or HTTPS URL).
   *
   * @param {string} providerId - UUID of the provider
   * @param {File} file - PNG / JPEG / WEBP image
   * @returns {Promise<{signature_image, storage}>}
   */
  uploadSignature: async (providerId, file) => {
    const formData = new FormData();
    formData.append('signature', file);
    const response = await apiClient.post(
      `/providers/${providerId}/signature`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  },
};

export default providersApi;
