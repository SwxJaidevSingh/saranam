import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { TrendingUp, Calendar } from 'lucide-react';
import ipdApi from '../../api/ipd';

const VITAL_CONFIGS = {
  bp_systolic: { color: '#EF4444', label: 'BP Systolic', unit: 'mmHg' },
  bp_diastolic: { color: '#F59E0B', label: 'BP Diastolic', unit: 'mmHg' },
  temperature: { color: '#10B981', label: 'Temperature', unit: '°F' },
  pulse: { color: '#3B82F6', label: 'Pulse', unit: 'bpm' },
  respiratory_rate: { color: '#8B5CF6', label: 'Respiratory Rate', unit: '/min' },
  spo2: { color: '#06B6D4', label: 'SpO₂', unit: '%' },
  blood_sugar: { color: '#EC4899', label: 'Blood Sugar', unit: 'mg/dL' },
  weight: { color: '#6366F1', label: 'Weight', unit: 'kg' },
  pain_score: { color: '#F97316', label: 'Pain Score', unit: '/10' }
};

export default function VitalsHistoryChart({ admissionId }) {
  const [vitalsHistory, setVitalsHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVital, setSelectedVital] = useState('temperature');
  const [dateRange, setDateRange] = useState('7'); // days

  useEffect(() => {
    if (admissionId) {
      loadVitalsHistory();
    }
  }, [admissionId, dateRange]);

  const loadVitalsHistory = async () => {
    try {
      setIsLoading(true);
      const data = await ipdApi.getVitalsHistory(admissionId, 100);
      setVitalsHistory(data.vitals || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load vitals history:', err);
      setError('Failed to load vitals history');
    } finally {
      setIsLoading(false);
    }
  };

  // Transform data for charts
  const getChartData = () => {
    if (!vitalsHistory.length) return [];

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(dateRange));

    return vitalsHistory
      .filter(record => new Date(record.recorded_at) >= cutoffDate)
      .reverse()
      .map(record => {
        const date = new Date(record.recorded_at);
        return {
          timestamp: date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          fullDate: date.toLocaleString(),
          ...record.vitals_data,
          is_critical: record.is_critical
        };
      });
  };

  const chartData = getChartData();

  const getAvailableVitals = () => {
    if (!vitalsHistory.length) return [];

    const vitals = new Set();
    vitalsHistory.forEach(record => {
      Object.keys(record.vitals_data || {}).forEach(key => {
        if (VITAL_CONFIGS[key]) {
          vitals.add(key);
        }
      });
    });

    return Array.from(vitals);
  };

  const availableVitals = getAvailableVitals();

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg shadow p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading vitals history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card rounded-lg shadow p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      </div>
    );
  }

  if (!vitalsHistory.length) {
    return (
      <div className="bg-card rounded-lg shadow p-6">
        <div className="text-center py-8 text-muted-foreground">
          No vitals recorded yet
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-foreground mb-2">{data.fullDate}</p>
          {payload.map((entry, index) => (
            <div key={index} className="text-sm">
              <span style={{ color: entry.color }}>{entry.name}:</span>{' '}
              <span className="font-semibold">{entry.value}</span>{' '}
              <span className="text-muted-foreground">{VITAL_CONFIGS[entry.dataKey]?.unit}</span>
            </div>
          ))}
          {data.is_critical && (
            <div className="mt-2 pt-2 border-t border-border">
              <span className="text-xs text-red-600 font-semibold">⚠ Critical Value</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-card rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-bold text-foreground">Vitals Trend</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-1 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="1">Last 24 hours</option>
              <option value="3">Last 3 days</option>
              <option value="7">Last 7 days</option>
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Vital Selector */}
      <div className="mb-6 flex flex-wrap gap-2">
        {availableVitals.map(vital => (
          <button
            key={vital}
            onClick={() => setSelectedVital(vital)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedVital === vital
                ? 'bg-blue-600 text-white'
                : 'bg-secondary text-foreground hover:bg-accent'
            }`}
          >
            {VITAL_CONFIGS[vital]?.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 ? (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                label={{
                  value: VITAL_CONFIGS[selectedVital]?.unit,
                  angle: -90,
                  position: 'insideLeft',
                  style: { fontSize: 12 }
                }}
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey={selectedVital}
                stroke={VITAL_CONFIGS[selectedVital]?.color}
                strokeWidth={2}
                name={VITAL_CONFIGS[selectedVital]?.label}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          No {VITAL_CONFIGS[selectedVital]?.label} data available for selected period
        </div>
      )}

      {/* Statistics */}
      {chartData.length > 0 && (() => {
        const values = chartData
          .map(d => d[selectedVital])
          .filter(v => v !== null && v !== undefined);

        if (values.length === 0) return null;

        const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
        const min = Math.min(...values).toFixed(1);
        const max = Math.max(...values).toFixed(1);

        return (
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-xs text-blue-600 font-medium mb-1">Average</div>
              <div className="text-xl font-bold text-blue-900">
                {avg} <span className="text-sm font-normal">{VITAL_CONFIGS[selectedVital]?.unit}</span>
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-xs text-green-600 font-medium mb-1">Minimum</div>
              <div className="text-xl font-bold text-green-900">
                {min} <span className="text-sm font-normal">{VITAL_CONFIGS[selectedVital]?.unit}</span>
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <div className="text-xs text-red-600 font-medium mb-1">Maximum</div>
              <div className="text-xl font-bold text-red-900">
                {max} <span className="text-sm font-normal">{VITAL_CONFIGS[selectedVital]?.unit}</span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
