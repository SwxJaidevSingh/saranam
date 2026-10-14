/**
 * AcceptInvite — PUBLIC page for route /accept-invite?token=…
 *
 * Reads the one-time `token` from the URL, collects a password (+ optional
 * display name), and POSTs to /portal/invites/accept. On success the backend
 * returns fresh tokens + the joined org, so we sign the user in (persist tokens
 * + active org) and route into the app. Any invalid/expired/used token collapses
 * to one generic error (the backend never reveals which) — we mirror that here.
 *
 * This route is intentionally OUTSIDE the authenticated shell: an invitee may
 * not have an account yet. The accept endpoint requires no Authorization header.
 */
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Building2, CheckCircle2, Loader2, Lock, User } from 'lucide-react'
import { toast } from 'react-toastify'
import { invitesApi } from '../api/invites'
import { tokenStore, orgStore } from '../api/storage'

export default function AcceptInvite() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = useMemo(() => params.get('token') || '', [params])

  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const GENERIC_ERROR = 'This invitation is invalid or has expired.'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!token) {
      setError(GENERIC_ERROR)
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      const res = await invitesApi.accept({
        token,
        password,
        full_name: fullName.trim() || undefined,
      })

      // The accept response signs the invitee in. Persist tokens + the joined
      // org so the app loads scoped to it immediately.
      tokenStore.setTokens({
        access_token: res.access_token,
        refresh_token: res.refresh_token,
      })
      if (res.user) tokenStore.setUser(res.user)
      if (res.organization_id) orgStore.set(res.organization_id)

      setDone(true)
      toast.success('Invitation accepted')
      // Full reload at the app root so Auth/Org contexts re-bootstrap with the
      // freshly stored tokens (they read localStorage on mount).
      setTimeout(() => {
        window.location.assign('/patients')
      }, 1200)
    } catch (err) {
      // Generic message for any not-found/expired/used case (no enumeration).
      const status = err?.response?.status
      const validationMsg = err?.response?.data?.errors
        ? 'Please check the form and try again.'
        : null
      setError(status === 400 && validationMsg ? validationMsg : GENERIC_ERROR)
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl text-white"
            style={{ backgroundColor: 'var(--accent-color)' }}
          >
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-foreground">Accept your invitation</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Set a password to join your organization’s portal.
          </p>
        </div>

        {done ? (
          <div className="card flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="h-10 w-10 text-success-600" />
            <p className="text-sm text-foreground">
              Your invitation has been accepted. Taking you to the portal…
            </p>
          </div>
        ) : !token ? (
          <div className="card space-y-4 text-center">
            <div className="alert-danger" role="alert">
              {GENERIC_ERROR}
            </div>
            <Link to="/login" className="btn-outline w-full">
              Go to sign in
            </Link>
          </div>
        ) : (
          <form className="card space-y-5" onSubmit={handleSubmit} noValidate>
            {error && (
              <div className="alert-danger" role="alert">
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="full_name" className="form-label">
                Your name <span className="text-muted-foreground">(optional)</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <User className="h-4 w-4 text-muted-foreground/70" />
                </span>
                <input
                  id="full_name"
                  type="text"
                  className="input pl-10"
                  placeholder="Jane Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={submitting}
                  autoComplete="name"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-4 w-4 text-muted-foreground/70" />
                </span>
                <input
                  id="password"
                  type="password"
                  required
                  className="input pl-10"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirm" className="form-label">
                Confirm password
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-4 w-4 text-muted-foreground/70" />
                </span>
                <input
                  id="confirm"
                  type="password"
                  required
                  className="input pl-10"
                  placeholder="Re-enter your password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={submitting}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button type="submit" className="btn-brand w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Joining…
                </>
              ) : (
                'Accept invitation'
              )}
            </button>

            <p className="text-center text-xs text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="font-medium" style={{ color: 'var(--accent-color)' }}>
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
