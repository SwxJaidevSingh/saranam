import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  ArrowLeft,
  Building2,
  Pencil,
  UserPlus,
  Mail,
  Users,
  AlertCircle,
  Trash2,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react';
import { adminApi, ORG_ROLES, roleLabel } from '../../api/admin';
import OrgFormModal from '../../components/admin/OrgFormModal';
import CreateUserModal from '../../components/admin/CreateUserModal';
import InviteUserModal from '../../components/admin/InviteUserModal';

const statusBadgeClass = (status) => {
  switch (status) {
    case 'active':
      return 'badge-success';
    case 'inactive':
      return 'badge-gray';
    case 'suspended':
      return 'badge-danger';
    default:
      return 'badge-gray';
  }
};

export default function OrganizationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [org, setOrg] = useState(null);
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [showEdit, setShowEdit] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      setError('');
      setIsLoading(true);
      const [orgRes, memberRes, inviteRes] = await Promise.all([
        adminApi.getOrg(id),
        adminApi.listMembers(id),
        adminApi.listInvites(id),
      ]);
      setOrg(orgRes.org || orgRes);
      setMembers(memberRes.members || []);
      setInvites(inviteRes.invites || []);
    } catch (err) {
      console.error('Error loading hospital:', err);
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Failed to load organisation'
      );
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleEditSuccess = () => {
    setShowEdit(false);
    toast.success('Organisation updated');
    loadAll();
  };

  const handleCreateUserSuccess = () => {
    setShowCreateUser(false);
    toast.success('User created');
    loadAll();
  };

  const handleInviteSuccess = () => {
    setShowInvite(false);
    toast.success('Invitation sent');
    loadAll();
  };

  const handleRoleChange = async (member, role) => {
    if (role === member.role) return;
    try {
      await adminApi.updateMember(member.id, { role });
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, role } : m))
      );
      toast.success('Role updated');
    } catch (err) {
      console.error('Failed to update role:', err);
      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Failed to update role'
      );
    }
  };

  const handleToggleActive = async (member) => {
    const next = !member.is_active;
    try {
      await adminApi.updateMember(member.id, { is_active: next });
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, is_active: next } : m))
      );
      toast.success(next ? 'Member activated' : 'Member deactivated');
    } catch (err) {
      console.error('Failed to update member:', err);
      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Failed to update member'
      );
    }
  };

  const handleRevokeInvite = async (invite) => {
    if (!window.confirm(`Revoke the invitation to ${invite.email}?`)) return;
    try {
      await adminApi.revokeInvite(invite.id);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      toast.success('Invitation revoked');
    } catch (err) {
      console.error('Failed to revoke invite:', err);
      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Failed to revoke invite'
      );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-secondary rounded animate-pulse" />
        <div className="card">
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 bg-secondary rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !org) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/manage-hospitals')}
          className="btn-ghost flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Organisations
        </button>
        <div className="alert-danger flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastContainer position="bottom-right" autoClose={3000} />

      {/* Back */}
      <button
        onClick={() => navigate('/manage-hospitals')}
        className="btn-ghost flex items-center gap-2 text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Organisations
      </button>

      {/* Org header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-lg bg-primary/10">
            <Building2 className="w-7 h-7 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground">
                {org?.display_name || org?.name}
              </h1>
              <span className={`${statusBadgeClass(org?.status)} capitalize`}>
                {org?.status || 'unknown'}
              </span>
            </div>
            <p className="text-muted-foreground mt-1">
              Code: <span className="font-medium">{org?.code}</span>
              {' · '}
              <span className="capitalize">
                {(org?.type || '').replace('_', ' ')}
              </span>
              {org?.linked_hospital_code && (
                <>
                  {' · '}Linked: {org.linked_hospital_code}
                </>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowEdit(true)}
          className="btn-secondary flex items-center gap-2"
        >
          <Pencil className="h-4 w-4" />
          Edit
        </button>
      </div>

      {/* Members panel */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">
              Members ({members.length})
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInvite(true)}
              className="btn-ghost flex items-center gap-2 text-sm"
            >
              <Mail className="h-4 w-4" />
              Invite User
            </button>
            <button
              onClick={() => setShowCreateUser(true)}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <UserPlus className="h-4 w-4" />
              Create User
            </button>
          </div>
        </div>

        {members.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 mx-auto text-muted-foreground/70 mb-3" />
            <p className="text-muted-foreground">No members yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="font-medium text-foreground">
                        {member.full_name || '—'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {member.email}
                      </div>
                    </td>
                    <td>
                      <select
                        value={member.role}
                        onChange={(e) =>
                          handleRoleChange(member, e.target.value)
                        }
                        className="input py-1 w-40"
                      >
                        {ORG_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {member.is_active ? (
                        <span className="badge-success">Active</span>
                      ) : (
                        <span className="badge-gray">Inactive</span>
                      )}
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleActive(member)}
                        className={`btn-ghost flex items-center gap-1 text-sm ${
                          member.is_active
                            ? 'text-warning-600 hover:bg-warning-50'
                            : 'text-success-600 hover:bg-success-50'
                        }`}
                        title={member.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {member.is_active ? (
                          <ShieldOff className="w-4 h-4" />
                        ) : (
                          <ShieldCheck className="w-4 h-4" />
                        )}
                        {member.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending invites panel */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center gap-2 p-6 border-b border-border">
          <Mail className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">
            Pending Invites ({invites.length})
          </h2>
        </div>

        {invites.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-muted-foreground">No pending invites.</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Invited</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((invite) => (
                  <tr key={invite.id}>
                    <td className="text-foreground">{invite.email}</td>
                    <td>
                      <span className="badge-primary">
                        {roleLabel(invite.role)}
                      </span>
                    </td>
                    <td className="text-sm text-muted-foreground">
                      {invite.created_at
                        ? new Date(invite.created_at).toLocaleDateString()
                        : '—'}
                    </td>
                    <td>
                      <button
                        onClick={() => handleRevokeInvite(invite)}
                        className="btn-ghost flex items-center gap-1 text-sm text-danger-600 hover:bg-danger-50"
                        title="Revoke invite"
                      >
                        <Trash2 className="w-4 h-4" />
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showEdit && org && (
        <OrgFormModal
          org={org}
          onClose={() => setShowEdit(false)}
          onSuccess={handleEditSuccess}
        />
      )}
      {showCreateUser && (
        <CreateUserModal
          orgId={id}
          onClose={() => setShowCreateUser(false)}
          onSuccess={handleCreateUserSuccess}
        />
      )}
      {showInvite && (
        <InviteUserModal
          orgId={id}
          onClose={() => setShowInvite(false)}
          onSuccess={handleInviteSuccess}
        />
      )}
    </div>
  );
}
