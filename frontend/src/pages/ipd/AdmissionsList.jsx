import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { useTheme } from '../../context/ThemeContext';
import {
  UserPlus,
  Filter,
  RefreshCw,
  Eye,
  FileText,
  Activity,
  Calendar
} from 'lucide-react';
import ipdApi from '../../api/ipd';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

export default function AdmissionsList() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [admissions, setAdmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || 'active',
    admission_type: '',
    admitting_doctor_id: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    perPage: 20,
    total: 0,
    totalPages: 0
  });

  useEffect(() => {
    loadAdmissions();
  }, [filters, pagination.page]);

  const loadAdmissions = async () => {
    try {
      setIsLoading(true);
      const data = await ipdApi.listAdmissions(filters, pagination.page, pagination.perPage);
      setAdmissions(data.admissions || []);
      setPagination(prev => ({
        ...prev,
        total: data.total,
        totalPages: data.total_pages
      }));
      setError(null);
    } catch (err) {
      console.error('Failed to load admissions:', err);
      setError('Failed to load admissions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));

    // Update URL params
    if (field === 'status') {
      setSearchParams({ status: value });
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: 'bg-green-500/10 text-green-600 dark:text-green-400',
      discharged: 'bg-secondary text-muted-foreground',
      'in-progress': 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
    };
    return badges[status] || 'bg-secondary text-muted-foreground';
  };

  const getAdmissionTypeBadge = (type) => {
    const badges = {
      emergency: 'bg-red-500/10 text-red-600 dark:text-red-400',
      elective: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      transfer: 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
    };
    return badges[type] || 'bg-secondary text-muted-foreground';
  };

  const columnDefs = [
    {
      headerName: 'Patient',
      field: 'patient_name',
      sortable: true,
      filter: true,
      width: 200,
      cellRenderer: (params) => (
        <div className="font-medium text-primary">{params.value || 'Unknown Patient'}</div>
      )
    },
    {
      headerName: 'Admission Type',
      field: 'admission_type',
      sortable: true,
      filter: true,
      width: 150,
      cellRenderer: (params) => (
        <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${getAdmissionTypeBadge(params.value)}`}>
          {params.value}
        </span>
      )
    },
    {
      headerName: 'Admission Date',
      field: 'admission_date',
      sortable: true,
      width: 150,
      cellRenderer: (params) => {
        if (!params.value) return <span className="text-muted-foreground/70">—</span>;
        const date = new Date(params.value);
        return (
          <div className="text-sm">
            <div>{date.toLocaleDateString()}</div>
            <div className="text-xs text-muted-foreground">{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        );
      }
    },
    {
      headerName: 'Bed',
      width: 120,
      cellRenderer: (params) => {
        if (params.data.current_bed) {
          return (
            <div className="text-sm">
              <div className="font-semibold">{params.data.current_bed.bed_number}</div>
              <div className="text-xs text-muted-foreground">{params.data.current_bed.ward_name}</div>
            </div>
          );
        }
        return <span className="text-muted-foreground/70">No bed</span>;
      }
    },
    {
      headerName: 'Admitting Doctor',
      field: 'admitting_doctor_name',
      sortable: true,
      width: 180,
      cellRenderer: (params) => params.value || <span className="text-muted-foreground/70">—</span>
    },
    {
      headerName: 'Diagnosis',
      field: 'admission_diagnosis',
      width: 200,
      cellRenderer: (params) => {
        if (!params.value) return <span className="text-muted-foreground/70">—</span>;
        return (
          <div className="text-sm truncate" title={params.value}>
            {params.value}
          </div>
        );
      }
    },
    {
      headerName: 'Length of Stay',
      field: 'length_of_stay_days',
      sortable: true,
      width: 130,
      cellRenderer: (params) => {
        if (params.value === undefined || params.value === null) {
          return <span className="text-muted-foreground/70">—</span>;
        }
        return (
          <div className="text-sm">
            <span className="font-semibold">{params.value}</span>{' '}
            <span className="text-muted-foreground">day{params.value !== 1 ? 's' : ''}</span>
          </div>
        );
      }
    },
    {
      headerName: 'Discharge Date',
      field: 'discharge_date',
      sortable: true,
      width: 150,
      cellRenderer: (params) => {
        if (!params.value) {
          return <span className="text-green-600 dark:text-green-400 font-medium">Active</span>;
        }
        const date = new Date(params.value);
        return (
          <div className="text-sm">
            <div>{date.toLocaleDateString()}</div>
            <div className="text-xs text-muted-foreground">{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        );
      }
    },
    {
      headerName: 'Actions',
      width: 150,
      cellRenderer: (params) => (
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/ipd/admissions/${params.data.id}`)}
            className="px-3 py-1 bg-primary text-primary-foreground text-xs rounded hover:bg-primary/90 flex items-center gap-1"
          >
            <Eye className="h-3 w-3" />
            View
          </button>
          {!params.data.discharge_date && (
            <button
              onClick={() => navigate(`/ipd/admissions/${params.data.id}/vitals`)}
              className="px-3 py-1 bg-green-600 dark:bg-green-500 text-white text-xs rounded hover:bg-green-700 dark:hover:bg-green-600 flex items-center gap-1"
            >
              <Activity className="h-3 w-3" />
              Vitals
            </button>
          )}
        </div>
      )
    }
  ];

  const defaultColDef = {
    resizable: true,
    sortable: true
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-8 w-8" />
            IPD Admissions
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage in-patient admissions and discharges
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadAdmissions}
            className="px-4 py-2 bg-secondary text-muted-foreground rounded-lg hover:bg-accent flex items-center gap-2"
          >
            <RefreshCw className="h-5 w-5" />
            Refresh
          </button>
          <Link
            to="/ipd/admissions/new"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2"
          >
            <UserPlus className="h-5 w-5" />
            Admit Patient
          </Link>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-500/10 border-2 border-blue-500/20 rounded-lg p-4">
          <div className="text-blue-600 dark:text-blue-400 text-sm font-medium">Active Admissions</div>
          <div className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-1">
            {filters.status === 'active' ? pagination.total : '—'}
          </div>
        </div>
        <div className="bg-green-500/10 border-2 border-green-500/20 rounded-lg p-4">
          <div className="text-green-600 dark:text-green-400 text-sm font-medium">Total Discharges</div>
          <div className="text-3xl font-bold text-green-900 dark:text-green-100 mt-1">
            {filters.status === 'discharged' ? pagination.total : '—'}
          </div>
        </div>
        <div className="bg-purple-500/10 border-2 border-purple-500/20 rounded-lg p-4">
          <div className="text-purple-600 dark:text-purple-400 text-sm font-medium">Avg Length of Stay</div>
          <div className="text-3xl font-bold text-purple-900 dark:text-purple-100 mt-1">
            {admissions.length > 0
              ? Math.round(
                  admissions.reduce((sum, a) => sum + (a.length_of_stay_days || 0), 0) /
                    admissions.filter(a => a.length_of_stay_days).length
                ) || '—'
              : '—'}{' '}
            <span className="text-sm font-normal">days</span>
          </div>
        </div>
        <div className="bg-orange-500/10 border-2 border-orange-500/20 rounded-lg p-4">
          <div className="text-orange-600 dark:text-orange-400 text-sm font-medium">Emergency Admissions</div>
          <div className="text-3xl font-bold text-orange-900 dark:text-orange-100 mt-1">
            {admissions.filter(a => a.admission_type === 'emergency').length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-lg shadow p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Filters</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="active">Active</option>
              <option value="discharged">Discharged</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Admission Type</label>
            <select
              value={filters.admission_type}
              onChange={(e) => handleFilterChange('admission_type', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Types</option>
              <option value="emergency">Emergency</option>
              <option value="elective">Elective</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilters({
                  status: 'active',
                  admission_type: '',
                  admitting_doctor_id: ''
                });
                setSearchParams({});
              }}
              className="px-4 py-2 bg-secondary text-muted-foreground rounded-lg hover:bg-accent w-full"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Admissions Grid */}
      <div className="bg-card rounded-lg shadow overflow-hidden">
        <div className={isDark ? "ag-theme-quartz-dark" : "ag-theme-quartz"} style={{ height: 600, width: '100%' }}>
          <AgGridReact
            rowData={admissions}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            pagination={false}
            loading={isLoading}
            overlayNoRowsTemplate="<span class='text-muted-foreground'>No admissions found</span>"
          />
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-between items-center p-4 border-t border-border">
            <div className="text-sm text-muted-foreground">
              Showing {admissions.length} of {pagination.total} admissions
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-3 py-1 bg-secondary rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-3 py-1">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1 bg-secondary rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
