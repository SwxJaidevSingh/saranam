import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Bed,
  Users,
  UserPlus,
  UserMinus,
  Activity,
  AlertTriangle,
  Clock,
  TrendingUp,
  BedDouble,
  Calendar
} from 'lucide-react';
import ipdApi from '../../api/ipd';

export default function IPDDashboard() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setIsLoading(true);
      const data = await ipdApi.getDashboard();
      setStats(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load IPD dashboard:', err);
      setError('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const getOccupancyColor = (rate) => {
    if (rate >= 90) return 'text-danger-600 dark:text-danger-400 bg-danger-50 dark:bg-danger-900/20';
    if (rate >= 75) return 'text-warning-600 dark:text-warning-400 bg-warning-50 dark:bg-warning-900/20';
    if (rate >= 50) return 'text-warning-600 dark:text-warning-400 bg-warning-50 dark:bg-warning-900/20';
    return 'text-success-600 dark:text-success-400 bg-success-50 dark:bg-success-900/20';
  };

  const statCards = stats ? [
    {
      title: 'Active Admissions',
      value: stats.active_admissions || 0,
      icon: Users,
      color: 'blue',
      link: '/ipd/admissions?status=active',
      description: `${stats.total_admissions || 0} total admissions`
    },
    {
      title: 'Available Beds',
      value: stats.available_beds || 0,
      icon: Bed,
      color: 'green',
      link: '/ipd/beds?status=available',
      description: `${stats.total_beds || 0} total beds`
    },
    {
      title: 'Bed Occupancy',
      value: `${stats.bed_occupancy_rate || 0}%`,
      icon: TrendingUp,
      color: stats.bed_occupancy_rate >= 90 ? 'red' : stats.bed_occupancy_rate >= 75 ? 'orange' : 'green',
      link: '/ipd/beds',
      description: `${stats.occupied_beds || 0} occupied`
    },
    {
      title: "Today's Discharges",
      value: stats.total_discharges_today || 0,
      icon: UserMinus,
      color: 'purple',
      link: '/ipd/admissions?status=discharged',
      description: 'Discharged today'
    },
    {
      title: 'Waiting List',
      value: stats.waiting_list_count || 0,
      icon: Clock,
      color: 'yellow',
      link: '/ipd/waiting-list',
      description: 'Patients waiting for beds'
    },
    {
      title: 'Critical Vitals',
      value: stats.critical_vitals_count || 0,
      icon: AlertTriangle,
      color: stats.critical_vitals_count > 0 ? 'red' : 'gray',
      link: '/ipd/vitals/critical',
      description: 'Last 24 hours'
    },
    {
      title: 'Avg Length of Stay',
      value: `${stats.average_length_of_stay || 0} days`,
      icon: Calendar,
      color: 'indigo',
      link: '/ipd/analytics',
      description: 'Average LOS'
    },
    {
      title: 'Beds in Cleaning',
      value: stats.cleaning_beds || 0,
      icon: Activity,
      color: 'gray',
      link: '/ipd/beds?status=cleaning',
      description: `${stats.maintenance_beds || 0} in maintenance`
    }
  ] : [];

  const colorClasses = {
    blue: 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800',
    green: 'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-300 border-success-200 dark:border-success-800',
    red: 'bg-danger-50 dark:bg-danger-900/20 text-danger-700 dark:text-danger-300 border-danger-200 dark:border-danger-800',
    orange: 'bg-warning-50 dark:bg-warning-900/20 text-warning-700 dark:text-warning-300 border-warning-200 dark:border-warning-800',
    purple: 'bg-secondary-50 dark:bg-secondary-900/20 text-secondary-700 dark:text-secondary-300 border-secondary-200 dark:border-secondary-800',
    yellow: 'bg-warning-50 dark:bg-warning-900/20 text-warning-700 dark:text-warning-300 border-warning-200 dark:border-warning-800',
    gray: 'bg-muted text-muted-foreground border-border',
    indigo: 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800'
  };

  const quickActions = [
    {
      title: 'Admit Patient',
      description: 'Start new IPD admission',
      icon: UserPlus,
      link: '/ipd/admissions/new',
      color: 'blue'
    },
    {
      title: 'Manage Beds',
      description: 'View and assign beds',
      icon: BedDouble,
      link: '/ipd/beds',
      color: 'green'
    },
    {
      title: 'Waiting List',
      description: 'Manage bed waiting queue',
      icon: Clock,
      link: '/ipd/waiting-list',
      color: 'yellow'
    },
    {
      title: 'Critical Alerts',
      description: 'View critical vitals',
      icon: AlertTriangle,
      link: '/ipd/vitals/critical',
      color: 'red'
    }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading IPD Dashboard...</p>
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
          <h1 className="text-3xl font-bold text-foreground">
            In-Patient Department (IPD)
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor admissions, bed occupancy, and patient vitals
          </p>
        </div>
        <Link
          to="/ipd/admissions/new"
          className="px-4 py-2 bg-primary-600 dark:bg-primary-700 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-800 flex items-center gap-2"
        >
          <UserPlus className="h-5 w-5" />
          Admit Patient
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Link
              key={index}
              to={stat.link}
              className={`block p-6 rounded-lg border-2 transition-all hover:shadow-lg ${colorClasses[stat.color]}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium opacity-80">{stat.title}</p>
                  <p className="text-3xl font-bold mt-2">{stat.value}</p>
                  <p className="text-xs mt-1 opacity-70">{stat.description}</p>
                </div>
                <Icon className="h-8 w-8 opacity-60" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Bed Occupancy Breakdown */}
      {stats?.bed_type_breakdown && stats.bed_type_breakdown.length > 0 && (
        <div className="bg-card rounded-lg shadow p-6 border border-border">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Bed Occupancy by Type
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.bed_type_breakdown.map((bedType, index) => (
              <div key={index} className="border border-border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium text-foreground capitalize">
                    {bedType.bed_type.replace('_', ' ')}
                  </h3>
                  <span className={`text-sm font-semibold px-2 py-1 rounded ${getOccupancyColor(bedType.occupancy_rate)}`}>
                    {bedType.occupancy_rate.toFixed(0)}%
                  </span>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Total:</span>
                    <span className="font-medium">{bedType.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Occupied:</span>
                    <span className="font-medium text-danger-600 dark:text-danger-400">{bedType.occupied}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Available:</span>
                    <span className="font-medium text-success-600 dark:text-success-400">{bedType.available}</span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="mt-3 bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all"
                    style={{ width: `${bedType.occupancy_rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-card rounded-lg shadow p-6 border border-border">
        <h2 className="text-xl font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Critical Alerts */}
      {stats?.critical_vitals_count > 0 && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border-2 border-danger-200 dark:border-danger-800 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-danger-600 dark:text-danger-400" />
              <div>
                <h3 className="font-semibold text-danger-900 dark:text-danger-100">
                  {stats.critical_vitals_count} Critical Vital Sign{stats.critical_vitals_count > 1 ? 's' : ''} Detected
                </h3>
                <p className="text-sm text-danger-700 dark:text-danger-300 mt-1">
                  Review patient vitals immediately for abnormal values
                </p>
              </div>
            </div>
            <Link
              to="/ipd/vitals/critical"
              className="px-4 py-2 bg-danger-600 dark:bg-danger-700 text-white rounded-lg hover:bg-danger-700 dark:hover:bg-danger-800"
            >
              View Critical Vitals
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
