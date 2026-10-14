import React, { useState, useEffect } from 'react';
import { analyticsApi } from '../../../api/analytics';
import { Loader2, AlertCircle, Info } from 'lucide-react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function UsageHeatmap({ formId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (formId) {
      loadHeatmapData();
    }
  }, [formId]);

  const loadHeatmapData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await analyticsApi.getAdvancedUsageHeatmap(formId);
      
      if (res) {
        setData(res);
      } else {
        throw new Error('No data received from heatmap endpoint');
      }
    } catch (err) {
      console.error('Error fetching usage heatmap:', err);
      setError(err?.response?.data?.error || err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12 bg-card rounded-xl border border-border h-64">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-card/50 rounded-xl border border-border border-dashed h-64">
        <AlertCircle className="w-8 h-8 text-muted-foreground mb-3 opacity-50" />
        <p className="text-sm text-muted-foreground">Could not generate heat map</p>
      </div>
    );
  }

  if (!data || !data.heatmap || data.heatmap.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-card rounded-xl border border-border h-64">
        <p className="text-muted-foreground font-medium text-center">No temporal data available.</p>
      </div>
    );
  }

  const { heatmap, max_intensity } = data;

  // Create lookup matrix: map[day][hour] = count
  const matrix = Array(7).fill().map(() => Array(24).fill(0));
  heatmap.forEach(item => {
    // Backend day_index (0=Sun, 1=Mon... 6=Sat)
    // Frontend DAYS (0=Mon, 1=Tue... 6=Sun)
    let frontendDayIdx = (item.day_index + 6) % 7; 
    
    const hourIdx = Math.floor(item.hour_of_day || 0);
    
    if (frontendDayIdx >= 0 && frontendDayIdx <= 6 && hourIdx >= 0 && hourIdx <= 23) {
      matrix[frontendDayIdx][hourIdx] = item.count || 0;
    }
  });

  const getColorIntensity = (count) => {
    if (count === 0) return 'bg-slate-100 dark:bg-slate-800/50';
    // Calculate ratio from 0.1 to 1.0 based on max_intensity
    const ratio = Math.max(0.15, count / (max_intensity || 1));
    
    // We'll use inline styles to apply an exact opacity of a primary color
    // Tailwind's arbitrary values would also work: `bg-primary/${Math.round(ratio*100)}` 
    // but easier to return a base class and applying opacity in style.
    return 'bg-primary'; 
  };

  const formatHour = (h) => {
    if (h === 0) return '12A';
    if (h === 12) return '12P';
    return h > 12 ? `${h - 12}P` : `${h}A`;
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm p-6 overflow-hidden">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Usage Timetable</h3>
          <p className="text-sm text-muted-foreground">
            Busiest times for form submissions.
          </p>
        </div>
        <div className="flex items-center text-xs text-muted-foreground">
          <Info className="w-4 h-4 mr-1 text-primary" />
          Darker cells indicate more activity
        </div>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="min-w-[700px]">
          {/* Header Row: Hours */}
          <div className="flex mb-1 ml-10">
            {HOURS.map((hour) => (
              <div key={`h-${hour}`} className="flex-1 text-center text-[10px] text-muted-foreground font-medium w-8">
                {formatHour(hour)}
              </div>
            ))}
          </div>

          {/* Grid Rows: Days */}
          <div className="space-y-1">
            {DAYS.map((day, dayIdx) => (
              <div key={day} className="flex items-center h-8">
                {/* Y-Axis Label */}
                <div className="w-10 text-xs font-medium text-foreground text-right pr-2">
                  {day}
                </div>
                
                {/* Cells */}
                <div className="flex flex-1 gap-1">
                  {HOURS.map((hour) => {
                    const count = matrix[dayIdx]?.[hour] || 0;
                    const opacity = count === 0 ? 1 : Math.max(0.2, count / (max_intensity || 1));
                    
                    return (
                      <div 
                        key={`${day}-${hour}`}
                        title={`${day} at ${formatHour(hour)}: ${count} submissions`}
                        className={`flex-1 rounded-sm transition-all duration-200 hover:ring-2 hover:ring-ring hover:scale-110 cursor-pointer ${
                          count === 0 ? 'bg-secondary dark:bg-slate-800' : 'bg-primary'
                        }`}
                        style={count > 0 ? { opacity } : {}}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
