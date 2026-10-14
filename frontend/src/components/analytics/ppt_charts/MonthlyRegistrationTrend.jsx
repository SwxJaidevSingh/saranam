import React, { useEffect, useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from 'recharts';
import PptChartCard from './shared/charts/PptChartCard';
import pptChartsApi from '@/api/pptCharts';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const count = payload[0]?.value;

  return (
    <div className="rounded-xl border border-border bg-card p-3 text-xs text-card-foreground shadow-xl">
      <div className="font-semibold text-foreground">{label}</div>
      <div className="mt-1 flex items-center justify-between gap-6">
        <span className="text-muted-foreground">New Registrations:</span>
        <span className="font-bold text-blue-600 dark:text-blue-400">{count}</span>
      </div>
    </div>
  );
}

function MonthlyRegistrationTable({ data, total }) {
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground">
        No patient registration data available in the selected range.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-semibold">Month</th>
            <th className="px-4 py-3 font-semibold text-right">Registrations</th>
            <th className="px-4 py-3 font-semibold text-right">% of Period Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row) => {
            const pct = total > 0 ? ((row.registrations / total) * 100).toFixed(1) : '0.0';
            return (
              <tr key={row.month} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{row.month}</td>
                <td className="px-4 py-3 text-right font-bold text-blue-600 dark:text-blue-400">
                  {row.registrations}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">{pct}%</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="border-t border-border bg-muted/30 font-semibold">
          <tr>
            <td className="px-4 py-3 text-foreground">Total</td>
            <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400">{total}</td>
            <td className="px-4 py-3 text-right text-muted-foreground">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function MonthlyRegistrationTrend({ dateRange = null }) {
  const [view, setView] = useState('chart'); // 'chart' | 'table'
  const [status, setStatus] = useState('all');
  const [complexity, setComplexity] = useState('all');
  const [chartData, setChartData] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        const params = {
          status: status !== 'all' ? status : undefined,
          complexity: complexity !== 'all' ? complexity : undefined,
          start_date: dateRange?.from ? dateRange.from.toISOString().split('T')[0] : undefined,
          end_date: dateRange?.to ? dateRange.to.toISOString().split('T')[0] : undefined,
        };

        const res = await pptChartsApi.getMonthlyRegistrations(params);

        if (isMounted) {
          const list = res?.data || [];
          setChartData(list);
          setTotalCount(res?.total ?? list.reduce((sum, d) => sum + (d.registrations || 0), 0));
        }
      } catch (err) {
        console.error('Failed to load actual monthly registrations:', err);
        if (isMounted) {
          setChartData([]);
          setTotalCount(0);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [status, complexity, dateRange]);

  // Compute dynamic domain upper bound so numbers fit without clipping
  const maxVal = useMemo(() => {
    if (!chartData || chartData.length === 0) return 10;
    const highest = Math.max(...chartData.map((d) => d.registrations || 0), 10);
    return Math.ceil(highest / 10) * 10;
  }, [chartData]);

  return (
    <PptChartCard
      id="chart-monthly-registration-trend"
      title="Trend of Monthly Registrations"
      description="Actual monthly patient intake and registration trajectory from database"
      isLoading={isLoading}
      view={view}
      onViewChange={setView}
      status={status}
      onStatusChange={setStatus}
      complexity={complexity}
      onComplexityChange={setComplexity}
    >
      {view === 'chart' ? (
        <div className="pt-2">
          {chartData.length === 0 ? (
            <div className="flex h-[320px] items-center justify-center text-xs text-muted-foreground">
              No patient registration records found for this period.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <AreaChart
                data={chartData}
                margin={{ top: 24, right: 30, left: -10, bottom: 8 }}
              >
                <defs>
                  <linearGradient id="regGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="65%" stopColor="#3b82f6" stopOpacity={0.06} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                {/* Faint vertical lines matching droplines */}
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={true}
                  horizontal={false}
                  className="stroke-border/40"
                />

                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                />

                <YAxis
                  domain={[0, maxVal]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />

                <Tooltip content={<ChartTooltip />} />

                <Area
                  type="monotone"
                  dataKey="registrations"
                  name="Registrations"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fill="url(#regGradient)"
                  dot={{
                    r: 4.5,
                    fill: '#3b82f6',
                    stroke: '#ffffff',
                    strokeWidth: 2,
                  }}
                  activeDot={{
                    r: 7,
                    fill: '#2563eb',
                    stroke: '#ffffff',
                    strokeWidth: 2,
                  }}
                >
                  <LabelList
                    dataKey="registrations"
                    position="top"
                    offset={10}
                    className="fill-foreground font-bold text-xs"
                  />
                </Area>
              </AreaChart>
            </ResponsiveContainer>
          )}

          {/* Footer Total */}
          <div className="mt-3 flex items-center justify-end border-t border-border pt-3 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">
              Total Registrations: <span className="font-bold text-blue-600 dark:text-blue-400">{totalCount}</span>
            </div>
          </div>
        </div>
      ) : (
        <MonthlyRegistrationTable data={chartData} total={totalCount} />
      )}
    </PptChartCard>
  );
}

export default MonthlyRegistrationTrend;
