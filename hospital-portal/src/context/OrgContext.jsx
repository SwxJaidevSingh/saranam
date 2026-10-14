/**
 * Organization context — the core portal-specific logic.
 *
 * Responsibilities:
 *  1. After auth, GET /portal/orgs/me to load memberships + is_platform_admin.
 *  2. Resolve the ACTIVE org:
 *       - persisted active_org_id (localStorage) if still valid, else
 *       - exactly one membership  -> auto-select it, else
 *       - multiple memberships    -> leave unselected (user must pick), else
 *       - platform admin          -> default to GOD_VIEW (all orgs).
 *  3. Persist active_org_id so client.js attaches the right X-Org-Id header.
 *  4. Re-fetch /orgs/me after a switch to get that org's branding + role, and
 *     apply accent_color to the --accent-color CSS variable (live theming).
 *
 * The selected org id is the single source of truth for the X-Org-Id header
 * (read from localStorage inside the axios request interceptor).
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { orgsApi } from '../api/orgs'
import { orgStore, GOD_VIEW } from '../api/storage'
import { useAuth } from './AuthContext'

const OrgContext = createContext(null)

export const useOrg = () => {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be used within an OrgProvider')
  return ctx
}

const DEFAULT_ACCENT = '#0284c7'

function applyAccent(color) {
  const accent = color && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : DEFAULT_ACCENT
  document.documentElement.style.setProperty('--accent-color', accent)
}

export const OrgProvider = ({ children }) => {
  const { isAuthenticated } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [memberships, setMemberships] = useState([])
  const [activeOrg, setActiveOrg] = useState(null) // full org row (branding) when scoped
  const [activeOrgId, setActiveOrgId] = useState(orgStore.get())
  const [roleInOrg, setRoleInOrg] = useState(null)
  // Other orgs from /org-directory — used by the org-selection window so a
  // platform admin (typically no memberships) can pick a specific org to act in.
  const [directory, setDirectory] = useState([])

  // Fetch the caller's memberships + active-org context. Honors whatever
  // X-Org-Id is currently persisted (client.js attaches it).
  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await orgsApi.getMine()
      setIsPlatformAdmin(!!data.is_platform_admin)
      setMemberships(data.memberships || [])
      setActiveOrg(data.active_org || null)
      setRoleInOrg(data.role_in_org || null)

      const stored = orgStore.get()
      const membershipIds = (data.memberships || []).map((m) => m.organization_id)

      let resolved = null
      if (data.is_platform_admin) {
        // Keep an explicit prior choice (a specific org or god view); otherwise
        // default platform admins to the unscoped god view.
        resolved = stored || GOD_VIEW
      } else if (stored && membershipIds.includes(stored)) {
        resolved = stored
      } else if (membershipIds.length === 1) {
        // Exactly one org -> auto-select.
        resolved = membershipIds[0]
      } else {
        // Multiple orgs (or none): user must pick before scoped calls work.
        resolved = null
      }

      if (resolved !== stored) {
        orgStore.set(resolved)
        setActiveOrgId(resolved)
        const freshData = await orgsApi.getMine()
        setActiveOrg(freshData.active_org || null)
        setRoleInOrg(freshData.role_in_org || null)
        applyAccent(freshData.active_org?.accent_color)
      } else {
        orgStore.set(resolved)
        setActiveOrgId(resolved)
        applyAccent(data.active_org?.accent_color)
      }
    } catch (err) {
      // KNOWN BACKEND CONSTRAINT: GET /portal/orgs/me is gated by @portal_auth(),
      // which requires X-Org-Id for non-platform-admins (400 'org_required').
      // A regular user who has not yet selected an org therefore cannot bootstrap
      // their membership list from this endpoint. We surface a clear, actionable
      // message instead of a generic failure. (See README review notes.)
      const status = err.response?.status
      const code = err.response?.data?.error
      if (status === 400 && code === 'org_required') {
        setError(
          'Your account needs an active organization selected to continue. ' +
            'If you belong to multiple organizations, this requires the backend ' +
            'org-context endpoint to allow listing memberships without X-Org-Id.',
        )
      } else if (status === 403) {
        setError('You do not have access to this organization.')
      } else {
        setError(err.response?.data?.message || 'Failed to load organization context')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      refresh()
    } else {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  // Load the org directory (other orgs) for the selection window. Only useful
  // for platform admins or orgs with the directory toggle on; failures are
  // swallowed (the window still works off memberships alone).
  const loadDirectory = useCallback(async () => {
    try {
      const data = await orgsApi.getDirectory()
      setDirectory(data.organizations || [])
    } catch {
      setDirectory([])
    }
  }, [])

  // Switch the active org. Persist immediately so the next request carries the
  // right X-Org-Id, then re-fetch /orgs/me to pull the new org's branding/role.
  const switchOrg = useCallback(
    async (orgId) => {
      orgStore.set(orgId)
      setActiveOrgId(orgId)
      // Optimistic accent from the known membership/god view; refresh confirms.
      if (orgId === GOD_VIEW || !orgId) applyAccent(null)
      await refresh()
    },
    [refresh],
  )

  // Branding shown in the header. Falls back to the portal default brand.
  const branding = {
    displayName: activeOrg?.display_name || activeOrg?.name || 'Hospital Portal',
    logoUrl: activeOrg?.logo_url || null,
    accentColor: activeOrg?.accent_color || DEFAULT_ACCENT,
  }

  // True when a concrete org is selected (scoped calls will succeed). For
  // regular users with multiple orgs and none chosen, this is false.
  const isGodView = isPlatformAdmin && (!activeOrgId || activeOrgId === GOD_VIEW)
  const hasActiveOrg = !!activeOrgId && activeOrgId !== GOD_VIEW
  const needsOrgSelection = !loading && !hasActiveOrg && !isGodView

  const value = {
    loading,
    error,
    isPlatformAdmin,
    memberships,
    directory,
    activeOrg,
    activeOrgId,
    roleInOrg,
    branding,
    isGodView,
    hasActiveOrg,
    needsOrgSelection,
    GOD_VIEW,
    switchOrg,
    refresh,
    loadDirectory,
  }

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}
