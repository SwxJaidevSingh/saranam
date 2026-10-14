/**
 * ServiceDashboard.jsx
 * Unified dashboard for each service type: IPD, OPD, Physiotherapy, Home Care.
 * Shows doctors, appointments filtered by service, and quick actions.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Building2, Stethoscope, HeartHandshake, Home,
  Calendar, Users, ClipboardList, Plus, Search,
  Filter, Loader2, ArrowRight, ChevronRight, User,
  Clock, CheckCircle2, XCircle, AlertCircle, FileText,
  Phone, RefreshCw, BedDouble, Activity, MapPin, Dumbbell
} from 'lucide-react';
import { appointmentsApi } from '../../api/appointments';
import { providersApi } from '../../api/providers';
import { servicesApi } from '../../api/services';

// ─── Config per service type ───────────────────────────────────────────────────
const SERVICE_CONFIG = {
  ipd: {
    title: 'In-Patient Department (IPD)',
    shortTitle: 'IPD',
    description: 'Manage inpatient admissions, bed allocations, 24/7 care, and discharge workflows.',
    icon: Building2,
    encounterType: 'IPD',
    color: 'purple',
    features: [
      { icon: BedDouble,      label: 'Bed & Ward Management' },
      { icon: Calendar,       label: 'Admission Scheduling'  },
      { icon: Activity,       label: 'Daily Monitoring'      },
      { icon: ClipboardList,  label: 'Discharge Planning'    },
    ],
    appointmentLabel: 'Admissions',
    doctorLabel: 'Attending Physicians',
    suggestions: [
      '📋 Admit Patient — Fill admission form linked to patient record.',
      '🛏️ Bed Management — Track ward/bed occupancy.',
      '📊 Vitals Tracking — Daily observation notes linked to each encounter.',
      '📤 Discharge Summary — Auto-generate discharge notes from encounter.',
    ],
  },
  opd: {
    title: 'Out-Patient Department (OPD)',
    shortTitle: 'OPD',
    description: 'Manage outpatient consultations, prescriptions, follow-ups, and specialist referrals.',
    icon: Stethoscope,
    encounterType: 'OPD',
    color: 'blue',
    features: [
      { icon: Calendar,      label: 'Quick Appointments'  },
      { icon: FileText,      label: 'Prescriptions'       },
      { icon: Users,         label: 'Specialist Referrals'},
      { icon: ClipboardList, label: 'Follow-up Tracking'  },
    ],
    appointmentLabel: 'OPD Appointments',
    doctorLabel: 'OPD Consultants',
    suggestions: [
      '💊 Prescription Form — Quick vitals + prescription linked to patient.',
      '🔄 Follow-up Scheduling — One-click follow-up from consultation.',
      '📨 Referral Slip — Generate referral to specialist.',
      '📋 Chief Complaint Form — Structured intake notes per visit.',
    ],
  },
  physiotherapy: {
    title: 'Physiotherapy',
    shortTitle: 'Physio',
    description: 'Track therapy sessions, progress, exercise plans, and rehabilitation programs.',
    icon: HeartHandshake,
    encounterType: 'Physiotherapy',
    color: 'green',
    features: [
      { icon: Dumbbell,      label: 'Session Tracking'  },
      { icon: Activity,      label: 'Progress Reports'  },
      { icon: ClipboardList, label: 'Exercise Plans'    },
      { icon: CheckCircle2,  label: 'Program Completion'},
    ],
    appointmentLabel: 'Therapy Sessions',
    doctorLabel: 'Physiotherapists',
    suggestions: [
      '📅 Session Counter — Track sessions completed vs. total prescribed.',
      '🏋️ Exercise Plan Form — Create and assign exercise programs.',
      '📈 Progress Score — SOAP notes per session linked to patient.',
      '✅ Discharge Assessment — Final functional assessment report.',
    ],
  },
  'home-care': {
    title: 'Home Care Services',
    shortTitle: 'Home Care',
    description: 'Coordinate home visits, nursing services, medical equipment, and caregiver assignments.',
    icon: Home,
    encounterType: 'HomeCare',
    color: 'orange',
    features: [
      { icon: MapPin,        label: 'Visit Scheduling'      },
      { icon: User,          label: 'Caregiver Assignment'  },
      { icon: Activity,      label: 'Health Monitoring'     },
      { icon: ClipboardList, label: 'Visit Notes'           },
    ],
    appointmentLabel: 'Home Visits',
    doctorLabel: 'Home Care Providers',
    suggestions: [
      '🏠 Visit Log — Record patient address and visit notes.',
      '🧑‍⚕️ Caregiver Assignment — Assign nurse/doctor to patient.',
      '📍 Location Details — Address and landmarks on appointment.',
      '📋 Visit Report Form — Structured notes for each home visit.',
    ],
  },
};

const colorMap = {
  purple: {
    bg: 'bg-secondary-100 dark:bg-secondary-900/20',
    text: 'text-secondary-600 dark:text-secondary-400',
    border: 'border-secondary-500 dark:border-secondary-700',
    button: 'bg-secondary-600 hover:bg-secondary-700 dark:bg-secondary-700 dark:hover:bg-secondary-600',
    badge: 'bg-secondary-50 text-secondary-700 border-secondary-200 dark:bg-secondary-900/20 dark:text-secondary-400 dark:border-secondary-800',
    headerBg: 'bg-secondary-600 dark:bg-secondary-700',
  },
  blue: {
    bg: 'bg-primary-100 dark:bg-primary-900/20',
    text: 'text-primary-600 dark:text-primary-400',
    border: 'border-primary-500 dark:border-primary-700',
    button: 'bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600',
    badge: 'bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-900/20 dark:text-primary-400 dark:border-primary-800',
    headerBg: 'bg-primary-600 dark:bg-primary-700',
  },
  green: {
    bg: 'bg-success-100 dark:bg-success-900/20',
    text: 'text-success-600 dark:text-success-400',
    border: 'border-success-500 dark:border-success-700',
    button: 'bg-success-600 hover:bg-success-700 dark:bg-success-700 dark:hover:bg-success-600',
    badge: 'bg-success-50 text-success-700 border-success-200 dark:bg-success-900/20 dark:text-success-400 dark:border-success-800',
    headerBg: 'bg-success-600 dark:bg-success-700',
  },
  orange: {
    bg: 'bg-warning-100 dark:bg-warning-900/20',
    text: 'text-warning-600 dark:text-warning-400',
    border: 'border-warning-500 dark:border-warning-700',
    button: 'bg-warning-600 hover:bg-warning-700 dark:bg-warning-700 dark:hover:bg-warning-600',
    badge: 'bg-warning-50 text-warning-700 border-warning-200 dark:bg-warning-900/20 dark:text-warning-400 dark:border-warning-800',
    headerBg: 'bg-warning-600 dark:bg-warning-700',
  },
};

// ─── Status badge ──────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  scheduled:   { label: 'Scheduled',   color: 'bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-900/20 dark:text-primary-300 dark:border-primary-800',   icon: Clock },
  confirmed:   { label: 'Confirmed',   color: 'bg-success-50 text-success-700 border-success-200 dark:bg-success-900/20 dark:text-success-300 dark:border-success-800', icon: CheckCircle2 },
  'in-progress':{ label: 'In Progress', color: 'bg-warning-50 text-warning-700 border-warning-200 dark:bg-warning-900/20 dark:text-warning-300 dark:border-warning-800', icon: Activity },
  checked_in:  { label: 'Checked In',  color: 'bg-success-50 text-success-700 border-success-200 dark:bg-success-900/20 dark:text-success-300 dark:border-success-800',   icon: CheckCircle2 },
  completed:   { label: 'Completed',   color: 'bg-muted text-muted-foreground border-border',   icon: CheckCircle2 },
  cancelled:   { label: 'Cancelled',   color: 'bg-danger-50 text-danger-700 border-danger-200 dark:bg-danger-900/20 dark:text-danger-300 dark:border-danger-800',      icon: XCircle },
  'no-show':   { label: 'No Show',     color: 'bg-warning-50 text-warning-700 border-warning-200 dark:bg-warning-900/20 dark:text-warning-300 dark:border-warning-800', icon: AlertCircle },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'bg-muted text-muted-foreground border-border', icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

// ─── Appointments Table ────────────────────────────────────────────────────────
function AppointmentsTable({ encounterType, colors, navigate, appointmentLabel }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date();
      const fromDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const data = await appointmentsApi.list({
        encounter_type: encounterType,
        from_date: fromDate,
        status: statusFilter || undefined,
        limit: 50,
      });
      const all = data.appointments || data.data || [];
      setTotal(data.total || all.length);
      // Client-side search filter by patient name
      const filtered = searchQuery
        ? all.filter(a =>
            (a.patient_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (a.provider_name || '').toLowerCase().includes(searchQuery.toLowerCase())
          )
        : all;
      setAppointments(filtered);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [encounterType, statusFilter, searchQuery]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{appointmentLabel}</h2>
        <button onClick={load} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by patient or doctor..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="confirmed">Confirmed</option>
          <option value="in-progress">In Progress</option>
          <option value="checked_in">Checked In</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button
          onClick={() => navigate('/services/book')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium whitespace-nowrap ${colors.button}`}
        >
          <Plus className="h-4 w-4" />
          New
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : appointments.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Calendar className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No {appointmentLabel.toLowerCase()} found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 pr-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Patient</th>
                <th className="pb-2 pr-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Doctor</th>
                <th className="pb-2 pr-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Date & Time</th>
                <th className="pb-2 pr-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th className="pb-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {appointments.map(appt => (
                <tr key={appt.id} className="hover:bg-accent transition-colors">
                  <td className="py-3 pr-4">
                    <div className="font-medium text-foreground">{appt.patient_name || 'Unknown Patient'}</div>
                    {appt.chief_complaint && (
                      <div className="text-xs text-muted-foreground truncate max-w-[160px]">{appt.chief_complaint}</div>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="text-foreground">{appt.provider_name || '—'}</div>
                    {appt.provider_specialization && (
                      <div className="text-xs text-muted-foreground">{appt.provider_specialization}</div>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="text-foreground">
                      {appt.start_time ? new Date(appt.start_time).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {appt.start_time ? new Date(appt.start_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={appt.status} />
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/appointments?highlight=${appt.id}`)}
                        className="text-xs px-2 py-1 rounded border border-border hover:bg-accent text-muted-foreground"
                      >
                        View
                      </button>
                      <Link
                        to={`/forms?patient_id=${appt.patient_id}&encounter_id=${appt.id}`}
                        className={`text-xs px-2 py-1 rounded text-white ${colors.button}`}
                      >
                        Fill Form
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {total > appointments.length && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Showing {appointments.length} of {total} records
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Doctors Panel ─────────────────────────────────────────────────────────────
function DoctorsPanel({ colors, doctorLabel, navigate }) {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    providersApi.list({ is_active: true, limit: 8 })
      .then(data => setProviders(data.providers || data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{doctorLabel}</h2>
        <button
          onClick={() => navigate('/providers')}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
        >
          View All <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : providers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No providers found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {providers.map(p => (
            <div
              key={p.id}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-accent border border-border transition-colors cursor-pointer group"
              onClick={() => navigate(`/providers/${p.id}`)}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                  <User className={`h-5 w-5 ${colors.text}`} />
                </div>
                <div>
                  <div className="font-medium text-foreground text-sm">
                    {p.salutation ? `${p.salutation} ` : ''}{p.full_name || p.name}
                  </div>
                  <div className="text-xs text-muted-foreground">{p.specialization || p.department || 'General'}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {p.phone && (
                  <a href={`tel:${p.phone}`} onClick={e => e.stopPropagation()}
                     className="p-1.5 rounded-md hover:bg-accent text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                )}
                <button
                  onClick={e => { e.stopPropagation(); navigate(`/providers/${p.id}/schedule`); }}
                  className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Schedule
                </button>
                <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => navigate('/providers/new')}
        className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-white text-sm font-medium ${colors.button}`}
      >
        <Plus className="h-4 w-4" />
        Add New Provider
      </button>
    </div>
  );
}

// ─── Feature Suggestions Panel ─────────────────────────────────────────────────
function SuggestionsPanel({ suggestions, colors }) {
  return (
    <div className="card space-y-3">
      <h2 className="text-lg font-semibold text-foreground">💡 Suggested Features</h2>
      <p className="text-sm text-muted-foreground">Recommended workflows for this department:</p>
      <ul className="space-y-2">
        {suggestions.map((s, i) => (
          <li key={i} className={`p-3 rounded-lg border text-sm ${colors.badge}`}>
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Today's Stats ─────────────────────────────────────────────────────────────
function ServiceStats({ encounterType, colors }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    appointmentsApi.list({ encounter_type: encounterType, from_date: today, to_date: today, limit: 200 })
      .then(data => {
        const all = data.appointments || data.data || [];
        const counts = { total: all.length, scheduled: 0, completed: 0, cancelled: 0 };
        all.forEach(a => {
          if (a.status === 'scheduled' || a.status === 'confirmed') counts.scheduled++;
          else if (a.status === 'completed') counts.completed++;
          else if (a.status === 'cancelled') counts.cancelled++;
        });
        setStats(counts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [encounterType]);

  const items = [
    { label: "Today's Total", value: stats?.total ?? 0, icon: Calendar },
    { label: 'Scheduled',    value: stats?.scheduled ?? 0, icon: Clock },
    { label: 'Completed',    value: stats?.completed ?? 0, icon: CheckCircle2 },
    { label: 'Cancelled',    value: stats?.cancelled ?? 0, icon: XCircle },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map(({ label, value, icon: Icon }) => (
        <div key={label} className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {loading ? <Loader2 className="h-5 w-5 animate-spin inline text-muted-foreground" /> : value}
              </p>
            </div>
            <div className={`p-2 rounded-lg ${colors.bg}`}>
              <Icon className={`h-5 w-5 ${colors.text}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function ServiceDashboard() {
  const { type } = useParams();
  const navigate = useNavigate();
  const config = SERVICE_CONFIG[type];

  if (!config) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="h-12 w-12 mx-auto text-danger-400 mb-3" />
        <h2 className="text-xl font-bold text-foreground">Service Not Found</h2>
        <p className="text-muted-foreground mt-2">The service type "{type}" is not recognized.</p>
        <button onClick={() => navigate('/services')} className="mt-4 text-primary-600 underline">← Back to Services</button>
      </div>
    );
  }

  const colors = colorMap[config.color];
  const Icon = config.icon;

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/services')} className="text-muted-foreground hover:text-foreground">
          ← Services
        </button>
        <span className="text-muted-foreground/50">/</span>
        <span className="text-muted-foreground font-medium">{config.shortTitle}</span>
      </div>

      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl ${colors.bg}`}>
            <Icon className={`h-8 w-8 ${colors.text}`} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{config.title}</h1>
            <p className="text-muted-foreground mt-1">{config.description}</p>
          </div>
        </div>
        <div className="flex gap-3 flex-shrink-0">
          <button
            onClick={() => navigate('/appointments')}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent"
          >
            <Calendar className="h-4 w-4" />
            All Appointments
          </button>
          <button
            onClick={() => navigate('/services/book')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium ${colors.button}`}
          >
            <Plus className="h-4 w-4" />
            Book {config.shortTitle}
          </button>
        </div>
      </div>

      {/* Key Features */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {config.features.map(({ icon: FIcon, label }) => (
          <div key={label} className={`flex items-center gap-3 p-3 rounded-lg border ${colors.badge}`}>
            <FIcon className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm font-medium">{label}</span>
          </div>
        ))}
      </div>

      {/* Today's Stats */}
      <ServiceStats encounterType={config.encounterType} colors={colors} />

      {/* Main Grid: Appointments + Doctors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Appointments Table — takes 2 cols on large */}
        <div className="lg:col-span-2 space-y-6">
          <AppointmentsTable
            encounterType={config.encounterType}
            colors={colors}
            navigate={navigate}
            appointmentLabel={config.appointmentLabel}
          />
        </div>

        {/* Sidebar: Doctors + Suggestions */}
        <div className="space-y-6">
          <DoctorsPanel
            colors={colors}
            doctorLabel={config.doctorLabel}
            navigate={navigate}
          />
          <SuggestionsPanel
            suggestions={config.suggestions}
            colors={colors}
          />
        </div>
      </div>
    </div>
  );
}
