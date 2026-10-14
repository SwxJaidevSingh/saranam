/**
 * ServiceLanding - Main /services page
 * Follows the same UI standards as Dashboard.jsx
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Stethoscope,
  HeartHandshake,
  Home,
  Calendar,
  List,
  Plus,
  ArrowRight,
  Loader2,
  Users,
  ClipboardList,
  Activity
} from 'lucide-react';
import { servicesApi } from '../../api/services';

const SERVICE_TYPES = [
  {
    key: 'ipd',
    title: 'In-Patient Department',
    shortTitle: 'IPD',
    description: '24/7 inpatient care with bed management, admission workflows, and continuous monitoring.',
    icon: Building2,
    color: 'purple',
    features: ['Bed & Ward Management', 'Admission/Discharge', 'Round-the-clock Care', 'Daily Monitoring'],
  },
  {
    key: 'opd',
    title: 'Out-Patient Department',
    shortTitle: 'OPD',
    description: 'Outpatient consultations, follow-ups, prescription management, and quick appointments.',
    icon: Stethoscope,
    color: 'blue',
    features: ['Same-day Appointments', 'Follow-up Scheduling', 'Prescriptions', 'Specialist Referrals'],
  },
  {
    key: 'physiotherapy',
    title: 'Physiotherapy',
    shortTitle: 'Physio',
    description: 'Rehabilitation and physical therapy with session tracking and progress monitoring.',
    icon: HeartHandshake,
    color: 'green',
    features: ['Session Tracking', 'Progress Reports', 'Exercise Plans', 'Pain Management'],
  },
  {
    key: 'home-care',
    title: 'Home Care',
    shortTitle: 'Home Care',
    description: 'In-home medical services including nursing care, doctor visits, and health monitoring.',
    icon: Home,
    color: 'orange',
    features: ['Doctor Home Visits', 'Nursing Care', 'Medical Equipment', 'Health Monitoring'],
  },
];

const colorMap = {
  purple: {
    bg: 'bg-secondary-100 dark:bg-secondary-900/20',
    text: 'text-secondary-600 dark:text-secondary-400',
    border: 'border-secondary-200 dark:border-secondary-800',
    button: 'bg-secondary-600 dark:bg-secondary-700 hover:bg-secondary-700 dark:hover:bg-secondary-800',
    badge: 'bg-secondary-50 dark:bg-secondary-900/20 text-secondary-700 dark:text-secondary-300',
    stat: 'bg-secondary-50 dark:bg-secondary-900/20',
  },
  blue: {
    bg: 'bg-primary-100 dark:bg-primary-900/20',
    text: 'text-primary-600 dark:text-primary-400',
    border: 'border-primary-200 dark:border-primary-800',
    button: 'bg-primary-600 dark:bg-primary-700 hover:bg-primary-700 dark:hover:bg-primary-800',
    badge: 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300',
    stat: 'bg-primary-50 dark:bg-primary-900/20',
  },
  green: {
    bg: 'bg-success-100 dark:bg-success-900/20',
    text: 'text-success-600 dark:text-success-400',
    border: 'border-success-200 dark:border-success-800',
    button: 'bg-success-600 dark:bg-success-700 hover:bg-success-700 dark:hover:bg-success-800',
    badge: 'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-300',
    stat: 'bg-success-50 dark:bg-success-900/20',
  },
  orange: {
    bg: 'bg-warning-100 dark:bg-warning-900/20',
    text: 'text-warning-600 dark:text-warning-400',
    border: 'border-warning-200 dark:border-warning-800',
    button: 'bg-warning-600 dark:bg-warning-700 hover:bg-warning-700 dark:hover:bg-warning-800',
    badge: 'bg-warning-50 dark:bg-warning-900/20 text-warning-700 dark:text-warning-300',
    stat: 'bg-warning-50 dark:bg-warning-900/20',
  },
};

export default function ServiceLanding() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    servicesApi.getStats()
      .then(data => setStats(data))
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, []);

  const getTypeCount = (type) => {
    if (!stats?.by_type) return 0;
    const key = type.toUpperCase().replace('-', '_');
    return stats.by_type[key] || 0;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Healthcare Services</h1>
          <p className="text-muted-foreground mt-1">
            Manage appointments, doctors, and patient care across all service departments.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/services/my-bookings')}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            <List className="h-4 w-4" />
            My Bookings
          </button>
          <button
            onClick={() => navigate('/services/book')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 dark:bg-primary-700 text-white rounded-lg text-sm font-medium hover:bg-primary-700 dark:hover:bg-primary-800 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Book Service
          </button>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {SERVICE_TYPES.map((svc) => {
          const colors = colorMap[svc.color];
          const Icon = svc.icon;
          const count = loadingStats ? '...' : getTypeCount(svc.key);
          return (
            <div key={svc.key} className={`card card-hover`} onClick={() => navigate(`/services/${svc.key}`)}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{svc.shortTitle}</p>
                  <p className="text-3xl font-bold text-foreground mt-2">
                    {loadingStats ? <Loader2 className="h-6 w-6 animate-spin inline text-muted-foreground" /> : count}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Active Services</p>
                </div>
                <div className={`p-3 rounded-lg ${colors.bg}`}>
                  <Icon className={`w-6 h-6 ${colors.text}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Service Cards */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">Service Departments</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {SERVICE_TYPES.map((svc) => {
            const colors = colorMap[svc.color];
            const Icon = svc.icon;
            return (
              <div
                key={svc.key}
                className={`card card-hover border-l-4 ${colors.border}`}
                onClick={() => navigate(`/services/${svc.key}`)}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${colors.bg} flex-shrink-0`}>
                    <Icon className={`h-7 w-7 ${colors.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-foreground">{svc.title}</h3>
                      <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 mb-3">{svc.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {svc.features.map((f) => (
                        <span key={f} className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors.badge}`}>
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border flex gap-2">
                  <button
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-white text-sm font-medium transition-colors ${colors.button}`}
                    onClick={(e) => { e.stopPropagation(); navigate(`/services/${svc.key}`); }}
                  >
                    <ClipboardList className="h-4 w-4" />
                    Manage {svc.shortTitle}
                  </button>
                  <button
                    className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-accent transition-colors"
                    onClick={(e) => { e.stopPropagation(); navigate(`/services/book`); }}
                  >
                    <Calendar className="h-4 w-4" />
                    Book
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: 'Book Appointment',
              description: 'Schedule a new appointment for any service',
              icon: Calendar,
              color: 'primary',
              link: '/services/book',
            },
            {
              title: 'View All Doctors',
              description: 'Browse and manage healthcare providers',
              icon: Users,
              color: 'success',
              link: '/providers',
            },
            {
              title: 'My Bookings',
              description: 'Track your existing service bookings',
              icon: Activity,
              color: 'secondary',
              link: '/services/my-bookings',
            },
          ].map((action) => {
            const Icon = action.icon;
            const actionColors = {
              primary: {
                bg: 'bg-primary-100 dark:bg-primary-900/20',
                text: 'text-primary-600 dark:text-primary-400'
              },
              success: {
                bg: 'bg-success-100 dark:bg-success-900/20',
                text: 'text-success-600 dark:text-success-400'
              },
              secondary: {
                bg: 'bg-secondary-100 dark:bg-secondary-900/20',
                text: 'text-secondary-600 dark:text-secondary-400'
              }
            };
            const colors = actionColors[action.color];
            return (
              <button
                key={action.title}
                onClick={() => navigate(action.link)}
                className="card-hover flex items-start gap-4 p-6 text-left w-full"
              >
                <div className={`p-3 rounded-lg ${colors.bg} flex-shrink-0`}>
                  <Icon className={`w-6 h-6 ${colors.text}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{action.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}