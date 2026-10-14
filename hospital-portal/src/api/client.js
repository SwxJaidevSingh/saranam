/**
 * Portal API client.
 *
 * One axios instance shared by the whole portal. It attaches:
 *   - Authorization: Bearer <access_token>   (every request)
 *   - X-Org-Id: <active_org_id>              (when an org is actively selected)
 *
 * The X-Org-Id header is the tenant boundary on the backend (see
 * backend/app/portal/context.py). It is read from localStorage on every request
 * so an org switch takes effect immediately without rebuilding the client.
 *
 * GOD VIEW: a platform admin who selected "All orgs" stores the GOD_VIEW
 * sentinel as active_org_id — in that case we deliberately send NO X-Org-Id so
 * the backend serves the unscoped god view.
 *
 * 401 -> attempt a single refresh, else clear + redirect to /login.
 * 403 -> surfaced to callers (e.g. "no access to this organization").
 */
import axios from 'axios'
import { tokenStore, orgStore, GOD_VIEW } from './storage'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use(
  (config) => {
    const token = tokenStore.getAccess()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // Attach the active org for tenant scoping. Omit entirely for god view or
    // when no org is selected yet (regular users get a clean 400 from the API
    // telling them to select an org, which the UI handles).
    const activeOrgId = orgStore.get()
    if (activeOrgId && activeOrgId !== GOD_VIEW) {
      config.headers['X-Org-Id'] = activeOrgId
    } else {
      delete config.headers['X-Org-Id']
    }

    return config
  },
  (error) => Promise.reject(error),
)

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const refreshToken = tokenStore.getRefresh()
        if (refreshToken) {
          const response = await axios.post(
            `${API_BASE_URL}/auth/refresh`,
            {},
            { headers: { Authorization: `Bearer ${refreshToken}` } },
          )
          const { access_token } = response.data
          tokenStore.setTokens({ access_token })
          originalRequest.headers.Authorization = `Bearer ${access_token}`
          return apiClient(originalRequest)
        }
      } catch {
        // fall through to clear + redirect
      }
      tokenStore.clear()
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  },
)

export default apiClient
export { API_BASE_URL }
