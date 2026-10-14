/**
 * Organization selection window — the gate between login and the patient list.
 *
 * Flow: login -> /select-org (this page) -> pick an org -> /patients (scoped).
 *
 *  - Regular user, 1 org   -> OrgContext auto-selects it; this page redirects
 *                             straight through to /patients.
 *  - Regular user, N orgs  -> shows a card per membership; clicking one calls
 *                             switchOrg() (persists active_org_id => X-Org-Id)
 *                             then navigates to /patients.
 *  - Platform admin        -> shows every org from /org-directory PLUS an
 *                             "All organizations (god view)" card (no X-Org-Id).
 *
 * Selecting an org is the single action that sets the active org for the whole
 * session; the api client reads active_org_id from localStorage on every call.
 */
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Building2, Check, Globe, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useOrg } from '../context/OrgContext'
import { LoadingState, ErrorState } from '../components/ui/States'

function OrgCard({ name, code, role, accent, selected, onClick, icon: Icon = Building2 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex w-full items-center gap-4 rounded-xl border border-border bg-card p-5 text-left shadow-soft transition-all hover:border-transparent hover:shadow-medium focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white"
        style={{ backgroundColor: accent || 'var(--accent-color)' }}
      >
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-semibold text-foreground">{name}</div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          {code && <span className="font-mono">{code}</span>}
          {role && (
            <span className="rounded bg-secondary px-1.5 py-0.5 font-medium uppercase tracking-wide">
              {role.replace(/_/g, ' ')}
            </span>
          )}
        </div>
      </div>
      {selected ? (
        <Check className="h-5 w-5 shrink-0 text-brand" />
      ) : (
        <span className="text-xs font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
          Enter →
        </span>
      )}
    </button>
  )
}

export default function OrgSelect() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()

  // Where to land after an org is chosen: a preserved deep-link, else patients.
  const destination = location.state?.from?.pathname || location.state?.from || '/patients'
  const {
    loading,
    error,
    isPlatformAdmin,
    memberships,
    directory,
    activeOrgId,
    hasActiveOrg,
    isGodView,
    GOD_VIEW,
    switchOrg,
    refresh,
    loadDirectory,
  } = useOrg()

  const [entering, setEntering] = useState(null) // orgId currently being entered

  // Platform admins (and directory-enabled orgs) get the full org list to pick.
  useEffect(() => {
    if (isPlatformAdmin) loadDirectory()
  }, [isPlatformAdmin, loadDirectory])

  // If exactly one org is already resolved (single membership auto-selected, or
  // a previously chosen org), skip the window and go straight to patients.
  useEffect(() => {
    if (loading) return
    if (!isPlatformAdmin && memberships.length === 1 && hasActiveOrg) {
      navigate(destination, { replace: true })
    }
  }, [loading, isPlatformAdmin, memberships.length, hasActiveOrg, navigate, destination])

  const choose = async (orgId) => {
    setEntering(orgId)
    try {
      await switchOrg(orgId)
      navigate(destination, { replace: true })
    } finally {
      setEntering(null)
    }
  }

  // Platform-admin org list = directory; fall back to memberships if empty.
  const adminOrgs = useMemo(() => {
    if (directory.length) return directory.map((o) => ({ ...o }))
    return memberships.map((m) => ({
      id: m.organization_id,
      name: m.display_name || m.name,
      code: m.code,
    }))
  }, [directory, memberships])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState label="Loading your organizations…" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Choose an organization</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isPlatformAdmin
                ? 'Pick the organization you want to act in, or view all organizations.'
                : 'Select the organization whose patients you want to manage.'}
            </p>
          </div>
          <button
            type="button"
            className="btn-outline px-3 py-2 text-sm"
            onClick={logout}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>

        {user && (
          <p className="mb-4 text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{user.full_name || user.email}</span>
          </p>
        )}

        {error ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : (
          <div className="space-y-3">
            {/* Platform admin: god view + every org in the directory. */}
            {isPlatformAdmin && (
              <OrgCard
                name="All organizations"
                code="god view"
                icon={Globe}
                selected={isGodView}
                onClick={() => choose(GOD_VIEW)}
              />
            )}

            {(isPlatformAdmin ? adminOrgs : memberships).map((o) => {
              const orgId = o.organization_id || o.id
              const name = o.display_name || o.name
              return (
                <OrgCard
                  key={orgId}
                  name={name}
                  code={o.code}
                  role={o.role}
                  selected={orgId === activeOrgId}
                  onClick={() => choose(orgId)}
                />
              )
            })}

            {/* No orgs to show at all. */}
            {!isPlatformAdmin && memberships.length === 0 && (
              <div className="alert-warning">
                Your account is not a member of any organization yet. Ask your organization
                administrator to invite you, then sign in again.
              </div>
            )}

            {entering && (
              <p className="pt-2 text-center text-sm text-muted-foreground">Entering organization…</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
