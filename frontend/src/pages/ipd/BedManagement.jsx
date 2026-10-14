import { useState, useEffect, useCallback, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { useTheme } from '../../context/ThemeContext';
import {
  BedDouble,
  Plus,
  Filter,
  RefreshCw,
  ChevronRight,
  Search,
  Check,
  X,
  Home,
  Building2,
  Layers,
  Activity,
  Users,
  ArrowRight,
  Sparkles,
  Zap,
  Wind
} from 'lucide-react';
import ipdApi from '../../api/ipd';
import BedAssignDialog from '../../components/ipd/BedAssignDialog';
import BedTransferDialog from '../../components/ipd/BedTransferDialog';
import CreateBedDialog from '../../components/ipd/CreateBedDialog';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

// Enhanced Status Badge Component with icons and animations
const BedStatusRenderer = ({ value }) => {
  const statusConfig = {
    available: {
      color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      label: 'Available',
      icon: <Check className="h-3 w-3" />
    },
    occupied: {
      color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      label: 'Occupied',
      icon: <Users className="h-3 w-3" />
    },
    cleaning: {
      color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      label: 'Cleaning',
      icon: <Sparkles className="h-3 w-3" />
    },
    maintenance: {
      color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
      label: 'Maintenance',
      icon: <Activity className="h-3 w-3" />
    },
    reserved: {
      color: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
      label: 'Reserved',
      icon: <Layers className="h-3 w-3" />
    }
  };
  const config = statusConfig[value] || {
    color: 'bg-secondary text-muted-foreground border-border',
    label: value,
    icon: null
  };

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${config.color} shadow-sm font-semibold text-xs capitalize transition-all hover:scale-105 hover:shadow-md`}>
      {config.icon}
      {config.label}
    </div>
  );
};

// Enhanced Hardware Indicator with better visuals
const HardwareIndicator = ({ value }) => (
  <div className="flex justify-center items-center h-full">
    {value ? (
      <div className="relative group">
        <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center shadow-lg transition-all group-hover:shadow-xl group-hover:scale-110">
          <Check className="h-4 w-4 text-primary-foreground font-bold" strokeWidth={3} />
        </div>
        <div className="absolute inset-0 rounded-lg bg-primary/20 opacity-20 blur-sm"></div>
      </div>
    ) : (
      <div className="h-7 w-7 rounded-lg bg-secondary flex items-center justify-center border border-border">
        <X className="h-3.5 w-3.5 text-muted-foreground/70" strokeWidth={2} />
      </div>
    )}
  </div>
);

// Enhanced Bed Number Renderer
const BedNumberRenderer = ({ value }) => (
  <div className="flex items-center gap-2 h-full">
    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary shadow-lg">
      <BedDouble className="h-4 w-4 text-primary-foreground" />
    </div>
    <span className="font-bold text-foreground">{value}</span>
  </div>
);

// Enhanced Location Renderer
const LocationRenderer = ({ data }) => (
  <div className="flex flex-col gap-0.5 py-1">
    <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
      <Home className="h-3.5 w-3.5 text-muted-foreground" />
      {data.ward_name}
    </div>
    {data.room_number && (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Building2 className="h-3 w-3" />
        Room {data.room_number}
      </div>
    )}
  </div>
);

// Enhanced Patient Renderer
const PatientRenderer = ({ data }) => {
  if (!data.current_patient) {
    return <span className="text-muted-foreground/70 italic text-sm">No patient</span>;
  }

  return (
    <div className="flex flex-col gap-0.5 py-1">
      <div className="font-semibold text-primary text-sm">{data.current_patient.patient_name}</div>
      <div className="text-xs text-muted-foreground">
        Since {new Date(data.current_patient.assigned_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        })}
      </div>
    </div>
  );
};

// Enhanced Actions Renderer with better button styling
const ActionsRenderer = ({ data, handleAssign, handleTransfer, handleRelease, handleMarkAvailable }) => {
  const status = data.bed_status;

  return (
    <div className="flex gap-2 items-center h-full py-2">
      {status === 'available' && (
        <button
          onClick={() => handleAssign(data)}
          className="group flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-lg transition-all shadow-md hover:shadow-lg hover:scale-105 flex items-center justify-center gap-1.5"
        >
          <Users className="h-3.5 w-3.5" />
          Assign
          <ArrowRight className="h-3 w-3 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all" />
        </button>
      )}
      {status === 'occupied' && (
        <>
          <button
            onClick={() => handleTransfer(data)}
            className="px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-lg transition-all shadow-md hover:shadow-lg hover:scale-105 flex items-center gap-1.5"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            Transfer
          </button>
          <button
            onClick={() => handleRelease(data)}
            className="px-3 py-2 border-2 border-destructive/20 text-destructive bg-card hover:bg-destructive/10 text-xs font-bold rounded-lg transition-all hover:border-destructive/30 hover:scale-105 flex items-center gap-1.5"
          >
            <X className="h-3.5 w-3.5" />
            Release
          </button>
        </>
      )}
      {status === 'cleaning' && (
        <button
          onClick={() => handleMarkAvailable(data)}
          className="group flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white text-xs font-bold rounded-lg transition-all shadow-md hover:shadow-lg hover:scale-105 flex items-center justify-center gap-1.5"
        >
          <Check className="h-3.5 w-3.5" />
          Mark Ready
          <Sparkles className="h-3 w-3 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all" />
        </button>
      )}
    </div>
  );
};

// Skeleton Loader Component
const SkeletonRow = () => (
  <div className="flex gap-4 p-4 animate-pulse">
    {[...Array(9)].map((_, i) => (
      <div key={i} className={`h-12 bg-accent rounded-lg ${i === 0 ? 'w-24' : i === 1 ? 'w-32' : 'flex-1'}`}></div>
    ))}
  </div>
);

export default function BedManagement() {
  const { isDark } = useTheme();
  const [beds, setBeds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    ward_name: '',
    bed_type: '',
    bed_status: '',
    building: '',
    floor: ''
  });
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedBed, setSelectedBed] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    perPage: 50,
    total: 0,
    totalPages: 0
  });

  useEffect(() => {
    loadBeds();
  }, [filters, pagination.page]);

  const loadBeds = async () => {
    try {
      setIsLoading(true);
      const data = await ipdApi.listBeds(filters, pagination.page, pagination.perPage);
      setBeds(data.beds || []);
      setPagination(prev => ({
        ...prev,
        total: data.total,
        totalPages: data.total_pages
      }));
      setError(null);
    } catch (err) {
      console.error('Failed to load beds:', err);
      setError('Failed to load beds');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      ward_name: '',
      bed_type: '',
      bed_status: '',
      building: '',
      floor: ''
    });
  };

  const handleAssignBed = (bed) => {
    setSelectedBed(bed);
    setShowAssignDialog(true);
  };

  const handleTransferBed = (bed) => {
    setSelectedBed(bed);
    setShowTransferDialog(true);
  };

  const handleReleaseBed = async (bed) => {
    if (!confirm(`Release bed ${bed.bed_number}? This will mark it as cleaning.`)) {
      return;
    }

    try {
      await ipdApi.releaseBed(bed.id, 'Released from bed management');
      loadBeds();
    } catch (err) {
      console.error('Failed to release bed:', err);
      alert('Failed to release bed: ' + err.message);
    }
  };

  const handleMarkAvailable = async (bed) => {
    try {
      await ipdApi.updateBed(bed.id, { bed_status: 'available' });
      loadBeds();
    } catch (err) {
      console.error('Failed to mark bed available:', err);
      alert('Failed to mark bed available: ' + err.message);
    }
  };

  const columnDefs = useMemo(() => [
    {
      headerName: 'Bed #',
      field: 'bed_number',
      minWidth: 130,
      flex: 1,
      cellRenderer: BedNumberRenderer,
      cellClass: 'font-semibold'
    },
    {
      headerName: 'Location',
      field: 'ward_name',
      minWidth: 160,
      flex: 1.5,
      cellRenderer: LocationRenderer
    },
    {
      headerName: 'Floor',
      field: 'floor',
      minWidth: 80,
      flex: 0.8,
      cellClass: 'text-muted-foreground font-medium'
    },
    {
      headerName: 'Building',
      field: 'building',
      minWidth: 120,
      flex: 1,
      cellClass: 'text-muted-foreground font-medium'
    },
    {
      headerName: 'Type',
      field: 'bed_type',
      minWidth: 120,
      flex: 1,
      valueFormatter: (params) => params.value ? params.value.replace('_', ' ').toUpperCase() : '',
      cellClass: 'font-semibold text-muted-foreground'
    },
    {
      headerName: 'Status',
      field: 'bed_status',
      minWidth: 150,
      flex: 1.2,
      cellRenderer: BedStatusRenderer
    },
    {
      headerName: 'O₂',
      field: 'has_oxygen',
      minWidth: 70,
      flex: 0.7,
      cellRenderer: HardwareIndicator,
      headerClass: 'text-center'
    },
    {
      headerName: 'Vent',
      field: 'has_ventilator',
      minWidth: 70,
      flex: 0.7,
      cellRenderer: HardwareIndicator,
      headerClass: 'text-center'
    },
    {
      headerName: 'Current Patient',
      minWidth: 180,
      flex: 1.5,
      cellRenderer: PatientRenderer
    },
    {
      headerName: 'Actions',
      minWidth: 200,
      flex: 1.8,
      suppressNavigable: true,
      cellRenderer: ActionsRenderer,
      cellRendererParams: {
        handleAssign: handleAssignBed,
        handleTransfer: handleTransferBed,
        handleRelease: handleReleaseBed,
        handleMarkAvailable: handleMarkAvailable
      }
    }
  ], [handleAssignBed, handleTransferBed, handleReleaseBed, handleMarkAvailable]);

  const defaultColDef = useMemo(() => ({
    resizable: true,
    sortable: true,
    cellClass: 'flex items-center'
  }), []);

  // Calculate stats
  const stats = useMemo(() => {
    const total = beds.length;
    const available = beds.filter(b => b.bed_status === 'available').length;
    const occupied = beds.filter(b => b.bed_status === 'occupied').length;
    const cleaning = beds.filter(b => b.bed_status === 'cleaning').length;

    return { total, available, occupied, cleaning };
  }, [beds]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto p-6 md:p-10 space-y-8">
        {/* Enhanced Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
              <button onClick={() => window.history.back()} className="hover:text-foreground transition-colors">
                IPD Services
              </button>
              <ChevronRight className="h-4 w-4" />
              <span className="text-foreground font-semibold">Bed Management</span>
            </div>
            <div>
              <h1 className="text-5xl font-black text-foreground tracking-tight flex items-center gap-4">
                <div className="p-3 bg-primary rounded-2xl shadow-2xl">
                  <BedDouble className="h-9 w-9 text-primary-foreground" strokeWidth={2.5} />
                </div>
                Bed Management
              </h1>
              <p className="text-muted-foreground mt-3 text-lg font-medium">
                Real-time occupancy tracking, smart assignments, and ward optimization
              </p>
            </div>

            {/* Quick Stats */}
            <div className="flex gap-4 mt-6">
              <div className="px-4 py-2.5 bg-card rounded-xl border border-border shadow-sm">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Beds</div>
                <div className="text-2xl font-black text-foreground mt-0.5">{stats.total}</div>
              </div>
              <div className="px-4 py-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 shadow-sm">
                <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">Available</div>
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-0.5">{stats.available}</div>
              </div>
              <div className="px-4 py-2.5 bg-rose-500/10 rounded-xl border border-rose-500/20 shadow-sm">
                <div className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wide">Occupied</div>
                <div className="text-2xl font-black text-rose-700 dark:text-rose-400 mt-0.5">{stats.occupied}</div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={loadBeds}
              disabled={isLoading}
              className="px-6 py-3 bg-card border-2 border-border text-muted-foreground rounded-xl hover:bg-secondary hover:border-border transition-all shadow-sm hover:shadow-md flex items-center gap-2.5 font-bold disabled:opacity-50"
            >
              <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setShowCreateDialog(true)}
              className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all shadow-lg hover:shadow-xl hover:scale-105 flex items-center gap-2.5 font-bold"
            >
              <Plus className="h-5 w-5" strokeWidth={3} />
              Create Bed
            </button>
          </div>
        </div>

        {/* Enhanced Filters Section */}
        <div className="bg-card backdrop-blur-xl rounded-3xl border-2 border-border shadow-xl p-7">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="p-2 bg-primary rounded-lg">
              <Filter className="h-4 w-4 text-primary-foreground" />
            </div>
            <h2 className="text-lg font-black text-foreground">Filters</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 group-hover:text-muted-foreground transition-colors" />
              <input
                type="text"
                placeholder="Search ward..."
                value={filters.ward_name}
                onChange={(e) => handleFilterChange('ward_name', e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-secondary border-2 border-transparent rounded-xl focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/20 text-sm font-medium transition-all placeholder:text-muted-foreground/70"
              />
            </div>
            <select
              value={filters.bed_type}
              onChange={(e) => handleFilterChange('bed_type', e.target.value)}
              className="px-4 py-3.5 bg-secondary border-2 border-transparent rounded-xl focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/20 text-sm font-medium appearance-none cursor-pointer transition-all"
            >
              <option value="">All Bed Types</option>
              {['general', 'icu', 'semi_private', 'private', 'isolation'].map(type => (
                <option key={type} value={type}>{type.replace('_', ' ').toUpperCase()}</option>
              ))}
            </select>
            <select
              value={filters.bed_status}
              onChange={(e) => handleFilterChange('bed_status', e.target.value)}
              className="px-4 py-3.5 bg-secondary border-2 border-transparent rounded-xl focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/20 text-sm font-medium appearance-none cursor-pointer transition-all"
            >
              <option value="">All Statuses</option>
              {['available', 'occupied', 'cleaning', 'maintenance', 'reserved'].map(status => (
                <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Building..."
              value={filters.building}
              onChange={(e) => handleFilterChange('building', e.target.value)}
              className="px-4 py-3.5 bg-secondary border-2 border-transparent rounded-xl focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/20 text-sm font-medium transition-all placeholder:text-muted-foreground/70"
            />
            <button
              onClick={clearFilters}
              className="px-6 py-3.5 border-2 border-border bg-card text-muted-foreground rounded-xl hover:bg-secondary hover:border-border transition-all text-sm font-bold shadow-sm hover:shadow-md"
            >
              Reset All
            </button>
          </div>
        </div>

        {/* Enhanced Table Section */}
        <div className="bg-card rounded-3xl border-2 border-border shadow-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          ) : (
            <>
              <style>{`
                .ag-theme-quartz,
                .ag-theme-quartz-dark {
                  --ag-header-height: 56px;
                  --ag-font-family: inherit;
                }
                .ag-header-cell {
                  font-weight: 700 !important;
                  font-size: 0.75rem !important;
                  text-transform: uppercase !important;
                  letter-spacing: 0.05em !important;
                }
                .ag-row {
                  transition: all 0.2s ease !important;
                }
                .ag-cell {
                  display: flex !important;
                  align-items: center !important;
                  line-height: 1.5 !important;
                }
              `}</style>
              <div className={isDark ? "ag-theme-quartz-dark" : "ag-theme-quartz"} style={{ height: 650, width: '100%' }}>
                <AgGridReact
                  rowData={beds}
                  columnDefs={columnDefs}
                  defaultColDef={defaultColDef}
                  pagination={false}
                  getRowId={(params) => params.data.id}
                  rowHeight={80}
                  headerHeight={56}
                  animateRows={true}
                  suppressCellFocus={true}
                  overlayNoRowsTemplate={`
                    <div class='flex flex-col items-center gap-4 py-16'>
                      <div class='p-6 bg-secondary rounded-full'>
                        <svg class='h-12 w-12 text-muted-foreground' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'>
                          <path d='M3 7h18M3 12h18M3 17h18'/>
                        </svg>
                      </div>
                      <div class='text-center'>
                        <div class='text-foreground font-bold text-lg'>No beds found</div>
                        <div class='text-muted-foreground mt-1'>Try adjusting your filters</div>
                      </div>
                    </div>
                  `}
                />
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex justify-between items-center px-8 py-6 bg-secondary border-t-2 border-border">
                  <div className="text-sm font-semibold text-muted-foreground">
                    Page <span className="text-foreground font-black">{pagination.page}</span> of{' '}
                    <span className="text-foreground font-black">{pagination.totalPages}</span>
                    <span className="text-muted-foreground/70 ml-2">• {pagination.total} total beds</span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                      className="px-5 py-2.5 bg-card border-2 border-border text-muted-foreground rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-secondary hover:border-border transition-all shadow-sm hover:shadow-md font-bold"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page === pagination.totalPages}
                      className="px-5 py-2.5 bg-card border-2 border-border text-muted-foreground rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-secondary hover:border-border transition-all shadow-sm hover:shadow-md font-bold"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {showAssignDialog && (
        <BedAssignDialog
          bed={selectedBed}
          onClose={() => {
            setShowAssignDialog(false);
            setSelectedBed(null);
          }}
          onSuccess={() => {
            setShowAssignDialog(false);
            setSelectedBed(null);
            loadBeds();
          }}
        />
      )}

      {showTransferDialog && (
        <BedTransferDialog
          currentBed={selectedBed}
          onClose={() => {
            setShowTransferDialog(false);
            setSelectedBed(null);
          }}
          onSuccess={() => {
            setShowTransferDialog(false);
            setSelectedBed(null);
            loadBeds();
          }}
        />
      )}

      {showCreateDialog && (
        <CreateBedDialog
          onClose={() => setShowCreateDialog(false)}
          onSuccess={() => {
            setShowCreateDialog(false);
            loadBeds();
          }}
        />
      )}
    </div>
  );
}
