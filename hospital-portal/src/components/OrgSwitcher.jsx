/**
 * Active-organization switcher (header).
 *
 *  - 0 memberships, not platform admin  -> nothing to switch (hidden / notice).
 *  - 1 membership                       -> shows the org name, no dropdown.
 *  - >1 memberships                     -> dropdown to pick the active org.
 *  - platform admin                     -> dropdown including "All orgs (god view)".
 *
 * Selecting an org calls switchOrg(), which persists active_org_id (drives the
 * X-Org-Id header) and re-fetches branding/role.
 */
import { useEffect, useRef, useState } from 'react'
import { Building2, Check, ChevronDown, Globe } from 'lucide-react'
import { useOrg } from '../context/OrgContext'

export default function OrgSwitcher() {
  const {
    memberships,
    activeOrgId,
    isPlatformAdmin,
    isGodView,
    branding,
    GOD_VIEW,
    switchOrg,
  } = useOrg()

  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const options = [...memberships]
  const hasChoices = options.length > 1 || isPlatformAdmin

  const currentLabel = isGodView
    ? 'All organizations'
    : memberships.find((m) => m.organization_id === activeOrgId)?.display_name ||
      memberships.find((m) => m.organization_id === activeOrgId)?.name ||
      branding.displayName ||
      'Select organization'

  // Single, fixed org: render a static label (no dropdown).
  if (!hasChoices && options.length === 1) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-foreground">{currentLabel}</span>
      </div>
    )
  }

  if (!hasChoices && options.length === 0) {
    return (
      <div className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-800">
        No organization access
      </div>
    )
  }

  const choose = async (orgId) => {
    setOpen(false)
    if (orgId !== activeOrgId) await switchOrg(orgId)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {isGodView ? (
          <Globe className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Building2 className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="max-w-[12rem] truncate font-medium text-foreground">{currentLabel}</span>
        <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-50 mt-2 w-64 animate-fade-in rounded-lg border border-border bg-card p-1 shadow-medium"
        >
          {isPlatformAdmin && (
            <button
              type="button"
              role="option"
              aria-selected={isGodView}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
              onClick={() => choose(GOD_VIEW)}
            >
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">All organizations (god view)</span>
              {isGodView && <Check className="h-4 w-4 text-brand" />}
            </button>
          )}

          {options.length > 0 && isPlatformAdmin && (
            <div className="my-1 border-t border-border" />
          )}

          {options.map((m) => {
            const selected = m.organization_id === activeOrgId
            return (
              <button
                key={m.organization_id}
                type="button"
                role="option"
                aria-selected={selected}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => choose(m.organization_id)}
              >
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">
                  {m.display_name || m.name}
                  <span className="ml-1 text-xs text-muted-foreground">({m.code})</span>
                </span>
                {selected && <Check className="h-4 w-4 text-brand" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
