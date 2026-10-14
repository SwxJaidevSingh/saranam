/**
 * Admin (platform) API — §2 "Manage Hospitals".
 *
 * Saranam platform admins use these endpoints to create and manage hospitals
 * (organizations) and their users. All requests go through the shared axios
 * `apiClient`, which already attaches the main-app JWT.
 *
 * This module ALSO normalizes the backend's actual response shapes into the
 * shapes the UI components expect (the two were built in parallel and drifted):
 *   backend `organizations`/`organization` -> `orgs`/`org`
 *   backend org toggles `can_view_org_directory`/`show_referral_feedback`
 *     <-> UI `directory_visible`/`referral_feedback_enabled`
 *   backend member `{...membership, user:{...}}` -> flat `{id, full_name, email, role, is_active}`
 */
import apiClient from './client';

// --- shape adapters ----------------------------------------------------------

// Backend org -> UI org (add the toggle aliases the form/components read).
const normalizeOrg = (o) => {
  if (!o) return o;
  return {
    ...o,
    directory_visible: o.directory_visible ?? o.can_view_org_directory ?? false,
    referral_feedback_enabled:
      o.referral_feedback_enabled ?? o.show_referral_feedback ?? false,
    members: Array.isArray(o.members) ? o.members.map(normalizeMember) : o.members,
  };
};

// Backend membership row (with nested user) -> flat member the table renders.
const normalizeMember = (m) => {
  if (!m) return m;
  const u = m.user || {};
  return {
    id: m.id, // membership id (used for PATCH /admin/members/:id)
    full_name: u.full_name ?? m.full_name,
    email: u.email ?? m.email,
    role: m.role,
    is_active: m.is_active,
  };
};

// UI org-form body -> backend field names.
const toOrgBody = (data = {}) => ({
  code: data.code,
  name: data.name,
  type: data.type,
  status: data.status,
  linked_hospital_code: data.linked_hospital_code || null,
  display_name: data.display_name || null,
  accent_color: data.accent_color || null,
  logo_url: data.logo_url || null,
  can_view_org_directory: data.directory_visible ?? false,
  show_referral_feedback: data.referral_feedback_enabled ?? false,
});

export const adminApi = {
  // --- Organizations ---
  listOrgs: async () => {
    const { data } = await apiClient.get('/admin/orgs');
    return { orgs: (data.organizations || data.orgs || []).map(normalizeOrg) };
  },

  getOrg: async (orgId) => {
    const { data } = await apiClient.get(`/admin/orgs/${orgId}`);
    return { org: normalizeOrg(data.organization || data.org || data) };
  },

  createOrg: async (data) => {
    const res = await apiClient.post('/admin/orgs', toOrgBody(data));
    return { org: normalizeOrg(res.data.organization || res.data.org) };
  },

  updateOrg: async (orgId, data) => {
    const res = await apiClient.put(`/admin/orgs/${orgId}`, toOrgBody(data));
    return { org: normalizeOrg(res.data.organization || res.data.org) };
  },

  // --- Members ---
  listMembers: async (orgId) => {
    const { data } = await apiClient.get(`/admin/orgs/${orgId}/members`);
    return { members: (data.members || []).map(normalizeMember) };
  },

  createUser: async (orgId, data) => {
    // { email, password, full_name, role }
    const { data: res } = await apiClient.post(`/admin/orgs/${orgId}/users`, data);
    return res;
  },

  updateMember: async (memberId, data) => {
    // { role?, is_active? }
    const { data: res } = await apiClient.patch(`/admin/members/${memberId}`, data);
    return res;
  },

  // --- Invites ---
  listInvites: async (orgId) => {
    const { data } = await apiClient.get(`/admin/orgs/${orgId}/invites`);
    return { invites: data.invites || [] };
  },

  createInvite: async (orgId, data) => {
    // { email, role }
    const { data: res } = await apiClient.post(`/admin/orgs/${orgId}/invites`, data);
    return res;
  },

  revokeInvite: async (inviteId) => {
    const { data: res } = await apiClient.delete(`/admin/invites/${inviteId}`);
    return res;
  },
};

// Hospital user roles (org-scoped).
export const ORG_ROLES = [
  { value: 'org_admin', label: 'Admin' },
  { value: 'org_data_entry', label: 'Data Entry' },
  { value: 'org_viewer', label: 'Viewer' },
];

export const roleLabel = (role) =>
  ORG_ROLES.find((r) => r.value === role)?.label || role;

export default adminApi;
