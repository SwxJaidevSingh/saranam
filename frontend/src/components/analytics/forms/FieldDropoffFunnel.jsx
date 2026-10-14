import React, { useState, useEffect } from 'react';
import { 
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { analyticsApi } from '../../../api/analytics';
import { Loader2, AlertCircle, ArrowDownRight, Download } from 'lucide-react';
import { exportChartAsSvg } from '../../../utils/chartExport';

export default function FieldDropoffFunnel({ formId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (formId) {
      loadFunnelData();
    }
  }, [formId]);

  const loadFunnelData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await analyticsApi.getAdvancedDropoffFunnel(formId);
      
      if (res) {
        setData(res);
      } else {
        throw new Error('No data received from funnel endpoint');
      }
    } catch (err) {
      console.error('Error fetching drop-off funnel:', err);
      setError(err?.response?.data?.error || err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12 bg-card rounded-xl border border-border h-80">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-card/50 rounded-xl border border-border border-dashed h-80">
        <AlertCircle className="w-10 h-10 text-muted-foreground mb-3 opacity-50" />
        <p className="text-muted-foreground mb-4">Could not generate drop-off funnel</p>
        <button 
          onClick={loadFunnelData}
          className="text-sm font-medium text-primary hover:underline"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!data || !data.funnel || data.funnel.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-card rounded-xl border border-border h-80">
        <p className="text-muted-foreground font-medium text-center">Not enough data to compute drop-off funnel.</p>
        <p className="text-sm text-muted-foreground mt-1 text-center">At least one submission is required.</p>
      </div>
    );
  }

  const { funnel, total_submissions } = data;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const fieldData = payload[0].payload;
      return (
        <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-lg p-3 text-sm">
          <p className="font-semibold mb-2">{fieldData.label}</p>
          <div className="space-y-1">
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground">Answered:</span>
              <span className="font-medium text-primary">{fieldData.answered_count}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground">Completion Rate:</span>
              <span className="font-medium text-emerald-500">{fieldData.completion_rate.toFixed(1)}%</span>
            </p>
            {fieldData.dropoff_from_previous > 0 && (
              <p className="flex justify-between gap-4 mt-2 pt-2 border-t border-border">
                <span className="text-muted-foreground flex items-center">
                  <ArrowDownRight className="w-3 h-3 text-red-500 mr-1" />
                  Drop-off:
                </span>
                <span className="font-medium text-red-500">-{fieldData.dropoff_percentage.toFixed(1)}%</span>
              </p>
            )}
            {fieldData.is_bottleneck && (
              <p className="text-xs font-semibold text-amber-500 mt-2 bg-amber-500/10 px-2 py-1 rounded">
                ⚠️ High Drop-off Point
              </p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom tick to truncate long field names
  const CustomXAxisTick = ({ x, y, payload }) => {
    const label = payload.value;
    const isLong = label.length > 20;
    const truncated = isLong ? label.substring(0, 17) + '...' : label;
    
    // Find the original item to check if it's a bottleneck
    const item = funnel.find(f => f.label === label);
    const isBottleneck = item?.is_bottleneck;

    return (
      <g transform={`translate(${x},${y})`}>
        <text 
          x={0} 
          y={0} 
          dy={10} 
          textAnchor="end" 
          fill={isBottleneck ? "#f59e0b" : "#64748b"} 
          fontSize={10}
          fontWeight={isBottleneck ? 600 : 400}
          transform="rotate(-35)"
        >
          {truncated}
        </text>
        <title>{label}</title>
      </g>
    );
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm p-6" id="forms-field-dropoff-funnel">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Field Drop-off Funnel</h3>
          <p className="text-sm text-muted-foreground">
            Visualizing where users abandon the form step-by-step.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 bg-secondary rounded-md text-secondary-foreground text-sm font-medium">
            Total Submissions: {total_submissions}
          </div>
          {!loading && funnel.length > 0 && (
            <button
              onClick={() => exportChartAsSvg('forms-field-dropoff-funnel', 'forms-field-dropoff-funnel.svg')}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none h-8 w-8"
              title="Download Chart SVG"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      
      <div className="h-80 w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={funnel}
            margin={{ top: 20, right: 20, bottom: 20, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-gray-800" />
            <XAxis 
              dataKey="label" 
              tick={<CustomXAxisTick />} 
              interval={0}
            />
            <YAxis 
              yAxisId="left" 
              orientation="left" 
              stroke="#64748b" 
              tick={{fontSize: 12}}
              label={{ value: 'Submissions', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#64748b', fontSize: 12 } }}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              stroke="#64748b" 
              tick={{fontSize: 12}}
              domain={[0, 100]}
              tickFormatter={(val) => `${val}%`}
            />
            <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
            
            {/* The primary funnel bar */}
            <Bar yAxisId="left" dataKey="answered_count" name="Answered count" radius={[4, 4, 0, 0]}>
              {funnel.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.is_bottleneck ? '#f59e0b' : '#3b82f6'} 
                  fillOpacity={0.8} 
                />
              ))}
            </Bar>
            
            {/* The completion rate trend line */}
            <Line 
              yAxisId="right" 
              type="monotone" 
              dataKey="completion_rate" 
              name="Completion Rate (%)" 
              stroke="#10b981" 
              strokeWidth={3}
              dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, fill: '#10b981', stroke: '#fff' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-sm justify-center">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
          <span className="text-muted-foreground">Normal Field Completion</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-amber-500 rounded-sm"></div>
          <span className="text-muted-foreground">High Drop-off Point (Bottleneck)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-emerald-500 rounded-full"></div>
          <span className="text-muted-foreground">Completion Rate %</span>
        </div>
      </div>
    </div>
  );
}
