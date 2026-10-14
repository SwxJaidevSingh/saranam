import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  Building2,
  Plus,
  Search,
  Users,
  UserCircle,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { adminApi } from '../../api/admin';
import OrgFormModal from '../../components/admin/OrgFormModal';

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

export default function OrganizationsList() {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const loadOrgs = async () => {
    try {
      setError('');
      setIsLoading(true);
      const data = await adminApi.listOrgs();
      setOrgs(data.orgs || []);
    } catch (err) {
      console.error('Error loading hospitals:', err);
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Failed to load organisations'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrgs();
  }, []);

  const handleCreateSuccess = () => {
    setShowCreate(false);
    toast.success('Organisation created');
    loadOrgs();
  };

  const filteredOrgs = orgs.filter((org) => {
    // The internal org (CVRAMAN) is the platform's own dashboard, not a hospital
    // tenant — keep it out of the Manage Organisations list.
    if ((org.type || '').toLowerCase() === 'internal') return false;
    const term = searchTerm.toLowerCase();
    return (
      (org.name || '').toLowerCase().includes(term) ||
      (org.code || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <ToastContainer position="bottom-right" autoClose={3000} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Manage Organisations</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage organisations and their users
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Organisation
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="alert-danger flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Search */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/70" />
          <input
            type="text"
            placeholder="Search by name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Table / states */}
      {isLoading ? (
        <div className="card">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-secondary rounded animate-pulse" />
            ))}
          </div>
        </div>
      ) : filteredOrgs.length === 0 ? (
        <div className="card text-center py-12">
          <Building2 className="w-16 h-16 mx-auto text-muted-foreground/70 mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            No organisations found
          </h3>
          <p className="text-muted-foreground">
            {searchTerm
              ? 'Try adjusting your search terms'
              : 'Get started by creating your first organisation'}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="table">
              <thead>
                <tr>
                  <th>Organisation</th>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Members</th>
                  <th>Patients</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredOrgs.map((org) => (
                  <tr
                    key={org.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/manage-hospitals/${org.id}`)}
                  >
                    <td>
                      <div className="font-medium text-foreground">
                        {org.display_name || org.name}
                      </div>
                      {org.display_name && org.display_name !== org.name && (
                        <div className="text-sm text-muted-foreground">
                          {org.name}
                        </div>
                      )}
                    </td>
                    <td className="text-sm text-muted-foreground">{org.code}</td>
                    <td className="capitalize">
                      {(org.type || '').replace('_', ' ')}
                    </td>
                    <td>
                      <span className={`${statusBadgeClass(org.status)} capitalize`}>
                        {org.status || 'unknown'}
                      </span>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1 text-sm text-foreground">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        {org.member_count ?? 0}
                      </span>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1 text-sm text-foreground">
                        <UserCircle className="w-4 h-4 text-muted-foreground" />
                        {org.patient_count ?? 0}
                      </span>
                    </td>
                    <td>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && (
        <OrgFormModal
          onClose={() => setShowCreate(false)}
          onSuccess={handleCreateSuccess}
        />
      )}
    </div>
  );
}
