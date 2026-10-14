import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BarChart2, TrendingUp, Info } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

const COLORS = ['#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899'];

export const ReportDataVisualizer = ({
  totalCount = 0,
  selectedColumnsCount = 0,
  visualization = {},
  datasetName = 'Records'
}) => {
  const { theme } = useTheme();
  const metrics = visualization?.metrics || {};
  const chartData = visualization?.chart_data || [];
  const chartTitle = visualization?.title || 'Data Distribution Preview';

  return (
    <div className="space-y-4">
      {/* 1. Quick Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 bg-card border-border/80 shadow-sm">
          <span className="text-xs text-muted-foreground">Matching Records</span>
          <p className="text-2xl font-bold text-foreground mt-0.5">{totalCount}</p>
          <span className="text-[11px] text-muted-foreground">Ready for export</span>
        </Card>

        <Card className="p-3 bg-card border-border/80 shadow-sm">
          <span className="text-xs text-muted-foreground">Columns Included</span>
          <p className="text-2xl font-bold text-primary mt-0.5">{selectedColumnsCount}</p>
          <span className="text-[11px] text-muted-foreground">Configured in report</span>
        </Card>

        {Object.entries(metrics)
          .filter(([k]) => !['Total Records', 'Total Records Found', 'Selected Columns'].includes(k))
          .slice(0, 2)
          .map(([key, val]) => (
            <Card key={key} className="p-3 bg-card border-border/80 shadow-sm">
              <span className="text-xs text-muted-foreground truncate block">{key}</span>
              <p className="text-2xl font-bold text-foreground mt-0.5 truncate">{val}</p>
              <span className="text-[11px] text-muted-foreground">Summary metric</span>
            </Card>
          ))}
      </div>

      {/* 2. Visual Distribution Chart */}
      {chartData.length > 0 && (
        <Card className="border border-border/80 shadow-sm">
          <CardHeader className="py-3 px-4 border-b border-border/60 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-semibold text-foreground">
                {chartTitle}
              </CardTitle>
            </div>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="w-3.5 h-3.5" />
              Live preview from matching data
            </span>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                <XAxis
                  dataKey="range"
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                    borderColor: theme === 'dark' ? '#334155' : '#e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: theme === 'dark' ? '#f8fafc' : '#0f172a'
                  }}
                  formatter={(val) => [`${val} records`, 'Count']}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReportDataVisualizer;
