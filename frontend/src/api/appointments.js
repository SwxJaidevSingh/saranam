/**
 * Appointments API endpoints
 */
import apiClient from './client';

export const appointmentsApi = {
  /**
   * List appointments with filters
   * @param {Object} params - Filter parameters
   * @returns {Promise} Response with appointments list
   */
  list: async (params = {}) => {
    const response = await apiClient.get('/appointments', { params });
    return response.data;
  },

  /**
   * Get appointment by ID
   * @param {string} id - Appointment UUID
   * @returns {Promise} Response with appointment data
   */
  getById: async (id) => {
    const response = await apiClient.get(`/appointments/${id}`);
    return response.data;
  },

  /**
   * Book a new appointment
   * @param {Object} appointmentData - Appointment information
   * @returns {Promise} Response with created appointment
   */
  book: async (appointmentData) => {
    const response = await apiClient.post('/appointments', appointmentData);
    return response.data;
  },

  /**
   * Update an existing appointment
   * @param {string} id - Appointment UUID
   * @param {Object} appointmentData - Updated appointment information
   * @returns {Promise} Response with updated appointment
   */
  update: async (id, appointmentData) => {
    const response = await apiClient.put(`/appointments/${id}`, appointmentData);
    return response.data;
  },

  /**
   * Reschedule an appointment
   * @param {string} id - Appointment UUID
   * @param {Object} rescheduleData - New time and optional reason
   * @returns {Promise} Response with rescheduled appointment
   */
  reschedule: async (id, rescheduleData) => {
    const response = await apiClient.post(`/appointments/${id}/reschedule`, rescheduleData);
    return response.data;
  },

  /**
   * Cancel an appointment
   * @param {string} id - Appointment UUID
   * @param {string} reason - Cancellation reason (optional)
   * @returns {Promise} Response with cancelled appointment
   */
  cancel: async (id, reason = null) => {
    const response = await apiClient.post(`/appointments/${id}/cancel`, { reason });
    return response.data;
  },

  /**
   * Check-in patient for appointment
   * @param {string} id - Appointment UUID
   * @returns {Promise} Response with updated appointment
   */
  checkIn: async (id) => {
    const response = await apiClient.post(`/appointments/${id}/check-in`);
    return response.data;
  },

  /**
   * Complete an appointment
   * @param {string} id - Appointment UUID
   * @param {string} notes - Post-appointment notes (optional)
   * @returns {Promise} Response with completed appointment
   */
  complete: async (id, notes = null) => {
    const response = await apiClient.post(`/appointments/${id}/complete`, { notes });
    return response.data;
  },

  /**
   * Get calendar view of appointments
   * @param {Object} params - Calendar parameters (from_date, to_date, provider_id, view_type)
   * @returns {Promise} Response with calendar data
   */
  getCalendar: async (params) => {
    const response = await apiClient.get('/appointments/calendar', { params });
    return response.data;
  },

  /**
   * Get available time slots
   * @param {string} providerId - Provider UUID
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {number} duration - Appointment duration in minutes (optional)
   * @returns {Promise} Response with available slots
   */
  getAvailableSlots: async (providerId, date, duration = null) => {
    const params = { provider_id: providerId, date };
    if (duration) {
      params.duration = duration;
    }
    const response = await apiClient.get('/appointments/slots', { params });
    return response.data;
  },

  /**
   * Get appointment statistics
   * @param {Object} params - Filter parameters (from_date, to_date, provider_id)
   * @returns {Promise} Response with statistics
   */
  getStats: async (params = {}) => {
    const response = await apiClient.get('/appointments/stats', { params });
    return response.data;
  },

  /**
   * Get appointments for a specific patient
   * @param {string} patientId - Patient UUID
   * @param {Object} params - Additional filter parameters
   * @returns {Promise} Response with patient's appointments
   */
  getByPatient: async (patientId, params = {}) => {
    const response = await apiClient.get('/appointments', {
      params: { ...params, patient_id: patientId }
    });
    return response.data;
  },

  /**
   * Get appointments for a specific provider
   * @param {string} providerId - Provider UUID
   * @param {Object} params - Additional filter parameters
   * @returns {Promise} Response with provider's appointments
   */
  getByProvider: async (providerId, params = {}) => {
    const response = await apiClient.get('/appointments', {
      params: { ...params, provider_id: providerId }
    });
    return response.data;
  },

  /**
   * Get upcoming appointments
   * @param {number} limit - Number of appointments to return
   * @returns {Promise} Response with upcoming appointments
   */
  getUpcoming: async (limit = 10) => {
    const today = new Date().toISOString().split('T')[0];
    const response = await apiClient.get('/appointments', {
      params: {
        from_date: today,
        status: 'scheduled',
        per_page: limit,
        sort_by: 'start_time',
        sort_order: 'asc'
      }
    });
    return response.data;
  },

  /**
   * Get today's appointments
   * @param {string} providerId - Provider UUID (optional)
   * @returns {Promise} Response with today's appointments
   */
  getToday: async (providerId = null) => {
    const today = new Date().toISOString().split('T')[0];
    const params = {
      from_date: today,
      to_date: today
    };
    if (providerId) {
      params.provider_id = providerId;
    }
    const response = await apiClient.get('/appointments', { params });
    return response.data;
  }
};

export default appointmentsApi;
