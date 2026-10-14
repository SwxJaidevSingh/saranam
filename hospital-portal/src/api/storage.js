/**
 * Centralized localStorage keys + accessors.
 *
 * Token keys mirror the existing main `frontend/` app exactly so the two apps
 * share the same auth conventions (access_token / refresh_token / user).
 * `active_org_id` is portal-specific: the org the user is currently acting in,
 * sent as the X-Org-Id header on every /portal/* request.
 *
 * NOTE on platform-admin "god view": the sentinel value GOD_VIEW means the
 * platform admin explicitly chose "All orgs". In that mode we send NO X-Org-Id
 * header (unscoped reads). It is distinct from "nothing selected yet" (null).
 */
export const STORAGE_KEYS = {
  accessToken: 'access_token',
  refreshToken: 'refresh_token',
  user: 'user',
  activeOrgId: 'active_org_id',
}

// Sentinel for a platform admin acting unscoped across all orgs (no X-Org-Id).
export const GOD_VIEW = '__god_view__'

export const tokenStore = {
  getAccess: () => localStorage.getItem(STORAGE_KEYS.accessToken),
  getRefresh: () => localStorage.getItem(STORAGE_KEYS.refreshToken),

  setTokens: ({ access_token, refresh_token }) => {
    if (access_token) localStorage.setItem(STORAGE_KEYS.accessToken, access_token)
    if (refresh_token) localStorage.setItem(STORAGE_KEYS.refreshToken, refresh_token)
  },

  getUser: () => {
    const raw = localStorage.getItem(STORAGE_KEYS.user)
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  },
  setUser: (user) => localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user)),

  clear: () => {
    localStorage.removeItem(STORAGE_KEYS.accessToken)
    localStorage.removeItem(STORAGE_KEYS.refreshToken)
    localStorage.removeItem(STORAGE_KEYS.user)
    localStorage.removeItem(STORAGE_KEYS.activeOrgId)
  },
}

export const orgStore = {
  get: () => localStorage.getItem(STORAGE_KEYS.activeOrgId) || null,
  set: (orgId) => {
    if (orgId) localStorage.setItem(STORAGE_KEYS.activeOrgId, orgId)
    else localStorage.removeItem(STORAGE_KEYS.activeOrgId)
  },
  clear: () => localStorage.removeItem(STORAGE_KEYS.activeOrgId),
}
