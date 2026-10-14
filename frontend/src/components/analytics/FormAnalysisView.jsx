import {
  FileText,
  CheckCircle2,
  Clock,
  TrendingUp,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  LabelList
} from 'recharts';

import { StatCard } from './StatCard';
import { ChartCard } from './ChartCard';

const CHART_COLORS = {
  primary: '#0ea5e9',
  secondary: '#d946ef',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#9c27b0',
  gradient: ['#0ea5e9', '#d946ef', '#22c55e', '#f59e0b', '#ef4444']
};

export function FormAnalysisView({ data, loading }) {
  const { summary, status_breakdown, top_forms, submission_trends, completion_funnel } = data || {};

  // Format funnel data for visualization
  const funnelData = completion_funnel ? [
    { name: 'Started', value: completion_funnel.started, fill: CHART_COLORS.primary },
    { name: 'Submitted', value: completion_funnel.submitted, fill: CHART_COLORS.success },
    { name: 'Verified', value: completion_funnel.verified, fill: CHART_COLORS.purple },
  ] : [];

  // Format status breakdown for pie chart
  const statusChartData = status_breakdown?.map((item, index) => ({
    name: item.status.charAt(0).toUpperCase() + item.status.slice(1),
    value: item.count,
    percentage: item.percentage,
  })) || [];

  // Format top forms for bar chart
  const topFormsChartData = top_forms?.map(form => ({
    name: form.form_name.length > 20 ? form.form_name.substring(0, 20) + '...' : form.form_name,
    submissions: form.submissions
  })) || [];

  // Format submission trends for line chart
  const trendsChartData = submission_trends?.map(item => ({
    month: item.month,
    submissions: item.submissions
  })) || [];

  return (
    <div className="space-y-8">
      {/* Summary Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Forms"
          value={summary?.total_forms?.toLocaleString() || '0'}
          icon={FileText}
          iconColor="text-primary-600"
          iconBgColor="bg-primary-100"
          isLoading={loading}
        />
        <StatCard
          title="Total Submissions"
          value={summary?.total_submissions?.toLocaleString() || '0'}
          icon={TrendingUp}
          iconColor="text-success-600"
          iconBgColor="bg-success-100"
          isLoading={loading}
        />
        <StatCard
          title="Completion Rate"
          value={`${summary?.average_completion_rate || 0}%`}
          icon={CheckCircle2}
          iconColor="text-purple-600"
          iconBgColor="bg-purple-100"
          isLoading={loading}
        />
        <StatCard
          title="Avg Completion Time"
          value={`${summary?.average_completion_time_minutes || 0} min`}
          icon={Clock}
          iconColor="text-warning-600"
          iconBgColor="bg-warning-100"
          isLoading={loading}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Form Completion Funnel */}
        <ChartCard
          id="form-completion-funnel-chart"
          title="Form Completion Funnel"
          description="Progression from started to verified"
          isLoading={loading}
        >
          <div className="space-y-4">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={funnelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis dataKey="name" type="category" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    padding: '8px 12px'
                  }}
                />
                <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                  {funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {completion_funnel && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Submission Rate</p>
                  <p className="text-lg font-semibold text-success-600">
                    {completion_funnel.submission_rate}%
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Verification Rate</p>
                  <p className="text-lg font-semibold text-purple-600">
                    {completion_funnel.verification_rate}%
                  </p>
                </div>
              </div>
            )}
          </div>
        </ChartCard>

        {/* Submission Status Breakdown */}
        <ChartCard
          id="submission-status-chart"
          title="Submission Status"
          description="Distribution by submission status"
          isLoading={loading}
        >
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => `${name}: ${percentage}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {statusChartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={CHART_COLORS.gradient[index % CHART_COLORS.gradient.length]}
                  />
                ))}
              </Pie>
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  padding: '8px 12px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Top Forms and Trends */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Forms by Usage */}
        <ChartCard
          id="top-forms-usage-chart"
          title="Top Forms by Usage"
          description="Most submitted forms"
          isLoading={loading}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topFormsChartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="name"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  padding: '8px 12px'
                }}
                formatter={(value) => [value, 'Submissions']}
              />
              <Legend />
              <Bar
                dataKey="submissions"
                fill={CHART_COLORS.primary}
                name="Submissions"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Submission Trends */}
        <ChartCard
          id="form-submission-trends-chart"
          title="Form Submission Trends"
          description="Submissions over the last 12 months"
          isLoading={loading}
        >
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendsChartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="month"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  padding: '8px 12px'
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="submissions"
                stroke={CHART_COLORS.success}
                strokeWidth={3}
                name="Submissions"
                dot={{ r: 4, fill: CHART_COLORS.success }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
