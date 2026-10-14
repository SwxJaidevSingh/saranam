/**
 * Auth API. Login goes to the PORTAL realm endpoint (`/api/portal/auth/login`),
 * which only accepts hospital users (active org membership). Saranam/platform
 * staff are rejected here and must use the main dashboard. /me and /logout reuse
 * the shared auth endpoints (identity only, not realm-gated).
 * Login response shape: { access_token, refresh_token, user }.
 */
import apiClient from './client'

export const authApi = {
  login: async (credentials) => {
    const response = await apiClient.post('/portal/auth/login', credentials)
    return response.data
  },

  getMe: async () => {
    const response = await apiClient.get('/auth/me')
    return response.data
  },

  logout: async () => {
    const response = await apiClient.post('/auth/logout')
    return response.data
  },
}

export default authApi
