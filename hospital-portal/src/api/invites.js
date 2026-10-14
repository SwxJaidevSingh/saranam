/**
 * Org invites API — consumes the Wave 2 backend (backend/app/portal/invite_routes.py).
 *
 *   POST   /portal/invites          body { email, role }        -> { message, invite }
 *   GET    /portal/invites                                       -> { invites: [...], total }
 *   DELETE /portal/invites/:id                                   -> { message }
 *   POST   /portal/invites/accept   body { token, password, full_name? }
 *          -> { message, access_token, refresh_token, user, organization_id, role }
 *
 * create/list/revoke are ORG ADMIN only, scoped to the active org (X-Org-Id,
 * attached by ../api/client). `accept` is PUBLIC — it does NOT require an
 * authenticated session or an active org (no token/header needed), so callers
 * may invoke it before the user has signed in.
 *
 * `invite` / `invites[]` shape (token is NEVER returned by the backend):
 *   { id, organization_id, email, role, expires_at, accepted_at, invited_by,
 *     created_at, updated_at }
 *
 * Invitable roles: 'org_admin' | 'org_data_entry' | 'org_viewer'.
 */
import apiClient from './client'

export const INVITE_ROLES = ['org_admin', 'org_data_entry', 'org_viewer']

export const INVITE_ROLE_LABELS = {
  org_admin: 'Admin',
  org_data_entry: 'Data Entry',
  org_viewer: 'Viewer',
}

export const invitesApi = {
  // Create + email an invite to `email` with the given portal `role`.
  create: async ({ email, role }) => {
    const response = await apiClient.post('/portal/invites', { email, role })
    return response.data
  },

  // List pending (unaccepted, unexpired) invites for the active org.
  list: async () => {
    const response = await apiClient.get('/portal/invites')
    return response.data
  },

  // Revoke a pending invite (active org only).
  revoke: async (inviteId) => {
    const response = await apiClient.delete(`/portal/invites/${inviteId}`)
    return response.data
  },

  // PUBLIC — accept an invite from its emailed token, setting a password
  // (and optionally a display name). Returns fresh tokens so the invitee is
  // signed in immediately on success.
  accept: async ({ token, password, full_name }) => {
    const body = { token, password }
    if (full_name) body.full_name = full_name
    const response = await apiClient.post('/portal/invites/accept', body)
    return response.data
  },
}

export default invitesApi
