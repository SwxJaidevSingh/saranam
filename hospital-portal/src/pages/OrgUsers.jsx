/**
 * OrgUsers — manage the active organization's members and invitations.
 *
 * Consumes the Wave 2 backend (members + invites routes), all org-scoped via the
 * X-Org-Id header (../api/client). These are ORG ADMIN actions; the backend
 * enforces it and the UI reflects it:
 *   - org admins (role_in_org === 'org_admin') and platform admins see the
 *     invite form + management controls.
 *   - everyone else sees a read-only members list and an access note.
 *
 *   GET    /portal/members              -> members table (role change / activate)
 *   PATCH  /portal/members/:id
 *   POST   /portal/invites              -> invite form
 *   GET    /portal/invites              -> pending invites table (revoke)
 *   DELETE /portal/invites/:id
 *
 * A platform admin in "All organizations" (god) view has no concrete org to
 * scope to — we ask them to pick one from the switcher first.
 */
import { useCallback, useEffect, useState } from 'react'
import { Mail, RefreshCw, Users } from 'lucide-react'
import { membersApi } from '../api/members'
import { invitesApi } from '../api/invites'
import { useOrg } from '../context/OrgContext'
import { useAuth } from '../context/AuthContext'
import { parseApiError } from '../utils/apiError'
import { LoadingState, ErrorState } from '../components/ui/States'
import MembersTable from '../components/org-users/MembersTable'
import InviteForm from '../components/org-users/InviteForm'
import InvitesTable from '../components/org-users/InvitesTable'

export default function OrgUsers() {
  const { user } = useAuth()
  const { roleInOrg, isPlatformAdmin, hasActiveOrg, isGodView, needsOrgSelection } = useOrg()

  const canManage = isPlatformAdmin || roleInOrg === 'org_admin'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Members + invites are both org-admin endpoints. Load members for
      // everyone with access; only managers can list invites (others get 403,
      // which we tolerate by leaving the invites list empty).
      const membersRes = await membersApi.list()
      setMembers(membersRes.members || [])

      try {
        const invitesRes = await invitesApi.list()
        setInvites(invitesRes.invites || [])
      } catch {
        // Non-admins cannot list invites — that's expected; leave empty.
        setInvites([])
      }
    } catch (err) {
      const { message } = parseApiError(err, 'Failed to load organization users')
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (hasActiveOrg) load()
    else setLoading(false)
  }, [hasActiveOrg, load])

  const header = (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-foreground">Organization users</h1>
        <p className="text-sm text-muted-foreground">
          Manage who can access this organization and invite new members.
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
      <div className="space-y-5">
        {header}
        <div className="alert-warning">
          {isGodView
            ? 'You are in “All organizations” view. Select a specific organization from the switcher to manage its users.'
            : 'Select an organization to manage its users.'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {header}

      {!canManage && (
        <div className="alert-info">
          You have read-only access to this organization’s members. Inviting users and changing
          roles is limited to organization admins.
        </div>
      )}

      {loading ? (
        <LoadingState label="Loading users…" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          {canManage && (
            <section className="card space-y-4">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-base font-semibold text-foreground">Invite a new member</h2>
              </div>
              <InviteForm onInvited={load} />
            </section>
          )}

          {canManage && (
            <section className="card space-y-4">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-base font-semibold text-foreground">Pending invitations</h2>
              </div>
              <InvitesTable invites={invites} onChanged={load} />
            </section>
          )}

          <section className="card space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">Members</h2>
            </div>
            <MembersTable
              members={members}
              canManage={canManage}
              currentUserId={user?.id}
              onChanged={load}
            />
          </section>
        </>
      )}
    </div>
  )
}
