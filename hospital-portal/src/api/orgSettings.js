/**
 * Org Settings + Referral Feedback API (§5).
 *
 * All endpoints are org-scoped via the X-Org-Id header (attached by ../api/client).
 *
 *   GET /portal/org-settings
 *     -> the active org profile {
 *          id, code, name, display_name, type, status,
 *          linked_hospital_code, can_view_org_directory, show_referral_feedback,
 *          logo_url, accent_color, ...
 *        }
 *
 *   PUT /portal/org-settings   (org_admin only — everyone else gets 403)
 *     body { display_name?, logo_url?, accent_color? } -> the updated org.
 *     Only branding is editable; the rest is read-only (managed by Saranam).
 *
 *   GET /portal/referral-feedback?status=&page=&per_page=
 *     -> { counts: { total, active, inactive, deceased },
 *          patients: [{ id, full_name, care_status, is_deceased, date_of_death,
 *                       last_update, origin_type }],
 *          total, page, per_page, total_pages }
 *     403 { error: 'feedback_disabled' } when the org toggle is off.
 */
import apiClient from './client'

export const orgSettingsApi = {
  // The active org's profile (read-only fields + editable branding).
  get: async () => {
    const response = await apiClient.get('/portal/org-settings')
    return response.data
  },

  // Update editable branding only. patch: { display_name?, logo_url?, accent_color? }
  update: async (patch) => {
    const response = await apiClient.put('/portal/org-settings', patch)
    return response.data
  },
}

export const referralFeedbackApi = {
  // status: '' | 'active' | 'inactive' | 'deceased'
  list: async ({ status = '', page = 1, perPage = 20 } = {}) => {
    const params = { page, per_page: perPage }
    if (status) params.status = status
    const response = await apiClient.get('/portal/referral-feedback', { params })
    return response.data
  },
}

export default orgSettingsApi
