/**
 * InviteForm — org-admin creates an invite (email + role) -> POST /portal/invites.
 * The backend emails the accept link; the raw token is never returned here.
 */
import { useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { toast } from 'react-toastify'
import { invitesApi, INVITE_ROLES, INVITE_ROLE_LABELS } from '../../api/invites'
import { parseApiError } from '../../utils/apiError'

export default function InviteForm({ onInvited }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('org_data_entry')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setSubmitting(true)
    try {
      await invitesApi.create({ email: email.trim(), role })
      toast.success('Invitation sent')
      setEmail('')
      setRole('org_data_entry')
      if (onInvited) await onInvited()
    } catch (err) {
      const { message } = parseApiError(err, 'Failed to send invitation')
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
      <div className="form-group mb-0 flex-1">
        <label htmlFor="invite-email" className="form-label">
          Email address
        </label>
        <input
          id="invite-email"
          type="email"
          required
          className="input"
          placeholder="colleague@hospital.org"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
        />
      </div>
      <div className="form-group mb-0 sm:w-48">
        <label htmlFor="invite-role" className="form-label">
          Role
        </label>
        <select
          id="invite-role"
          className="input"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={submitting}
        >
          {INVITE_ROLES.map((r) => (
            <option key={r} value={r}>
              {INVITE_ROLE_LABELS[r] || r}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="btn-brand" disabled={submitting || !email.trim()}>
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Sending…
          </>
        ) : (
          <>
            <Send className="h-4 w-4" /> Send invite
          </>
        )}
      </button>
    </form>
  )
}
