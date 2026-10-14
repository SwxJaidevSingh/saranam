import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import analyticsApi from '../api/analytics';
import formsApi from '../api/forms';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Calendar, TrendingUp, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

// Theme-aware color palettes
const LIGHT_COLORS = ['#0ea5e9', '#d946ef', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];
const DARK_COLORS = ['#60a5fa', '#e879f9', '#4ade80', '#fbbf24', '#f87171', '#a78bfa'];

export default function Analytics() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const COLORS = theme === 'dark' ? DARK_COLORS : LIGHT_COLORS;

  const [forms, setForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState('');
  const [dateRange, setDateRange] = useState('30'); // days
  const [analytics, setAnalytics] = useState(null);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [formComparison, setFormComparison] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (forms.length > 0 && !selectedForm) {
      setSelectedForm(forms[0].id);
    }
  }, [forms]);

  useEffect(() => {
    if (selectedForm) {
      loadAnalytics();
    }
  }, [selectedForm, dateRange]);

  const loadInitialData = async () => {
    try {
      const [formsData, statsData, comparisonData] = await Promise.all([
        formsApi.getAllForms(),
        analyticsApi.getDashboardStats(),
        analyticsApi.getFormComparison()
      ]);

      setForms(formsData.forms || []);
      setDashboardStats(statsData);
      setFormComparison(comparisonData.comparison || []);
    } catch (err) {
      console.error('Error loading initial data:', err);
    }
  };

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - parseInt(dateRange));

      const data = await analyticsApi.getFormAnalytics(
        selectedForm,
        { date_from: dateFrom.toISOString().split('T')[0] }
      );
      setAnalytics(data.analytics || data);
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Process data for trend chart from dashboard stats
  const trendData = dashboardStats?.submission_trends || [];

  // Process data for form usage comparison from real data
  const formUsageData = formComparison.map((form, index) => ({
    name: form.form_name,
    submissions: form.total_submissions,
    fill: COLORS[index % COLORS.length],
  }));

  // Process field aggregations (numeric fields) from analytics API
  const fieldAggregations = analytics?.numeric_aggregations || {};

  // Process distribution data (categorical fields) from analytics API
  // Extract first categorical field distribution for demo
  const firstCategoricalField = analytics?.field_analytics
    ? Object.entries(analytics.field_analytics)[0]
    : null;

  const distributionData = firstCategoricalField
    ? Object.entries(firstCategoricalField[1].value_distribution || {}).map(([name, value]) => ({
        name,
        value
      }))
    : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">Visualize and analyze form submission data</p>
        </div>
        <button 
          onClick={() => navigate('/analytics/forms')} 
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium shadow-sm"
        >
          <TrendingUp className="w-4 h-4" />
          Advanced Form Hub
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Form Selection */}
          <div>
            <label className="form-label">Select Form</label>
            <select
              value={selectedForm}
              onChange={(e) => setSelectedForm(e.target.value)}
              className="input"
            >
              {forms.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div>
            <label className="form-label">Date Range</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="input"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-64 bg-secondary rounded" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Submission Trends Chart */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Submission Trends</h2>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-muted-foreground" />
                <YAxis className="text-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    color: 'hsl(var(--foreground))',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke={COLORS[0]}
                  fillOpacity={1}
                  fill="url(#colorCount)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Form Usage Comparison */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Form Usage Comparison</h2>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={formUsageData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-muted-foreground" />
                <YAxis className="text-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    color: 'hsl(var(--foreground))',
                  }}
                />
                <Legend />
                <Bar dataKey="submissions" fill={COLORS[0]}>
                  {formUsageData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Field Aggregations */}
          {Object.keys(fieldAggregations).length > 0 && (
            <div className="card">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                Numeric Field Aggregations
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(fieldAggregations).map(([field, stats]) => (
                  <div key={field} className="bg-secondary rounded-lg p-4">
                    <h3 className="font-medium text-foreground capitalize mb-3">
                      {field.replace(/_/g, ' ')}
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Average:</span>
                        <span className="font-semibold text-primary">
                          {stats.average?.toFixed(2) || stats.avg?.toFixed(2) || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Min:</span>
                        <span className="font-semibold text-foreground">{stats.min}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Max:</span>
                        <span className="font-semibold text-foreground">{stats.max}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Count:</span>
                        <span className="font-semibold text-foreground">{stats.count}</span>
                      </div>
                      {stats.sum && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Sum:</span>
                          <span className="font-semibold text-foreground">{stats.sum.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Distribution Charts */}
          {distributionData.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <PieChartIcon className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">
                  {firstCategoricalField[0].replace(/_/g, ' ')} Distribution
                </h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={distributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={100}
                    fill={COLORS[0]}
                    dataKey="value"
                  >
                    {distributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      color: 'hsl(var(--foreground))',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
