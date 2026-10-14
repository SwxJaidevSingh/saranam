import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import analyticsApi from '../api/analytics';
import {
  FileText,
  Send,
  Users,
  UserCheck,
  UserX,
  UserMinus,
  UserPlus,
  Calendar,
  CalendarPlus,
  BarChart3,
  Plus,
  Clock,
  TrendingUp,
  Activity
} from 'lucide-react';

// Color mapping for stat/action cards - Tailwind requires complete class names at build time
const colorClasses = {
  primary: {
    bg: 'bg-primary-100 dark:bg-primary-900/20',
    text: 'text-primary-600 dark:text-primary-400',
  },
  success: {
    bg: 'bg-success-100 dark:bg-success-900/20',
    text: 'text-success-600 dark:text-success-400',
  },
  secondary: {
    bg: 'bg-secondary-100 dark:bg-secondary-900/20',
    text: 'text-secondary-600 dark:text-secondary-400',
  },
  warning: {
    bg: 'bg-warning-100 dark:bg-warning-900/20',
    text: 'text-warning-600 dark:text-warning-400',
  },
};

const getActivityIcon = (type) => {
  switch (type) {
    case 'patient_created':
      return { icon: UserPlus, bg: colorClasses.primary.bg, text: colorClasses.primary.text, label: 'New Patient' };
    case 'patient_updated':
      return { icon: UserCheck, bg: colorClasses.warning.bg, text: colorClasses.warning.text, label: 'Patient Updated' };
    case 'visit_created':
      return { icon: CalendarPlus, bg: colorClasses.success.bg, text: colorClasses.success.text, label: 'New Visit' };
    case 'visit_updated':
      return { icon: Calendar, bg: colorClasses.warning.bg, text: colorClasses.warning.text, label: 'Visit Updated' };
    case 'form_submitted':
    default:
      return { icon: FileText, bg: colorClasses.secondary.bg, text: colorClasses.secondary.text, label: 'Submission' };
  }
};

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      const data = await analyticsApi.getDashboardStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /*
  // Old Stats Cards (Total Forms, Total Submissions, Active Users, This Week):
  const stats_cards = stats ? [
    {
      title: 'Total Forms',
      value: stats.total_forms || 0,
      icon: FileText,
      color: 'primary',
      link: '/forms',
    },
    {
      title: 'Total Submissions',
      value: stats.total_submissions || 0,
      icon: Send,
      color: 'success',
      link: '/submissions',
    },
    {
      title: 'Active Users',
      value: stats.total_users || 0,
      icon: Users,
      color: 'secondary',
      link: user?.role === 'admin' ? '/users' : null,
    },
    {
      title: 'This Week',
      value: stats.submissions_this_week || 0,
      icon: TrendingUp,
      color: 'warning',
      link: '/analytics',
    },
  ] : [];
  */

  // New Stats Cards (Total Patients, Active Patients, Inactive Patients, Deceased Patients):
  const stats_cards = stats ? [
    {
      title: 'Total Patients',
      value: stats.total_patients || 0,
      icon: Users,
      color: 'primary',
      link: '/patients',
    },
    {
      title: 'Active Patients',
      value: stats.active_patients || 0,
      icon: UserCheck,
      color: 'success',
      link: '/patients?status=alive_active',
    },
    {
      title: 'Inactive Patients',
      value: stats.inactive_patients || 0,
      icon: UserX,
      color: 'warning',
      link: '/patients?status=inactive',
    },
    {
      title: 'Deceased Patients',
      value: stats.deceased_patients || 0,
      icon: UserMinus,
      color: 'secondary',
      link: '/patients?status=dead',
    },
  ] : [];

  /*
  // Old Quick Actions:
  const quickActions = [
    {
      title: 'Create New Form',
      description: 'Build a new form template',
      icon: Plus,
      link: '/forms/new',
      color: 'primary',
      permission: 'create_form',
    },
    {
      title: 'Submit Data',
      description: 'Fill out a form',
      icon: Send,
      link: '/forms',
      color: 'success',
      permission: 'submit_form',
    },
    {
      title: 'View Analytics',
      description: 'See reports and insights',
      icon: BarChart3,
      link: '/analytics',
      color: 'secondary',
      permission: 'view_analytics',
    },
  ];
  */

  // New Quick Actions:
  const quickActions = [
    {
      title: 'Add New Patient',
      description: 'Register a new patient record',
      icon: UserPlus,
      link: '/patients?action=add',
      color: 'primary',
      permission: 'view_patients',
    },
    {
      title: 'View Patient List',
      description: 'Browse all patient records',
      icon: Users,
      link: '/patients',
      color: 'success',
      permission: 'view_patients',
    },
    {
      title: 'View Analytics',
      description: 'See reports and insights',
      icon: BarChart3,
      link: '/analytics',
      color: 'secondary',
      permission: 'view_analytics',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Welcome back, {user?.full_name}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Here's what's happening with your health data today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-24 bg-muted rounded" />
            </div>
          ))
        ) : (
          stats_cards.map((stat, index) => {
            const Icon = stat.icon;
            const CardComponent = stat.link ? Link : 'div';
            const colors = colorClasses[stat.color] || colorClasses.primary;

            return (
              <CardComponent
                key={index}
                to={stat.link}
                className={`card ${stat.link ? 'card-hover' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </p>
                    <p className="text-3xl font-bold text-foreground mt-2">
                      {stat.value}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${colors.bg}`}>
                    <Icon className={`w-6 h-6 ${colors.text}`} />
                  </div>
                </div>
              </CardComponent>
            );
          })
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            const hasPermission = !action.permission || user?.role === 'admin' || user?.permissions?.includes(action.permission);
            const colors = colorClasses[action.color] || colorClasses.primary;

            if (!hasPermission) return null;

            return (
              <Link
                key={index}
                to={action.link}
                className="card-hover flex items-start gap-4 p-6"
              >
                <div className={`p-3 rounded-lg ${colors.bg} flex-shrink-0`}>
                  <Icon className={`w-6 h-6 ${colors.text}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{action.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Recent Activity</h2>
            <p className="text-xs text-muted-foreground">Last 20 system events (Patient registrations, visit updates, form submissions)</p>
          </div>
          <Link to="/patients" className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium">
            View patients
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : (stats?.recent_activities || stats?.recent_submissions) && (stats?.recent_activities || stats?.recent_submissions).length > 0 ? (
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {(stats?.recent_activities || stats?.recent_submissions).slice(0, 20).map((activity, index) => {
              const { icon: Icon, bg, text, label } = getActivityIcon(activity.type);
              const title = activity.title || activity.form_name || 'Activity';
              const description = activity.description || (activity.submitted_by_name ? `by ${activity.submitted_by_name}` : '');
              const link = activity.link || (activity.id ? `/submissions/${activity.id}` : '#');
              const dateStr = activity.timestamp || activity.created_at;

              return (
                <Link
                  key={activity.id || index}
                  to={link}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors border border-transparent hover:border-border/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2.5 rounded-lg ${bg} flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${text}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground truncate">{title}</p>
                        <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${bg} ${text} flex-shrink-0`}>
                          {label}
                        </span>
                      </div>
                      {description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0 ml-4">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {dateStr ? new Date(dateStr).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : ''}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No recent activity found</p>
          </div>
        )}
      </div>
    </div>
  );
}
