import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, Calendar } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getCohortOutcomes } from '@/api/cohorts';
import { format } from 'date-fns';

const METRICS = [
  { value: 'average_bp', label: 'Average Blood Pressure' },
  { value: 'average_glucose', label: 'Average Glucose' },
  { value: 'average_weight', label: 'Average Weight' },
  { value: 'visit_count', label: 'Visit Count' },
  { value: 'compliance_rate', label: 'Compliance Rate' },
];

const TIME_RANGES = [
  { value: '30', label: 'Last 30 days' },
  { value: '60', label: 'Last 60 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '180', label: 'Last 6 months' },
  { value: '365', label: 'Last year' },
];

export function OutcomeTracker({ cohortId }) {
  const [selectedMetric, setSelectedMetric] = useState('average_bp');
  const [timeRange, setTimeRange] = useState('90');
  const [outcomes, setOutcomes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadOutcomes();
  }, [cohortId, selectedMetric, timeRange]);

  const loadOutcomes = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCohortOutcomes(cohortId, selectedMetric, parseInt(timeRange));

      // Transform data for chart
      const chartData = (data.outcomes || []).map(outcome => ({
        date: format(new Date(outcome.recorded_at), 'MMM d'),
        value: parseFloat(outcome.value) || 0,
        fullDate: format(new Date(outcome.recorded_at), 'PPP'),
      }));

      setOutcomes(chartData);
      calculateStats(chartData);
    } catch (err) {
      console.error('Error loading outcomes:', err);
      setError(err.response?.data?.error || 'Failed to load outcome data');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data) => {
    if (data.length === 0) {
      setStats(null);
      return;
    }

    const values = data.map(d => d.value);
    const latest = values[values.length - 1];
    const earliest = values[0];
    const average = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const trend = latest > earliest ? 'up' : latest < earliest ? 'down' : 'stable';
    const changePercent = earliest !== 0 ? ((latest - earliest) / earliest) * 100 : 0;

    setStats({
      latest,
      average,
      min,
      max,
      trend,
      changePercent: Math.abs(changePercent),
    });
  };

  const formatValue = (value) => {
    if (selectedMetric.includes('rate')) {
      return `${value.toFixed(1)}%`;
    }
    return value.toFixed(1);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Outcome Tracking</CardTitle>
          <CardDescription>
            Monitor trends and metrics for this cohort over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="metric-select">Metric</Label>
              <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                <SelectTrigger id="metric-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METRICS.map((metric) => (
                    <SelectItem key={metric.value} value={metric.value}>
                      {metric.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="time-range-select">Time Range</Label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger id="time-range-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_RANGES.map((range) => (
                    <SelectItem key={range.value} value={range.value}>
                      {range.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Latest Value</CardDescription>
              <div className="flex items-center gap-2">
                <CardTitle className="text-2xl">{formatValue(stats.latest)}</CardTitle>
                {stats.trend === 'up' && <TrendingUp className="h-4 w-4 text-success-600" />}
                {stats.trend === 'down' && <TrendingDown className="h-4 w-4 text-danger-600" />}
              </div>
              {stats.changePercent > 0 && (
                <Badge
                  variant="outline"
                  className={
                    stats.trend === 'up'
                      ? 'border-success-300 bg-success-50 text-success-700'
                      : 'border-danger-300 bg-danger-50 text-danger-700'
                  }
                >
                  {stats.trend === 'up' ? '+' : '-'}{stats.changePercent.toFixed(1)}%
                </Badge>
              )}
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Average</CardDescription>
              <CardTitle className="text-2xl">{formatValue(stats.average)}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Minimum</CardDescription>
              <CardTitle className="text-2xl">{formatValue(stats.min)}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Maximum</CardDescription>
              <CardTitle className="text-2xl">{formatValue(stats.max)}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      ) : null}

      {/* Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Trend Visualization</CardTitle>
              <CardDescription>
                {METRICS.find(m => m.value === selectedMetric)?.label} over time
              </CardDescription>
            </div>
            <Badge variant="outline" className="gap-1">
              <Calendar className="h-3 w-3" />
              {TIME_RANGES.find(r => r.value === timeRange)?.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-80 w-full" />
          ) : error ? (
            <div className="bg-danger-50 border border-danger-200 text-danger-800 px-4 py-3 rounded-lg">
              <p className="font-medium">Error loading outcome data</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          ) : outcomes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Activity className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No outcome data available</p>
              <p className="text-sm text-muted-foreground mt-2">
                Outcome tracking data will appear here once recorded for this cohort
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={outcomes}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => [formatValue(value), selectedMetric]}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      return payload[0].payload.fullDate;
                    }
                    return label;
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                  activeDot={{ r: 6 }}
                  name={METRICS.find(m => m.value === selectedMetric)?.label}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
