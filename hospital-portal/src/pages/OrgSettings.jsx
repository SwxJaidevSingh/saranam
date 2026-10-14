/**
 * Org Settings (§5) — the active organization's profile.
 *
 *   GET /portal/org-settings           -> org profile (read-only + branding)
 *   PUT /portal/org-settings           -> update branding (org_admin only)
 *
 * The org IDENTITY (name, code, type, status, linked/origin hospital) is read-only
 * everywhere — it is managed by Saranam. Only BRANDING (display name, logo URL,
 * accent color) is editable, and only for org admins; everyone else sees branding
 * read-only too. Saving applies the new accent immediately (live theming via the
 * --accent-color CSS variable) and re-syncs org context so the header updates.
 *
 * A platform admin in "All organizations" (god) view has no concrete org to scope
 * to — we ask them to pick one from the switcher first.
 */
import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, Save, Settings } from 'lucide-react'
import { toast } from 'react-toastify'
import { orgSettingsApi } from '../api/orgSettings'
import { useOrg } from '../context/OrgContext'
import { parseApiError } from '../utils/apiError'
import { dash } from '../utils/format'
import { LoadingState, ErrorState } from '../components/ui/States'

const DEFAULT_ACCENT = '#0284c7'
const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

function applyAccent(color) {
  const accent = color && HEX_RE.test(color) ? color : DEFAULT_ACCENT
  document.documentElement.style.setProperty('--accent-color', accent)
}

export default function OrgSettings() {
  const { roleInOrg, isPlatformAdmin, hasActiveOrg, isGodView, needsOrgSelection, refresh } = useOrg()
  const canEdit = roleInOrg === 'org_admin'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [org, setOrg] = useState(null)

  // Editable branding form (only meaningful for org admins).
  const [form, setForm] = useState({ display_name: '', logo_url: '', accent_color: '' })
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState(null)

  const hydrateForm = (data) =>
    setForm({
      display_name: data?.display_name || '',
      logo_url: data?.logo_url || '',
      accent_color: data?.accent_color || '',
    })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await orgSettingsApi.get()
      setOrg(data)
      hydrateForm(data)
    } catch (err) {
      const { message } = parseApiError(err, 'Failed to load organization settings')
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (hasActiveOrg) load()
    else setLoading(false)
  }, [hasActiveOrg, load])

  const onField = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    if (fieldErrors) setFieldErrors(null)
  }

  const accentForPreview = HEX_RE.test(form.accent_color) ? form.accent_color : DEFAULT_ACCENT

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canEdit || saving) return
    setSaving(true)
    setFieldErrors(null)
    try {
      const payload = {
        display_name: form.display_name.trim() || null,
        logo_url: form.logo_url.trim() || null,
        accent_color: form.accent_color.trim() || null,
      }
      const updated = await orgSettingsApi.update(payload)
      setOrg(updated)
      hydrateForm(updated)
      applyAccent(updated.accent_color)
      toast.success('Branding updated')
      // Re-sync org context so the header logo/name/accent reflect the change.
      refresh()
    } catch (err) {
      const parsed = parseApiError(err, 'Failed to update branding')
      if (parsed.fieldErrors) setFieldErrors(parsed.fieldErrors)
      toast.error(parsed.message)
    } finally {
      setSaving(false)
    }
  }

  const header = (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-foreground">Organization settings</h1>
        <p className="text-sm text-muted-foreground">
          Your organization profile and branding.
        </p>
      </div>
      {hasActiveOrg && (
        <button type="button" className="btn-outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      )}
    </div>
  )

  // God view / no concrete org selected.
  if (needsOrgSelection || (isGodView && !hasActiveOrg)) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        {header}
        <div className="alert-warning">
          {isGodView
            ? 'You are in “All organizations” view. Select a specific organization from the switcher to view its settings.'
            : 'Select an organization to view its settings.'}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        {header}
        <div className="card">
          <LoadingState label="Loading settings…" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        {header}
        <div className="card">
          <ErrorState message={error} onRetry={load} />
        </div>
      </div>
    )
  }

  const linkedHospital = org?.linked_hospital_code

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {header}

      {/* Identity card — wholly read-only (managed by Saranam). */}
      <section className="card space-y-4">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Organization profile</h2>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg text-white"
            style={{ backgroundColor: accentForPreview }}
          >
            {org?.logo_url ? (
              <img
                src={org.logo_url}
                alt={`${org.display_name || org.name} logo`}
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="text-lg font-bold">
                {(org?.display_name || org?.name || 'O')[0]}
              </span>
            )}
          </div>
          <div>
            <div className="font-semibold text-foreground">
              {org?.display_name || org?.name || '—'}
            </div>
            <div className="text-xs text-muted-foreground">
              {[org?.code, org?.type].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
        </div>

        <dl className="divide-y divide-border text-sm">
          <div className="flex justify-between gap-4 py-2">
            <dt className="text-muted-foreground">Legal name</dt>
            <dd className="text-right text-foreground">{dash(org?.name)}</dd>
          </div>
          <div className="flex justify-between gap-4 py-2">
            <dt className="text-muted-foreground">Code</dt>
            <dd className="text-right font-mono text-xs text-foreground">{dash(org?.code)}</dd>
          </div>
          <div className="flex justify-between gap-4 py-2">
            <dt className="text-muted-foreground">Type</dt>
            <dd className="text-right text-foreground">{dash(org?.type)}</dd>
          </div>
          <div className="flex justify-between gap-4 py-2">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="text-right">
              {org?.status === 'active' ? (
                <span className="badge-success">Active</span>
              ) : (
                <span className="badge-gray">{dash(org?.status)}</span>
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-2">
            <dt className="text-muted-foreground">Linked / origin hospital</dt>
            <dd className="text-right font-mono text-xs text-foreground">{dash(linkedHospital)}</dd>
          </div>
        </dl>

        <p className="form-help">
          These details are managed by Saranam. Contact your Saranam administrator to change them.
        </p>
      </section>

      {/* Branding — editable by org admins only. */}
      <section className="card space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Branding</h2>
          <p className="text-sm text-muted-foreground">
            {canEdit
              ? 'Customize how your organization appears across the portal.'
              : 'Branding is set by your organization admin.'}
          </p>
        </div>

        {!canEdit && !isPlatformAdmin && (
          <div className="alert-info">
            You have read-only access. Editing branding is limited to organization admins.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="form-group mb-0">
            <label htmlFor="display_name" className="form-label">
              Display name
            </label>
            <input
              id="display_name"
              type="text"
              className={fieldErrors?.display_name ? 'input-error' : 'input'}
              placeholder="e.g. Saranam Care — North"
              value={form.display_name}
              onChange={onField('display_name')}
              disabled={!canEdit || saving}
            />
            {fieldErrors?.display_name && <p className="form-error">{fieldErrors.display_name}</p>}
          </div>

          <div className="form-group mb-0">
            <label htmlFor="logo_url" className="form-label">
              Logo URL
            </label>
            <input
              id="logo_url"
              type="url"
              className={fieldErrors?.logo_url ? 'input-error' : 'input'}
              placeholder="https://…/logo.png"
              value={form.logo_url}
              onChange={onField('logo_url')}
              disabled={!canEdit || saving}
            />
            {fieldErrors?.logo_url ? (
              <p className="form-error">{fieldErrors.logo_url}</p>
            ) : (
              <p className="form-help">A square image works best. Leave blank to use the initial.</p>
            )}
          </div>

          <div className="form-group mb-0">
            <label htmlFor="accent_color" className="form-label">
              Accent color
            </label>
            <div className="flex items-center gap-3">
              <input
                id="accent_color_picker"
                type="color"
                className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-border bg-background disabled:cursor-not-allowed disabled:opacity-50"
                value={accentForPreview}
                onChange={onField('accent_color')}
                disabled={!canEdit || saving}
                aria-label="Pick accent color"
              />
              <input
                id="accent_color"
                type="text"
                className={`max-w-[10rem] font-mono ${fieldErrors?.accent_color ? 'input-error' : 'input'}`}
                placeholder="#0284c7"
                value={form.accent_color}
                onChange={onField('accent_color')}
                disabled={!canEdit || saving}
              />
              <span
                className="inline-block h-9 w-9 rounded-lg border border-border"
                style={{ backgroundColor: accentForPreview }}
                aria-hidden="true"
              />
            </div>
            {fieldErrors?.accent_color ? (
              <p className="form-error">{fieldErrors.accent_color}</p>
            ) : (
              <p className="form-help">Used for buttons and highlights throughout the portal.</p>
            )}
          </div>

          {canEdit && (
            <div className="flex justify-end">
              <button type="submit" className="btn-brand" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" /> Save branding
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      </section>
    </div>
  )
}
