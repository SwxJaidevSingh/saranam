/**
 * Authentication API endpoints
 */
import apiClient from './client';

export const authApi = {
  /**
   * Login user
   * @param {Object} credentials - {email, password}
   * @returns {Promise} Response with tokens and user data
   */
  login: async (credentials) => {
    const response = await apiClient.post('/auth/login', credentials);
    return response.data;
  },

  /**
   * Register new user
   * @param {Object} userData - {email, password, full_name, role}
   * @returns {Promise} Response with user data
   */
  register: async (userData) => {
    const response = await apiClient.post('/auth/register', userData);
    return response.data;
  },

  /**
   * Get current user details
   * @returns {Promise} Response with user data
   */
  getMe: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  /**
   * Logout user
   * @returns {Promise} Response
   */
  logout: async () => {
    const response = await apiClient.post('/auth/logout');
    return response.data;
  },

  /**
   * Refresh access token
   * @returns {Promise} Response with new access token
   */
  refresh: async () => {
    const response = await apiClient.post('/auth/refresh');
    return response.data;
  },

  /**
   * Request a password reset link by email.
   * @param {string} email
   * @returns {Promise} Generic success response (no account enumeration)
   */
  forgotPassword: async (email) => {
    const response = await apiClient.post('/auth/forgot-password', { email });
    return response.data;
  },

  /**
   * Reset a password using a token from the emailed link.
   * @param {string} token
   * @param {string} password
   */
  resetPassword: async (token, password) => {
    const response = await apiClient.post('/auth/reset-password', { token, password });
    return response.data;
  },

  /**
   * Accept a platform invite — set name + password to create the account.
   * @param {Object} data - {token, full_name, password}
   */
  acceptInvite: async (data) => {
    const response = await apiClient.post('/auth/accept-invite', data);
    return response.data;
  },
};

export default authApi;