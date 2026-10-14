import { useState, useEffect } from 'react';
import { Users, Search, Shield, Check, X, Edit, UserPlus, Mail, AlertCircle } from 'lucide-react';
import { usersApi } from '../../api/users';
import EditUserModal from '../../components/users/EditUserModal';
import CreateUserModal from '../../components/users/CreateUserModal';
import InviteUserModal from '../../components/users/InviteUserModal';

export default function UsersList() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all'); // all, pending, active, inactive
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setError('');
      const data = await usersApi.getAllUsers();
      setUsers(data.users || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load users');
      console.error('Error loading users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (userId) => {
    try {
      const response = await usersApi.approveUser(userId);
      setUsers(
        users.map((u) =>
          u.id === userId ? response.user : u
        )
      );
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to approve user';
      alert(message);
      console.error('Error approving user:', err);
    }
  };

  const handleReject = async (userId) => {
    if (!window.confirm('Are you sure you want to reject this user? This will deactivate their account.')) return;

    try {
      const response = await usersApi.rejectUser(userId);
      // Update the user in the list (soft delete - user remains but is inactive and unapproved)
      setUsers(
        users.map((u) =>
          u.id === userId ? response.user : u
        )
      );
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to reject user';
      alert(message);
      console.error('Error rejecting user:', err);
    }
  };

  const handleToggleActive = async (userId, currentStatus) => {
    try {
      const response = await usersApi.toggleUserStatus(userId);
      setUsers(
        users.map((u) =>
          u.id === userId ? response.user : u
        )
      );
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to update user status';
      alert(message);
      console.error('Error updating user:', err);
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
  };

  const handleCloseEditModal = () => {
    setEditingUser(null);
  };

  const handleEditSuccess = () => {
    handleCloseEditModal();
    loadUsers(); // Reload the users list
  };

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    loadUsers();
  };

  const handleInviteSuccess = () => {
    setShowInviteModal(false);
    loadUsers();
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      filter === 'all' ||
      (filter === 'pending' && !user.is_approved) ||
      (filter === 'active' && user.is_active && user.is_approved) ||
      (filter === 'inactive' && !user.is_active);

    return matchesSearch && matchesFilter;
  });

  const pendingCount = users.filter((u) => !u.is_approved).length;

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'admin':
        return 'badge-danger';
      case 'doctor':
        return 'badge-primary';
      case 'nurse':
        return 'badge-success';
      case 'physiotherapist':
      case 'counsellor':
        return 'badge-warning';
      case 'data_entry':
        return 'badge-info';
      default:
        return 'badge-gray';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">Users</h1>
            {pendingCount > 0 && (
              <span className="badge-warning px-3 py-1">
                {pendingCount} pending approval
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            Manage user accounts and permissions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-secondary transition-colors"
          >
            <Mail className="w-4 h-4" /> Invite User
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <UserPlus className="w-4 h-4" /> Create User
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert-danger flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters */}
      <div className="card space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/70" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input"
          >
            <option value="all">All Users</option>
            <option value="pending">Pending Approval</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      {isLoading ? (
        <div className="card">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-secondary rounded animate-pulse" />
            ))}
          </div>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="card text-center py-12">
          <Users className="w-16 h-16 mx-auto text-muted-foreground/70 mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No users found</h3>
          <p className="text-muted-foreground">
            {searchTerm ? 'Try adjusting your search terms' : 'No users match the selected filter'}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div>
                        <div className="font-medium text-foreground">{user.full_name}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </td>
                    <td>
                      <span className={`${getRoleBadgeClass(user.role)} capitalize`}>
                        {user.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {!user.is_approved ? (
                          <span className="badge-warning">Pending Approval</span>
                        ) : user.is_active ? (
                          <span className="badge-success">Active</span>
                        ) : (
                          <span className="badge-gray">Inactive</span>
                        )}
                      </div>
                    </td>
                    <td className="text-sm text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {!user.is_approved ? (
                          <>
                            <button
                              onClick={() => handleApprove(user.id)}
                              className="btn-ghost flex items-center gap-1 text-sm text-success-600 hover:bg-success-50"
                              title="Approve user"
                            >
                              <Check className="w-4 h-4" />
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(user.id)}
                              className="btn-ghost flex items-center gap-1 text-sm text-danger-600 hover:bg-danger-50"
                              title="Reject user"
                            >
                              <X className="w-4 h-4" />
                              Reject
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleToggleActive(user.id, user.is_active)}
                              className={`btn-ghost flex items-center gap-1 text-sm ${user.is_active
                                  ? 'text-warning-600 hover:bg-warning-50'
                                  : 'text-success-600 hover:bg-success-50'
                                }`}
                              title={user.is_active ? 'Deactivate' : 'Activate'}
                            >
                              <Shield className="w-4 h-4" />
                              {user.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              onClick={() => handleEditUser(user)}
                              className="btn-ghost flex items-center gap-1 text-sm"
                              title="Edit user"
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={handleCloseEditModal}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {/* Invite User Modal */}
      {showInviteModal && (
        <InviteUserModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={handleInviteSuccess}
        />
      )}
    </div>
  );
}
