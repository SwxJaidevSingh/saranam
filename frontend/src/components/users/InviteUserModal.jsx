import { useState } from 'react';
import { X, AlertCircle, CheckCircle } from 'lucide-react';
import { usersApi } from '../../api/users';

const MAIN_ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'nurse', label: 'Nurse' },
  { value: 'physiotherapist', label: 'Physiotherapist' },
  { value: 'counsellor', label: 'Counsellor' },
  { value: 'data_entry', label: 'Data Collector' },
];

/**
 * Invite a main-dashboard (platform) user by email + role. The invitee receives
 * an email link to set their password and the account is created on accept.
 */
export default function InviteUserModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({ email: '', role: 'data_entry' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sentMsg, setSentMsg] = useState(null);

  const handleChange = (field, value) => setFormData((p) => ({ ...p, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError(null);
      const res = await usersApi.inviteUser({ email: formData.email.trim(), role: formData.role });
      setSentMsg(res?.message || 'Invite sent');
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to send invite');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-border">
          <h2 className="text-2xl font-bold text-foreground">Invite User</h2>
          <button onClick={onClose} className="text-muted-foreground/70 hover:text-muted-foreground">
            <X className="h-6 w-6" />
          </button>
        </div>

        {sentMsg ? (
          <div className="p-6 space-y-4 text-center">
            <CheckCircle className="h-10 w-10 text-green-600 mx-auto" />
            <p className="text-sm text-muted-foreground">{sentMsg}</p>
            <button
              onClick={onSuccess}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="alert-danger flex items-start gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              They'll get an email link to set their password and join the
              <span className="font-medium text-foreground"> main dashboard</span>.
            </p>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="user@example.com"
                required
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Role *</label>
              <select
                value={formData.role}
                onChange={(e) => handleChange('role', e.target.value)}
                required
                className="input"
              >
                {MAIN_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
