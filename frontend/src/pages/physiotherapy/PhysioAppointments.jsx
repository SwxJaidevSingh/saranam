import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import {
  CalendarPlus,
  Search,
  Clock,
  Stethoscope,
  AlertTriangle,
  X,
  ChevronRight,
  ChevronLeft,
  Users
} from 'lucide-react';
import physioApi from '../../api/physiotherapy';
import { patientsApi } from '../../api/patients';
import { providersApi } from '../../api/providers';

const STATUS_CONFIG = {
  scheduled: { label: 'Scheduled', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' },
  checked_in: { label: 'Checked In', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200' },
  vitals_recorded: { label: 'Vitals Done', color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200' },
  in_consultation: { label: 'In Session', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200' },
  completed: { label: 'Completed', color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' },
  no_show: { label: 'No Show', color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.scheduled;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function formatDateTime(isoString) {
  if (!isoString) return '\u2014';
  return new Date(isoString).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ---- Book Appointment Modal ----
function BookingModal({ onClose, onSuccess }) {
  const [patients, setPatients] = useState([]);
  const [providers, setProviders] = useState([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [form, setForm] = useState({
    patient_id: '',
    provider_id: '',
    start_time: '',
    duration: 45,
    chief_complaint: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    providersApi.list({ per_page: 100 }).then(d => setProviders(d.providers || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (patientSearch.length >= 2) {
      patientsApi.search(patientSearch, 1, 20).then(d => setPatients(d.patients || [])).catch(() => {});
    } else {
      setPatients([]);
    }
  }, [patientSearch]);

  const validate = () => {
    const e = {};
    if (!form.patient_id) e.patient_id = 'Patient is required';
    if (!form.start_time) e.start_time = 'Appointment time is required';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    try {
      setIsSubmitting(true);
      await physioApi.createVisit(form);
      onSuccess();
    } catch (err) {
      setErrors({ submit: err.response?.data?.error || 'Failed to book appointment' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const [selectedPatient, setSelectedPatient] = useState(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">Book Physiotherapy Appointment</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errors.submit && (
            <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 rounded-lg p-3 text-sm text-danger-800 dark:text-danger-200">
              {errors.submit}
            </div>
          )}

          {/* Patient Search */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Patient <span className="text-danger-500">*</span>
            </label>
            {selectedPatient ? (
              <div className="flex items-center justify-between p-3 border border-success-300 dark:border-success-700 bg-success-50 dark:bg-success-900/20 rounded-lg">
                <div>
                  <p className="font-medium text-foreground">{selectedPatient.full_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedPatient.phone || selectedPatient.email || ''}</p>
                </div>
                <button type="button" onClick={() => { setSelectedPatient(null); setForm(f => ({ ...f, patient_id: '' })); }} className="p-1 hover:bg-accent rounded">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={patientSearch}
                  onChange={e => setPatientSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {patients.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 bg-card border border-border rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {patients.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full text-left px-4 py-2.5 hover:bg-accent text-sm transition-colors"
                        onClick={() => {
                          setSelectedPatient(p);
                          setForm(f => ({ ...f, patient_id: p.id }));
                          setPatientSearch('');
                          setPatients([]);
                          setErrors(e => ({ ...e, patient_id: undefined }));
                        }}
                      >
                        <span className="font-medium text-foreground">{p.full_name}</span>
                        {p.phone && <span className="text-muted-foreground ml-2">&middot; {p.phone}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {errors.patient_id && <p className="text-xs text-danger-500 mt-1">{errors.patient_id}</p>}
          </div>

          {/* Provider */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Physiotherapist / Provider</label>
            <select
              value={form.provider_id}
              onChange={e => setForm(f => ({ ...f, provider_id: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">&mdash; Select provider (optional) &mdash;</option>
              {providers.map(p => (
                <option key={p.id} value={p.id}>{p.full_name}{p.specialization ? ` \u00B7 ${p.specialization}` : ''}</option>
              ))}
            </select>
          </div>

          {/* Date/Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Appointment Time <span className="text-danger-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={form.start_time}
                onChange={e => { setForm(f => ({ ...f, start_time: e.target.value })); setErrors(e => ({ ...e, start_time: undefined })); }}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {errors.start_time && <p className="text-xs text-danger-500 mt-1">{errors.start_time}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Duration (mins)</label>
              <select
                value={form.duration}
                onChange={e => setForm(f => ({ ...f, duration: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value={15}>15 mins</option>
                <option value={20}>20 mins</option>
                <option value={30}>30 mins</option>
                <option value={45}>45 mins</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
              </select>
            </div>
          </div>

          {/* Chief Complaint */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Chief Complaint</label>
            <input
              type="text"
              placeholder="e.g. Lower back pain, post-surgical rehab"
              value={form.chief_complaint}
              onChange={e => setForm(f => ({ ...f, chief_complaint: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
            <textarea
              rows={2}
              placeholder="Any additional notes..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-accent transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-primary-600 dark:bg-primary-700 text-white rounded-lg text-sm font-medium hover:bg-primary-700 dark:hover:bg-primary-800 disabled:opacity-50"
            >
              {isSubmitting ? 'Booking...' : 'Book Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ---- Main Page ----
export default function PhysioAppointments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [visits, setVisits] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showBooking, setShowBooking] = useState(
    searchParams.get('new') === '1' || location.pathname.endsWith('/new')
  );

  const page = parseInt(searchParams.get('page') || '1');
  const statusFilter = searchParams.get('status') || '';

  const loadVisits = useCallback(async () => {
    try {
      setIsLoading(true);
      const filters = {};
      if (statusFilter) filters.status = statusFilter;
      const data = await physioApi.listVisits(filters, page, 20);
      setVisits(data.visits || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 0);
      setError(null);
    } catch (err) {
      console.error('Failed to load visits:', err);
      setError('Failed to load appointments');
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    loadVisits();
  }, [loadVisits]);

  const handleBookingSuccess = () => {
    setShowBooking(false);
    loadVisits();
  };

  return (
    <div className="p-6 space-y-6">
      {showBooking && (
        <BookingModal
          onClose={() => setShowBooking(false)}
          onSuccess={handleBookingSuccess}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Physiotherapy Appointments</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {total > 0 ? `${total} total appointments` : 'All Physiotherapy visits'}
          </p>
        </div>
        <button
          onClick={() => setShowBooking(true)}
          className="px-4 py-2 bg-primary-600 dark:bg-primary-700 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-800 flex items-center gap-2 text-sm font-medium"
        >
          <CalendarPlus className="h-4 w-4" />
          Book Appointment
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 flex-wrap">
          {[
            { value: '', label: 'All' },
            { value: 'scheduled', label: 'Scheduled' },
            { value: 'checked_in', label: 'Checked In' },
            { value: 'in_consultation', label: 'In Session' },
            { value: 'completed', label: 'Completed' },
            { value: 'no_show', label: 'No Show' },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setSearchParams(f.value ? { status: f.value } : {})}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === f.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-danger-600 dark:text-danger-400" />
          <span className="text-danger-800 dark:text-danger-200">{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        </div>
      ) : visits.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-lg font-medium text-foreground">No appointments found</p>
          <p className="text-muted-foreground text-sm mt-1">
            {statusFilter ? 'Try a different filter or ' : ''} book a new appointment
          </p>
          <button
            onClick={() => setShowBooking(true)}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
          >
            Book Appointment
          </button>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Patient</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date & Time</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Physiotherapist</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Chief Complaint</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visits.map(visit => (
                    <tr key={visit.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{visit.patient_name || '\u2014'}</p>
                        <p className="text-xs text-muted-foreground capitalize">{visit.patient_gender || ''}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {formatDateTime(visit.start_time)}
                      </td>
                      <td className="px-4 py-3">
                        {visit.provider_name ? (
                          <div>
                            <p className="text-foreground">{visit.provider_name}</p>
                            {visit.provider_specialization && (
                              <p className="text-xs text-muted-foreground">{visit.provider_specialization}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">Not assigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs">
                        <span className="truncate block">{visit.chief_complaint || '\u2014'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={visit.status} />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/physiotherapy/visits/${visit.id}`}
                          className="p-1.5 rounded-lg hover:bg-accent transition-colors inline-flex"
                          title="View details"
                        >
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages} &middot; {total} total
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setSearchParams({ ...Object.fromEntries(searchParams), page: page - 1 })}
                  disabled={page <= 1}
                  className="p-2 rounded-lg border border-border hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setSearchParams({ ...Object.fromEntries(searchParams), page: page + 1 })}
                  disabled={page >= totalPages}
                  className="p-2 rounded-lg border border-border hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
