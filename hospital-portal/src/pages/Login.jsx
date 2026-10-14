/**
 * Login page. Uses the shared /auth/login endpoint via AuthContext, then
 * redirects to the Organization window (/select-org), where the user picks the
 * org to act in before reaching the org-scoped patient list. If the user was
 * deep-linking to a protected page, that destination is preserved and applied
 * once an org is active.
 */
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Building2, Loader2, Lock, Mail } from 'lucide-react'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Always route through the Organization window after login. A deep-link
  // destination (if any) is stashed so /select-org can return there once an
  // org is active.
  const from = location.state?.from?.pathname || null

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
    if (error) setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await login(form.email, form.password)
    if (result.success) {
      toast.success('Signed in')
      navigate('/select-org', { replace: true, state: from ? { from } : undefined })
    } else {
      setError(result.error)
      setLoading(false)
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
          <h1 className="mt-4 text-2xl font-bold text-foreground">Hospital Portal</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to manage patients and referrals</p>
        </div>

        <form className="card space-y-5" onSubmit={handleSubmit} noValidate>
          {error && <div className="alert-danger" role="alert">{error}</div>}

          <div className="form-group">
            <label htmlFor="email" className="form-label">Email address</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Mail className="h-4 w-4 text-muted-foreground/70" />
              </span>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="input pl-10"
                placeholder="you@hospital.org"
                value={form.email}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">Password</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Lock className="h-4 w-4 text-muted-foreground/70" />
              </span>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="input pl-10"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
          </div>

          <button type="submit" className="btn-brand w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Access is managed by your organization administrator.
        </p>
      </div>
    </div>
  )
}
