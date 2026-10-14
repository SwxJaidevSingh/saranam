/**
 * Portal org-context API.
 *
 * GET /portal/orgs/me -> {
 *   is_platform_admin, active_org, active_org_id, role_in_org, memberships: [
 *     { organization_id, code, name, display_name, role }
 *   ]
 * }
 *
 * `active_org` (when present) is the full org row including branding
 * (display_name, logo_url, accent_color) and feature toggles.
 *
 * NOTE: /orgs/me reflects whatever X-Org-Id the client sent. To list ALL of a
 * user's memberships reliably (e.g. the first call right after login, before an
 * org is chosen), call it with no active org selected.
 */
import apiClient from './client'

export const orgsApi = {
  getMine: async () => {
    const response = await apiClient.get('/portal/orgs/me')
    return response.data
  },

  // Names/codes of OTHER orgs — gated by the active org's directory toggle or
  // platform-admin. Used by the origin picker (referring organization).
  getDirectory: async () => {
    const response = await apiClient.get('/portal/org-directory')
    return response.data
  },
}

export default orgsApi
