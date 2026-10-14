/**
 * MembersTable — org members with inline role change + activate/deactivate.
 *
 * Org-admin only (the backend enforces; the UI reflects it). All mutations go
 * through PATCH /portal/members/:id (members API). The backend refuses to remove
 * the LAST active org_admin (409 'last_admin') — we surface that as a toast.
 */
import { useState } from 'react'
import { Loader2, UserCheck, UserX } from 'lucide-react'
import { toast } from 'react-toastify'
import { membersApi, MEMBER_ROLES, MEMBER_ROLE_LABELS } from '../../api/members'
import { parseApiError } from '../../utils/apiError'
import { formatDate } from '../../utils/format'

export default function MembersTable({ members, canManage, currentUserId, onChanged }) {
  // membership_id currently being patched (disables its row controls).
  const [busyId, setBusyId] = useState(null)

  const patch = async (membershipId, body) => {
    setBusyId(membershipId)
    try {
      await membersApi.update(membershipId, body)
      toast.success('Member updated')
      if (onChanged) await onChanged()
    } catch (err) {
      const { message } = parseApiError(err, 'Failed to update member')
      toast.error(message)
    } finally {
      setBusyId(null)
    }
  }

  if (!members.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No members yet.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Joined</th>
            {canManage && <th className="text-right">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const isBusy = busyId === m.membership_id
            const isSelf = currentUserId && m.user_id === currentUserId
            return (
              <tr key={m.membership_id}>
                <td className="font-medium text-foreground">
                  {m.full_name || '—'}
                  {isSelf && <span className="ml-2 badge-gray">You</span>}
                </td>
                <td className="text-muted-foreground">{m.email || '—'}</td>
                <td>
                  {canManage ? (
                    <select
                      className="input py-1"
                      value={m.role}
                      disabled={isBusy}
                      onChange={(e) => patch(m.membership_id, { role: e.target.value })}
                      aria-label={`Role for ${m.full_name || m.email}`}
                    >
                      {MEMBER_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {MEMBER_ROLE_LABELS[r] || r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>{MEMBER_ROLE_LABELS[m.role] || m.role}</span>
                  )}
                </td>
                <td>
                  {m.is_active ? (
                    <span className="badge-success">Active</span>
                  ) : (
                    <span className="badge-gray">Inactive</span>
                  )}
                </td>
                <td className="text-muted-foreground">{formatDate(m.joined_at)}</td>
                {canManage && (
                  <td className="text-right">
                    <button
                      type="button"
                      className={m.is_active ? 'btn-outline py-1' : 'btn-brand py-1'}
                      disabled={isBusy}
                      onClick={() => patch(m.membership_id, { is_active: !m.is_active })}
                    >
                      {isBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : m.is_active ? (
                        <>
                          <UserX className="h-4 w-4" /> Deactivate
                        </>
                      ) : (
                        <>
                          <UserCheck className="h-4 w-4" /> Activate
                        </>
                      )}
                    </button>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
