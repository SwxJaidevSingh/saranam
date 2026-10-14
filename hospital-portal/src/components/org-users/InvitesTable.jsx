/**
 * InvitesTable — pending (unaccepted, unexpired) invites with a revoke action.
 * Org-admin only. Revoke -> DELETE /portal/invites/:id.
 */
import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'react-toastify'
import { invitesApi, INVITE_ROLE_LABELS } from '../../api/invites'
import { parseApiError } from '../../utils/apiError'
import { formatDate } from '../../utils/format'

export default function InvitesTable({ invites, onChanged }) {
  const [busyId, setBusyId] = useState(null)

  const revoke = async (inviteId) => {
    if (!window.confirm('Revoke this invitation? The emailed link will stop working.')) return
    setBusyId(inviteId)
    try {
      await invitesApi.revoke(inviteId)
      toast.success('Invitation revoked')
      if (onChanged) await onChanged()
    } catch (err) {
      const { message } = parseApiError(err, 'Failed to revoke invitation')
      toast.error(message)
    } finally {
      setBusyId(null)
    }
  }

  if (!invites.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No pending invitations.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th>Sent</th>
            <th>Expires</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {invites.map((i) => {
            const isBusy = busyId === i.id
            return (
              <tr key={i.id}>
                <td className="font-medium text-foreground">{i.email}</td>
                <td>{INVITE_ROLE_LABELS[i.role] || i.role}</td>
                <td className="text-muted-foreground">{formatDate(i.created_at)}</td>
                <td className="text-muted-foreground">{formatDate(i.expires_at)}</td>
                <td className="text-right">
                  <button
                    type="button"
                    className="btn-danger py-1"
                    disabled={isBusy}
                    onClick={() => revoke(i.id)}
                  >
                    {isBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" /> Revoke
                      </>
                    )}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
