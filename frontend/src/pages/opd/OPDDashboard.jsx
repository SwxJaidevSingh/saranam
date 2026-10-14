import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  UserCheck,
  Stethoscope,
  CheckCircle,
  XCircle,
  CalendarPlus,
  ClipboardList,
  AlertTriangle,
  Activity,
  RefreshCw
} from 'lucide-react';
import opdApi from '../../api/opd';

export default function OPDDashboard() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setIsLoading(true);
      const data = await opdApi.getStats();
      setStats(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load OPD dashboard:', err);
      setError('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const colorClasses = {
    blue: 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800',
    green: 'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-300 border-success-200 dark:border-success-800',
    red: 'bg-danger-50 dark:bg-danger-900/20 text-danger-700 dark:text-danger-300 border-danger-200 dark:border-danger-800',
    orange: 'bg-warning-50 dark:bg-warning-900/20 text-warning-700 dark:text-warning-300 border-warning-200 dark:border-warning-800',
    purple: 'bg-secondary-50 dark:bg-secondary-900/20 text-secondary-700 dark:text-secondary-300 border-secondary-200 dark:border-secondary-800',
    gray: 'bg-muted text-muted-foreground border-border',
    teal: 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800',
  };

  const today = stats?.today || {};

  const statCards = stats ? [
    {
      title: 'Total Today',
      value: today.total || 0,
      icon: Users,
      color: 'blue',
      link: '/opd/visits?date=today',
      description: `${stats.total_all_time || 0} all-time visits`
    },
    {
      title: 'Scheduled',
      value: today.scheduled || 0,
      icon: CalendarPlus,
      color: 'teal',
      link: '/opd/queue',
      description: 'Awaiting check-in'
    },
    {
      title: 'Checked In',
      value: today.checked_in || 0,
      icon: UserCheck,
      color: 'orange',
      link: '/opd/queue',
      description: 'In waiting area'
    },
    {
      title: 'In Consultation',
      value: today.in_consultation || 0,
      icon: Stethoscope,
      color: 'purple',
      link: '/opd/queue',
      description: 'With doctor now'
    },
    {
      title: 'Completed',
      value: today.completed || 0,
      icon: CheckCircle,
      color: 'green',
      link: `/opd/visits?status=completed&date=today`,
      description: 'Finished today'
    },
    {
      title: 'No Show',
      value: today.no_show || 0,
      icon: XCircle,
      color: today.no_show > 0 ? 'red' : 'gray',
      link: `/opd/visits?status=no_show&date=today`,
      description: 'Did not arrive'
    },
  ] : [];

  const quickActions = [
    {
      title: 'Book Appointment',
      description: 'Schedule a new OPD visit',
      icon: CalendarPlus,
      link: '/opd/appointments/new',
      color: 'blue'
    },
    {
      title: "Today's Queue",
      description: 'View and manage today\'s patients',
      icon: ClipboardList,
      link: '/opd/queue',
      color: 'green'
    },
    {
      title: 'All Appointments',
      description: 'Browse all OPD visits',
      icon: Activity,
      link: '/opd/appointments',
      color: 'purple'
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading OPD Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-danger-600 dark:text-danger-400 mr-2" />
            <p className="text-danger-800 dark:text-danger-200">{error}</p>
          </div>
          <button
            onClick={loadDashboard}
            className="mt-3 px-4 py-2 bg-danger-600 dark:bg-danger-700 text-white rounded hover:bg-danger-700 dark:hover:bg-danger-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Out-Patient Department (OPD)</h1>
          <p className="text-muted-foreground mt-1">
            {stats?.date ? `Stats for ${new Date(stats.date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}` : 'Today\'s overview'}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadDashboard}
            className="p-2 rounded-lg border border-border hover:bg-accent transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-5 w-5 text-muted-foreground" />
          </button>
          <Link
            to="/opd/appointments/new"
            className="px-4 py-2 bg-primary-600 dark:bg-primary-700 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-800 flex items-center gap-2"
          >
            <CalendarPlus className="h-5 w-5" />
            Book Appointment
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Link
              key={index}
              to={stat.link}
              className={`block p-5 rounded-lg border-2 transition-all hover:shadow-lg ${colorClasses[stat.color]}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium opacity-80">{stat.title}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                  <p className="text-xs mt-1 opacity-70">{stat.description}</p>
                </div>
                <Icon className="h-7 w-7 opacity-60 flex-shrink-0" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-card rounded-lg shadow p-6 border border-border">
        <h2 className="text-xl font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link
                key={index}
                to={action.link}
                className={`p-4 rounded-lg border-2 hover:shadow-md transition-all ${colorClasses[action.color]}`}
              >
                <Icon className="h-8 w-8 mb-2" />
                <h3 className="font-semibold">{action.title}</h3>
                <p className="text-sm opacity-80 mt-1">{action.description}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Today's Queue Preview */}
      <div className="bg-card rounded-lg shadow p-6 border border-border">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-foreground">Today's Status Breakdown</h2>
          <Link to="/opd/queue" className="text-sm text-primary hover:underline">
            View Full Queue →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: 'Scheduled', value: today.scheduled || 0, color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' },
            { label: 'Checked In', value: today.checked_in || 0, color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200' },
            { label: 'In Consultation', value: today.in_consultation || 0, color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200' },
            { label: 'Completed', value: today.completed || 0, color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' },
            { label: 'No Show', value: today.no_show || 0, color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200' },
            { label: 'Total', value: today.total || 0, color: 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-200 font-bold' },
          ].map((item, i) => (
            <div key={i} className={`rounded-lg p-3 flex justify-between items-center ${item.color}`}>
              <span className="text-sm font-medium">{item.label}</span>
              <span className="text-2xl font-bold">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
