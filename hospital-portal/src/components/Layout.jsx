/**
 * App shell for protected routes.
 *
 *  - Header: active-org branding (logo / display_name / accent) + an org badge,
 *    the org switcher, and the user menu (logout).
 *  - Side nav (Sidebar), collapsible on mobile.
 *  - <Outlet/> for the routed page.
 *
 * Active-org gate: every route under this shell is org-scoped. While org context
 * loads we show a loader. If no active org is selected (and the caller is not a
 * platform admin in god view), we redirect to the Organization window
 * (/select-org) — scoped API calls would otherwise fail server-side.
 */
import { useState } from 'react'
import { Navigate, Outlet, useNavigate } from 'react-router-dom'
import { Building2, LogOut, Menu, Repeat, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useOrg } from '../context/OrgContext'
import OrgSwitcher from './OrgSwitcher'
import Sidebar from './Sidebar'
import { LoadingState, ErrorState } from './ui/States'

function Brand() {
  const { branding, isGodView } = useOrg()
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg text-white"
        style={{ backgroundColor: 'var(--accent-color)' }}
      >
        {branding.logoUrl ? (
          // eslint-disable-next-line jsx-a11y/img-redundant-alt
          <img
            src={branding.logoUrl}
            alt={`${branding.displayName} logo`}
            className="h-full w-full object-contain"
          />
        ) : (
          <Building2 className="h-5 w-5" />
        )}
      </div>
      <div className="leading-tight">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-foreground">
            {isGodView ? 'All organizations' : branding.displayName}
          </span>
          {isGodView && (
            <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              God view
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground">Hospital Portal</div>
      </div>
    </div>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()
  const { loading, error, needsOrgSelection, refresh } = useOrg()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const navigate = useNavigate()

  // No active org chosen yet -> send the user to the Organization window.
  // (Platform admins in god view do not trip this; needsOrgSelection is false
  // for them.) Wait for org context to finish loading first.
  if (!loading && !error && needsOrgSelection) {
    return <Navigate to="/select-org" replace />
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="flex h-16 items-center gap-3 px-4">
          <button
            type="button"
            className="btn-ghost p-2 md:hidden"
            onClick={() => setMobileNavOpen((o) => !o)}
            aria-label="Toggle navigation"
          >
            {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Brand />

          <div className="ml-auto flex items-center gap-3">
            <OrgSwitcher />
            <button
              type="button"
              className="btn-ghost hidden p-2 sm:inline-flex"
              onClick={() => navigate('/select-org')}
              title="Switch organization"
              aria-label="Switch organization"
            >
              <Repeat className="h-4 w-4" />
            </button>
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-foreground">
                {user?.full_name || user?.email || 'User'}
              </div>
              {user?.email && user?.full_name && (
                <div className="text-xs text-muted-foreground">{user.email}</div>
              )}
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
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px]">
        {/* Sidebar — desktop */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 border-r border-border bg-card md:block">
          <Sidebar />
        </aside>

        {/* Sidebar — mobile overlay */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-30 md:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileNavOpen(false)}
              aria-hidden="true"
            />
            <aside className="absolute left-0 top-16 h-[calc(100vh-4rem)] w-64 border-r border-border bg-card shadow-hard">
              <Sidebar onNavigate={() => setMobileNavOpen(false)} />
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          {loading ? (
            <LoadingState label="Loading your organizations…" />
          ) : error ? (
            <ErrorState message={error} onRetry={refresh} />
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  )
}
