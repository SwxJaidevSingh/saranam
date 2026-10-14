import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  UserCheck,
  XCircle,
  Clock,
  Stethoscope,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  ChevronRight
} from 'lucide-react';
import opdApi from '../../api/opd';

const STATUS_CONFIG = {
  scheduled: { label: 'Scheduled', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200', dot: 'bg-blue-500' },
  checked_in: { label: 'Checked In', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200', dot: 'bg-orange-500' },
  vitals_recorded: { label: 'Vitals Done', color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200', dot: 'bg-yellow-500' },
  in_consultation: { label: 'In Consultation', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200', dot: 'bg-purple-500' },
  completed: { label: 'Completed', color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200', dot: 'bg-green-500' },
  no_show: { label: 'No Show', color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200', dot: 'bg-red-500' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400', dot: 'bg-gray-400' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.scheduled;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function formatTime(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default function OPDQueue() {
  const [visits, setVisits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const [selectedDate, setSelectedDate] = useState(localDate);

  const loadQueue = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await opdApi.getQueue(selectedDate);
      setVisits(data.visits || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load OPD queue:', err);
      setError('Failed to load queue data');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleCheckIn = async (visitId) => {
    try {
      setActionLoading(visitId);
      await opdApi.checkIn(visitId);
      await loadQueue();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to check in');
    } finally {
      setActionLoading(null);
    }
  };

  const handleNoShow = async (visitId) => {
    if (!window.confirm('Mark this patient as no-show?')) return;
    try {
      setActionLoading(visitId);
      await opdApi.markNoShow(visitId);
      await loadQueue();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to mark no-show');
    } finally {
      setActionLoading(null);
    }
  };

  const activeVisits = visits.filter(v => !['completed', 'no_show', 'cancelled'].includes(v.status));
  const doneVisits = visits.filter(v => ['completed', 'no_show', 'cancelled'].includes(v.status));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">OPD Queue</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage today's patient flow</p>
        </div>
        <div className="flex gap-3 items-center">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
          />
          <button
            onClick={loadQueue}
            className="p-2 rounded-lg border border-border hover:bg-accent transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </button>
          <Link
            to="/opd/appointments/new"
            className="px-4 py-2 bg-primary-600 dark:bg-primary-700 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-800 text-sm font-medium"
          >
            + Book New
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-danger-600 dark:text-danger-400" />
          <span className="text-danger-800 dark:text-danger-200">{error}</span>
        </div>
      )}

      {visits.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-12 text-center">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-lg font-medium text-foreground">No appointments for this date</p>
          <p className="text-muted-foreground text-sm mt-1">Book a new appointment to get started</p>
          <Link
            to="/opd/appointments/new"
            className="mt-4 inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
          >
            Book Appointment
          </Link>
        </div>
      ) : (
        <>
          {/* Summary Pills */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(
              visits.reduce((acc, v) => { acc[v.status] = (acc[v.status] || 0) + 1; return acc; }, {})
            ).map(([status, count]) => (
              <span key={status} className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_CONFIG[status]?.color || 'bg-gray-100 text-gray-600'}`}>
                {STATUS_CONFIG[status]?.label || status}: {count}
              </span>
            ))}
          </div>

          {/* Active Queue */}
          {activeVisits.length > 0 && (
            <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-border bg-muted/30">
                <h2 className="font-semibold text-foreground">Active Queue ({activeVisits.length})</h2>
              </div>
              <div className="divide-y divide-border">
                {activeVisits.map((visit) => (
                  <div key={visit.id} className="px-6 py-4 flex items-center justify-between hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary-700 dark:text-primary-300">
                          {visit.patient_name?.charAt(0) || '?'}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-foreground">{visit.patient_name || 'Unknown Patient'}</p>
                          <StatusBadge status={visit.status} />
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatTime(visit.start_time)}
                          </span>
                          {visit.provider_name && (
                            <span className="flex items-center gap-1">
                              <Stethoscope className="h-3.5 w-3.5" />
                              {visit.provider_name}
                            </span>
                          )}
                          {visit.chief_complaint && (
                            <span className="truncate max-w-xs">{visit.chief_complaint}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                      {['scheduled', 'confirmed'].includes(visit.status) && (
                        <>
                          <button
                            onClick={() => handleCheckIn(visit.id)}
                            disabled={actionLoading === visit.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-success-600 dark:bg-success-700 text-white rounded-lg text-sm hover:bg-success-700 dark:hover:bg-success-800 disabled:opacity-50"
                          >
                            <UserCheck className="h-4 w-4" />
                            Check In
                          </button>
                          <button
                            onClick={() => handleNoShow(visit.id)}
                            disabled={actionLoading === visit.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-danger-300 dark:border-danger-700 text-danger-600 dark:text-danger-400 rounded-lg text-sm hover:bg-danger-50 dark:hover:bg-danger-900/20 disabled:opacity-50"
                          >
                            <XCircle className="h-4 w-4" />
                            No Show
                          </button>
                        </>
                      )}
                      <Link
                        to={`/opd/visits/${visit.id}`}
                        className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                        title="View details"
                      >
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Done / No-Show */}
          {doneVisits.length > 0 && (
            <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-border bg-muted/30">
                <h2 className="font-semibold text-foreground text-sm text-muted-foreground">
                  Closed ({doneVisits.length})
                </h2>
              </div>
              <div className="divide-y divide-border">
                {doneVisits.map((visit) => (
                  <div key={visit.id} className="px-6 py-3 flex items-center justify-between opacity-70 hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-xs font-bold text-muted-foreground">
                          {visit.patient_name?.charAt(0) || '?'}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{visit.patient_name || 'Unknown Patient'}</p>
                          <StatusBadge status={visit.status} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatTime(visit.start_time)}
                          {visit.provider_name ? ` · ${visit.provider_name}` : ''}
                        </p>
                      </div>
                    </div>
                    <Link
                      to={`/opd/visits/${visit.id}`}
                      className="p-1.5 rounded-lg hover:bg-accent transition-colors ml-4"
                    >
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
