/**
 * Services API Client
 */

import api from './client';

export const servicesApi = {
  /**
   * List services with filters
   */
  list: async (params = {}) => {
    const queryParams = new URLSearchParams();

    if (params.query) queryParams.append('query', params.query);
    if (params.service_type) queryParams.append('service_type', params.service_type);
    if (params.department) queryParams.append('department', params.department);
    if (params.is_active !== undefined) queryParams.append('is_active', params.is_active);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.offset) queryParams.append('offset', params.offset);

    const response = await api.get(`/services?${queryParams}`);
    return response.data;
  },

  /**
   * Get service by ID
   */
  getById: async (id) => {
    const response = await api.get(`/services/${id}`);
    return response.data;
  },

  /**
   * Create a new service
   */
  create: async (data) => {
    const response = await api.post('/services', data);
    return response.data;
  },

  /**
   * Update service
   */
  update: async (id, data) => {
    const response = await api.put(`/services/${id}`, data);
    return response.data;
  },

  /**
   * Get service providers
   */
  getProviders: async (serviceId) => {
    const response = await api.get(`/services/${serviceId}/providers`);
    return response.data;
  },

  /**
   * Assign provider to service
   */
  assignProvider: async (serviceId, data) => {
    const response = await api.post(`/services/${serviceId}/providers`, data);
    return response.data;
  },

  /**
   * Get service forms
   */
  getForms: async (serviceId, formType = null) => {
    const queryParams = formType ? `?form_type=${formType}` : '';
    const response = await api.get(`/services/${serviceId}/forms${queryParams}`);
    return response.data;
  },

  /**
   * Assign form to service
   */
  assignForm: async (serviceId, data) => {
    const response = await api.post(`/services/${serviceId}/forms`, data);
    return response.data;
  },

  /**
   * Get service schedule
   */
  getSchedule: async (serviceId) => {
    const response = await api.get(`/services/${serviceId}/schedule`);
    return response.data;
  },

  /**
   * Create service schedule
   */
  createSchedule: async (serviceId, data) => {
    const response = await api.post(`/services/${serviceId}/schedule`, data);
    return response.data;
  },

  /**
   * Get service availability
   */
  getAvailability: async (serviceId, date, duration = null) => {
    const queryParams = new URLSearchParams();
    queryParams.append('date', date);
    if (duration) queryParams.append('duration', duration);

    const response = await api.get(`/services/${serviceId}/availability?${queryParams}`);
    return response.data;
  },

  /**
   * Book service
   */
  book: async (serviceId, data) => {
    const response = await api.post(`/services/${serviceId}/book`, data);
    return response.data;
  },

  /**
   * Get all service types
   */
  getTypes: async () => {
    const response = await api.get('/services/types');
    return response.data;
  },

  /**
   * Get services by type
   */
  getByType: async (type) => {
    const response = await api.get(`/services/by-type/${type}`);
    return response.data;
  },

  /**
   * Get service statistics
   */
  getStats: async () => {
    const response = await api.get('/services/stats');
    return response.data;
  },

  /**
   * Get user's bookings
   */
  getUserBookings: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append('status', params.status);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.offset) queryParams.append('offset', params.offset);

    const response = await api.get(`/bookings/user?${queryParams}`);
    return response.data;
  },

  /**
   * Get service bookings for calendar view
   */
  getBookingsCalendar: async (fromDate, toDate, params = {}) => {
    const queryParams = new URLSearchParams();
    queryParams.append('from_date', fromDate);
    queryParams.append('to_date', toDate);
    if (params.service_type) queryParams.append('service_type', params.service_type);
    if (params.status) queryParams.append('status', params.status);

    const response = await api.get(`/bookings/calendar?${queryParams}`);
    return response.data;
  }
};

export default servicesApi;