/**
 * User management API endpoints
 */
import apiClient from './client';

export const usersApi = {
  /**
   * Get all users with optional filters
   * @param {Object} params - Query parameters {role, status, approval, search, page, per_page}
   * @returns {Promise} Response with users array, total count, and pagination info
   */
  getAllUsers: async (params = {}) => {
    const response = await apiClient.get('/users', { params });
    return response.data;
  },

  /**
   * Create a main-dashboard (platform) user that can sign in to the main app.
   * @param {Object} data - {full_name, email, password, role}
   * @returns {Promise} Response with created user data
   */
  createUser: async (data) => {
    const response = await apiClient.post('/users', data);
    return response.data;
  },

  /**
   * Invite a main-dashboard user by email (sends an accept link).
   * @param {Object} data - {email, role}
   */
  inviteUser: async (data) => {
    const response = await apiClient.post('/users/invite', data);
    return response.data;
  },

  /**
   * Admin: set/reset a user's password.
   * @param {string} userId
   * @param {string} password
   */
  setUserPassword: async (userId, password) => {
    const response = await apiClient.put(`/users/${userId}/password`, { password });
    return response.data;
  },

  /**
   * Get user by ID
   * @param {string} userId - User UUID
   * @returns {Promise} Response with user data
   */
  getUserById: async (userId) => {
    const response = await apiClient.get(`/users/${userId}`);
    return response.data;
  },

  /**
   * Approve pending user
   * @param {string} userId - User UUID
   * @returns {Promise} Response with updated user data
   */
  approveUser: async (userId) => {
    const response = await apiClient.post(`/users/${userId}/approve`);
    return response.data;
  },

  /**
   * Reject pending user (soft delete)
   * @param {string} userId - User UUID
   * @returns {Promise} Response with updated user data
   */
  rejectUser: async (userId) => {
    const response = await apiClient.post(`/users/${userId}/reject`);
    return response.data;
  },

  /**
   * Update user details
   * @param {string} userId - User UUID
   * @param {Object} data - User data {full_name, email, role}
   * @returns {Promise} Response with updated user data
   */
  updateUser: async (userId, data) => {
    const response = await apiClient.put(`/users/${userId}`, data);
    return response.data;
  },

  /**
   * Toggle user active status
   * @param {string} userId - User UUID
   * @returns {Promise} Response with updated user data
   */
  toggleUserStatus: async (userId) => {
    const response = await apiClient.put(`/users/${userId}/toggle-status`);
    return response.data;
  },

  /**
   * Get count of pending approval users
   * @returns {Promise} Response with count
   */
  getPendingCount: async () => {
    const response = await apiClient.get('/users/pending/count');
    return response.data;
  },
};

export default usersApi;
