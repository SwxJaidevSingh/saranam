import { useState, useEffect } from 'react';
import { Clock, Filter, RefreshCw, AlertCircle, CheckCircle, User, Bed } from 'lucide-react';
import ipdApi from '../../api/ipd';

export default function WaitingList() {
  const [waitingList, setWaitingList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    status: 'waiting',
    priority: '',
    bed_type: ''
  });

  useEffect(() => {
    loadWaitingList();
  }, [filters]);

  const loadWaitingList = async () => {
    try {
      setIsLoading(true);
      const data = await ipdApi.getWaitingList(
        filters.status,
        filters.priority || null,
        filters.bed_type || null
      );
      setWaitingList(data.waiting_list || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load waiting list:', err);
      setError('Failed to load waiting list');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const getPriorityBadge = (priority) => {
    const badges = {
      emergency: 'bg-danger-100 dark:bg-danger-900/20 text-danger-800 dark:text-danger-200 border-danger-300 dark:border-danger-700',
      urgent: 'bg-warning-100 dark:bg-warning-900/20 text-warning-800 dark:text-warning-200 border-warning-300 dark:border-warning-700',
      routine: 'bg-primary-100 dark:bg-primary-900/20 text-primary-800 dark:text-primary-200 border-primary-300 dark:border-primary-700'
    };
    return badges[priority] || 'bg-muted text-muted-foreground border-border';
  };

  const getStatusBadge = (status) => {
    const badges = {
      waiting: 'bg-warning-100 dark:bg-warning-900/20 text-warning-800 dark:text-warning-200 border-warning-300 dark:border-warning-700',
      assigned: 'bg-success-100 dark:bg-success-900/20 text-success-800 dark:text-success-200 border-success-300 dark:border-success-700',
      cancelled: 'bg-muted text-muted-foreground border-border',
      expired: 'bg-danger-100 dark:bg-danger-900/20 text-danger-800 dark:text-danger-200 border-danger-300 dark:border-danger-700'
    };
    return badges[status] || 'bg-muted text-muted-foreground border-border';
  };

  const getWaitTime = (requestedAt) => {
    const now = new Date();
    const requested = new Date(requestedAt);
    const diffMs = now - requested;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ${diffHours % 24}h`;
    }
    return `${diffHours}h`;
  };

  const handleCancelEntry = async (entryId) => {
    if (!confirm('Are you sure you want to cancel this waiting list entry?')) {
      return;
    }

    try {
      await ipdApi.updateWaitingList(entryId, { status: 'cancelled' });
      loadWaitingList();
    } catch (err) {
      console.error('Failed to cancel entry:', err);
      alert('Failed to cancel entry: ' + err.message);
    }
  };

  // Sort by priority then by requested time
  const sortedList = [...waitingList].sort((a, b) => {
    const priorityOrder = { emergency: 1, urgent: 2, routine: 3 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return new Date(a.requested_at) - new Date(b.requested_at);
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Clock className="h-8 w-8" />
            Bed Waiting List
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage patients waiting for bed assignment
          </p>
        </div>
        <button
          onClick={loadWaitingList}
          className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-accent flex items-center gap-2"
        >
          <RefreshCw className="h-5 w-5" />
          Refresh
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-danger-50 dark:bg-danger-900/20 border-2 border-danger-200 dark:border-danger-800 rounded-lg p-4">
          <div className="text-danger-600 dark:text-danger-400 text-sm font-medium">Emergency</div>
          <div className="text-3xl font-bold text-danger-900 dark:text-danger-100 mt-1">
            {waitingList.filter(w => w.priority === 'emergency' && w.status === 'waiting').length}
          </div>
        </div>
        <div className="bg-warning-50 dark:bg-warning-900/20 border-2 border-warning-200 dark:border-warning-800 rounded-lg p-4">
          <div className="text-warning-600 dark:text-warning-400 text-sm font-medium">Urgent</div>
          <div className="text-3xl font-bold text-warning-900 dark:text-warning-100 mt-1">
            {waitingList.filter(w => w.priority === 'urgent' && w.status === 'waiting').length}
          </div>
        </div>
        <div className="bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-200 dark:border-primary-800 rounded-lg p-4">
          <div className="text-primary-600 dark:text-primary-400 text-sm font-medium">Routine</div>
          <div className="text-3xl font-bold text-primary-900 dark:text-primary-100 mt-1">
            {waitingList.filter(w => w.priority === 'routine' && w.status === 'waiting').length}
          </div>
        </div>
        <div className="bg-success-50 dark:bg-success-900/20 border-2 border-success-200 dark:border-success-800 rounded-lg p-4">
          <div className="text-success-600 dark:text-success-400 text-sm font-medium">Assigned</div>
          <div className="text-3xl font-bold text-success-900 dark:text-success-100 mt-1">
            {waitingList.filter(w => w.status === 'assigned').length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card dark:bg-card rounded-lg shadow border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Filters</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="waiting">Waiting</option>
              <option value="assigned">Assigned</option>
              <option value="cancelled">Cancelled</option>
              <option value="expired">Expired</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Priority</label>
            <select
              value={filters.priority}
              onChange={(e) => handleFilterChange('priority', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Priorities</option>
              <option value="emergency">Emergency</option>
              <option value="urgent">Urgent</option>
              <option value="routine">Routine</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Bed Type</label>
            <select
              value={filters.bed_type}
              onChange={(e) => handleFilterChange('bed_type', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Bed Types</option>
              <option value="general">General</option>
              <option value="icu">ICU</option>
              <option value="semi_private">Semi-Private</option>
              <option value="private">Private</option>
              <option value="isolation">Isolation</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ status: 'waiting', priority: '', bed_type: '' })}
              className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-accent w-full"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Waiting List */}
      <div className="bg-card dark:bg-card rounded-lg shadow border border-border">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading waiting list...</p>
          </div>
        ) : error ? (
          <div className="p-4">
            <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 text-danger-800 dark:text-danger-200">
              {error}
            </div>
          </div>
        ) : sortedList.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No patients in waiting list
          </div>
        ) : (
          <div className="divide-y divide-border">
            {sortedList.map((entry, index) => (
              <div
                key={entry.id}
                className={`p-4 hover:bg-accent transition-colors ${
                  entry.priority === 'emergency' ? 'bg-danger-50 dark:bg-danger-900/20 border-l-4 border-l-danger-600 dark:border-l-danger-500' :
                  entry.priority === 'urgent' ? 'bg-warning-50 dark:bg-warning-900/20 border-l-4 border-l-warning-600 dark:border-l-warning-500' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Position Number */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                      entry.priority === 'emergency' ? 'bg-danger-600 dark:bg-danger-700' :
                      entry.priority === 'urgent' ? 'bg-warning-600 dark:bg-warning-700' : 'bg-primary-600 dark:bg-primary-700'
                    }`}>
                      {index + 1}
                    </div>

                    {/* Patient Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-semibold text-foreground">{entry.patient_name || 'Unknown Patient'}</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Bed Type:</span>{' '}
                          <span className="font-medium text-foreground capitalize">{entry.requested_bed_type?.replace('_', ' ')}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Priority:</span>{' '}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getPriorityBadge(entry.priority)}`}>
                            {entry.priority?.toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Wait Time:</span>{' '}
                          <span className="font-medium text-foreground">{getWaitTime(entry.requested_at)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Status:</span>{' '}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(entry.status)}`}>
                            {entry.status?.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {entry.service_name && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">Service:</span> {entry.service_name}
                        </div>
                      )}

                      {entry.notes && (
                        <div className="mt-2 text-sm text-muted-foreground italic">
                          {entry.notes}
                        </div>
                      )}

                      {entry.assigned_bed_number && (
                        <div className="mt-2 flex items-center gap-2 text-sm text-success-700 dark:text-success-300">
                          <Bed className="h-4 w-4" />
                          <span>Assigned to: <span className="font-semibold">{entry.assigned_bed_number}</span></span>
                          {entry.assigned_at && (
                            <span className="text-muted-foreground">
                              on {new Date(entry.assigned_at).toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {entry.status === 'waiting' && (
                      <>
                        <button
                          onClick={() => {/* Navigate to bed assignment */}}
                          className="px-4 py-2 bg-primary-600 dark:bg-primary-700 text-white text-sm rounded-lg hover:bg-primary-700 dark:hover:bg-primary-800 flex items-center gap-1"
                        >
                          <Bed className="h-4 w-4" />
                          Assign Bed
                        </button>
                        <button
                          onClick={() => handleCancelEntry(entry.id)}
                          className="px-4 py-2 bg-danger-100 dark:bg-danger-900/20 text-danger-700 dark:text-danger-300 text-sm rounded-lg hover:bg-danger-200 dark:hover:bg-danger-900/40"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {entry.status === 'assigned' && (
                      <div className="flex items-center gap-2 text-success-600 dark:text-success-400">
                        <CheckCircle className="h-5 w-5" />
                        <span className="text-sm font-medium">Bed Assigned</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="bg-card dark:bg-card rounded-lg shadow border border-border p-4">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Priority Queue Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-start gap-2">
            <div className="w-3 h-3 bg-danger-600 dark:bg-danger-700 rounded-full mt-1"></div>
            <div>
              <div className="font-medium text-foreground">Emergency</div>
              <div className="text-muted-foreground">Life-threatening conditions requiring immediate bed assignment</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-3 h-3 bg-warning-600 dark:bg-warning-700 rounded-full mt-1"></div>
            <div>
              <div className="font-medium text-foreground">Urgent</div>
              <div className="text-muted-foreground">Serious conditions requiring bed within 24 hours</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-3 h-3 bg-primary-600 dark:bg-primary-700 rounded-full mt-1"></div>
            <div>
              <div className="font-medium text-foreground">Routine</div>
              <div className="text-muted-foreground">Scheduled admissions, assigned in order</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
