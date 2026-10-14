/**
 * Org members API — consumes the Wave 2 backend (backend/app/portal/member_routes.py).
 *
 *   GET   /portal/members              -> { members: [...], total }
 *   PATCH /portal/members/:membership_id  body { role?, is_active? } -> { message, membership }
 *
 * All endpoints are ORG ADMIN only and strictly scoped to the active org via the
 * X-Org-Id header (attached by ../api/client). A member in another org returns 404.
 *
 * `members[]` shape:
 *   { membership_id, user_id, full_name, email, role, is_active, joined_at }
 *
 * Roles: 'org_admin' | 'org_data_entry' | 'org_viewer'.
 */
import apiClient from './client'

export const MEMBER_ROLES = ['org_admin', 'org_data_entry', 'org_viewer']

export const MEMBER_ROLE_LABELS = {
  org_admin: 'Admin',
  org_data_entry: 'Data Entry',
  org_viewer: 'Viewer',
}

export const membersApi = {
  // List all memberships in the active org.
  list: async () => {
    const response = await apiClient.get('/portal/members')
    return response.data
  },

  // Change a member's role and/or active state.
  // patch: { role?: string, is_active?: boolean } — at least one required.
  update: async (membershipId, patch) => {
    const response = await apiClient.patch(`/portal/members/${membershipId}`, patch)
    return response.data
  },

  // Convenience helpers.
  changeRole: async (membershipId, role) => {
    const response = await apiClient.patch(`/portal/members/${membershipId}`, { role })
    return response.data
  },

  setActive: async (membershipId, isActive) => {
    const response = await apiClient.patch(`/portal/members/${membershipId}`, {
      is_active: isActive,
    })
    return response.data
  },
}

export default membersApi
