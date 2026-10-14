import React, { useState, useEffect } from 'react';
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { analyticsApi } from '../../../api/analytics';
import { Loader2, AlertCircle, Download } from 'lucide-react';
import { exportChartAsSvg } from '../../../utils/chartExport';

// Common colors for charts
const COLORS = ['#0ea5e9', '#3b82f6', '#8b5cf6', '#6366f1', '#14b8a6', '#f59e0b', '#ef4444', '#ec4899'];

export default function FieldValueDistribution({ formId, fieldId, fieldType, fieldLabel }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (formId && fieldId && fieldType) {
      loadDistributionData();
    }
  }, [formId, fieldId, fieldType]);

  const loadDistributionData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await analyticsApi.getAdvancedFieldDistribution(formId, fieldId, fieldType);
      
      if (res) {
        setData(res);
      } else {
        throw new Error('No data received from distribution endpoint');
      }
    } catch (err) {
      console.error('Error fetching field distribution:', err);
      setError(err?.response?.data?.error || err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8 bg-card rounded-xl border border-border h-64">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-red-500/10 rounded-xl border border-red-200 h-64">
        <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
        <p className="text-red-600 font-medium text-center">{error}</p>
        <button onClick={loadDistributionData} className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors text-sm font-medium">
          Retry
        </button>
      </div>
    );
  }

  if (!data || !data.data || data.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-card rounded-xl border border-border h-64">
        <p className="text-muted-foreground font-medium text-center">No submitted data available for this field yet.</p>
        <p className="text-sm text-muted-foreground mt-1 text-center">Responses will appear here once users submit forms.</p>
      </div>
    );
  }

  const chartData = data.data;

  // Custom Tick for long XAxis labels
  const CustomXAxisTick = ({ x, y, payload }) => {
    const label = payload.value;
    const truncated = label.length > 12 ? label.substring(0, 10) + '...' : label;
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={16} textAnchor="middle" fill="#666" fontSize={12} className="dark:fill-gray-400">
          {truncated}
        </text>
        <title>{label}</title>
      </g>
    );
  };

  // Render different charts based on field type group
  const renderChart = () => {
    const type = data.type;
    
    // 1. Categorical / Choices -> Pie Chart
    if (['select', 'radio', 'checkbox'].includes(type)) {
      return (
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              nameKey="name"
              label={({ name, percentage }) => `${name} (${percentage}%)`}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <RechartsTooltip 
              formatter={(value, name, props) => [`${value} selections (${props.payload.percentage}%)`, name]}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    }
    
    // 2. Quantitative -> Bar Chart (Histogram)
    if (['numeric', 'painScale', 'linearScale', 'severityRating'].includes(type)) {
      return (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:stroke-gray-700" />
            <XAxis dataKey="range" tick={<CustomXAxisTick />} />
            <YAxis allowDecimals={false} />
            <RechartsTooltip 
              formatter={(value) => [`${value} submissions`, 'Frequency']}
              labelFormatter={(label) => `Range: ${label}`}
              cursor={{ fill: 'rgba(0,0,0,0.05)' }}
            />
            <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Count">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[0]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    }
    
    // 3. Complex Clinical -> Radar Chart
    if (['symptomChecklist', 'functionalStatus'].includes(type)) {
      return (
        <ResponsiveContainer width="100%" height={250}>
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
            <PolarGrid className="dark:stroke-gray-700" />
            <PolarAngleAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
            <PolarRadiusAxis angle={30} domain={[0, 'auto']} />
            <Radar name="Reported Symptoms" dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.5} />
            <RechartsTooltip />
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      );
    }

    // Fallback for unsupported types
    return (
      <div className="flex justify-center items-center h-full">
        <p className="text-muted-foreground">Visualization not currently supported for '{type}' fields directly. Data: {JSON.stringify(chartData)}</p>
      </div>
    );
  };

  const containerId = `field-dist-${fieldId}`;

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow h-full flex flex-col" id={containerId}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="text-base font-semibold text-foreground truncate">{fieldLabel}</h4>
          <div className="flex items-center gap-2 mt-1">
             <span className="text-xs px-2 py-0.5 bg-secondary text-muted-foreground rounded-full border border-border font-medium">
               {fieldType}
             </span>
             <span className="text-xs text-muted-foreground">
               {data.total_answers} responses
             </span>
          </div>
        </div>
        <button
          onClick={() => exportChartAsSvg(containerId, `field-${fieldId}-distribution.svg`)}
          className="inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none h-8 w-8"
          title="Download Chart SVG"
        >
          <Download className="h-4 w-4" />
        </button>
      </div>
      
      <div className="flex-1 w-full flex items-center justify-center">
        {renderChart()}
      </div>
    </div>
  );
}
