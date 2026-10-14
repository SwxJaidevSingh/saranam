import React, { useEffect, useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from 'recharts';
import PptChartCard from './shared/charts/PptChartCard';
import pptChartsApi from '@/api/pptCharts';

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;

  return (
    <div className="rounded-xl border border-border bg-card p-3 text-xs text-card-foreground shadow-xl">
      <div className="font-semibold text-foreground mb-1">{data?.month}</div>
      <div className="flex items-center justify-between gap-6">
        <span className="text-muted-foreground">Homecare Days:</span>
        <span className="font-bold text-blue-600 dark:text-blue-400">
          {data?.days ?? 0} days
        </span>
      </div>
    </div>
  );
}

function HomecareDaysTable({ data, total }) {
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground">
        No homecare days recorded for the selected range.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-semibold">Month</th>
            <th className="px-4 py-3 font-semibold text-right">Homecare Days</th>
            <th className="px-4 py-3 font-semibold text-right">% of Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row) => (
            <tr key={row.month_key || row.month} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-semibold text-foreground">{row.month}</td>
              <td className="px-4 py-3 text-right font-bold text-blue-600 dark:text-blue-400">
                {row.days}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {total > 0 ? `${Math.round((row.days / total) * 100)}%` : '0%'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-border bg-muted/30 font-semibold">
          <tr>
            <td className="px-4 py-3 text-foreground font-bold">Total</td>
            <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400 font-bold">
              {total}
            </td>
            <td className="px-4 py-3 text-right text-muted-foreground">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function HomecareDaysChart({ dateRange = null }) {
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

        const res = await pptChartsApi.getHomecareDays(params);

        if (isMounted) {
          const list = res?.data || [];
          setChartData(list);
          setTotalCount(res?.total ?? list.reduce((acc, d) => acc + (d.days || 0), 0));
        }
      } catch (err) {
        console.error('Failed to load homecare days data:', err);
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

  // Compute dynamic domain upper bound (minimum 25 matching reference design)
  const maxVal = useMemo(() => {
    if (!chartData || chartData.length === 0) return 25;
    const highest = Math.max(...chartData.map((d) => d.days || 0), 20);
    return Math.ceil(highest / 5) * 5;
  }, [chartData]);

  // Reverse data order so newest month displays at the top (matching the reference chart)
  const displayData = useMemo(() => {
    return [...chartData].reverse();
  }, [chartData]);

  return (
    <PptChartCard
      id="chart-homecare-days"
      title="Homecare days"
      description="Monthly count of unique active homecare visit days from patient visits"
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
            <div className="flex h-[340px] items-center justify-center text-xs text-muted-foreground">
              No homecare days recorded for the selected range.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <BarChart
                layout="vertical"
                data={displayData}
                margin={{ top: 20, right: 36, left: 16, bottom: 10 }}
              >
                {/* Vertical grid lines matching reference */}
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  vertical={true}
                  className="stroke-border/40"
                />

                <XAxis
                  type="number"
                  domain={[0, maxVal]}
                  tickLine={true}
                  axisLine={{ stroke: 'hsl(var(--border))', strokeWidth: 1.5 }}
                  tick={{
                    fontSize: 12,
                    fontWeight: 500,
                    fill: 'hsl(var(--foreground))',
                  }}
                />

                <YAxis
                  dataKey="month"
                  type="category"
                  tickLine={true}
                  axisLine={{ stroke: 'hsl(var(--border))', strokeWidth: 1.5 }}
                  tick={{
                    fontSize: 12,
                    fontWeight: 600,
                    fill: 'hsl(var(--foreground))',
                  }}
                  width={65}
                />

                <defs>
                  <linearGradient id="daysBarGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="#60a5fa" />
                  </linearGradient>
                </defs>

                <Bar
                  dataKey="days"
                  name="Homecare days"
                  fill="url(#daysBarGradient)"
                  radius={[0, 6, 6, 0]}
                  maxBarSize={32}
                >
                  <LabelList
                    dataKey="days"
                    position="insideRight"
                    offset={12}
                    className="fill-white font-bold text-xs"
                    formatter={(val) => (val ? `${val}` : '')}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* Footer Metric */}
          <div className="mt-3 flex items-center justify-end border-t border-border pt-3 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">
              Total Homecare Days:{' '}
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {totalCount}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <HomecareDaysTable data={chartData} total={totalCount} />
      )}
    </PptChartCard>
  );
}

export default HomecareDaysChart;
