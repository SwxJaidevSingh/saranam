import React, { useEffect, useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import PptChartCard from './shared/charts/PptChartCard';
import pptChartsApi from '@/api/pptCharts';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const count = payload[0]?.value;

  return (
    <div className="rounded-xl border border-border bg-card p-3 text-xs text-card-foreground shadow-xl">
      <div className="font-semibold text-foreground mb-1">{label}</div>
      <div className="flex items-center justify-between gap-6">
        <span className="text-muted-foreground">Homecare Visits:</span>
        <span className="font-bold text-blue-600 dark:text-blue-400">{count}</span>
      </div>
    </div>
  );
}

function HomecareVisitsTable({ data, total }) {
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground">
        No homecare visit records found for the selected range.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-semibold">Month</th>
            <th className="px-4 py-3 font-semibold text-right">Homecare Visits</th>
            <th className="px-4 py-3 font-semibold text-right">% of Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row) => (
            <tr key={row.month_key || row.month} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-semibold text-foreground">{row.month}</td>
              <td className="px-4 py-3 text-right font-bold text-blue-600 dark:text-blue-400">
                {row.visits}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {total > 0 ? `${Math.round((row.visits / total) * 100)}%` : '0%'}
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

export function HomecareVisitsChart({ dateRange = null }) {
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

        const res = await pptChartsApi.getHomecareVisits(params);

        if (isMounted) {
          const list = res?.data || [];
          setChartData(list);
          setTotalCount(res?.total ?? list.reduce((acc, d) => acc + (d.visits || 0), 0));
        }
      } catch (err) {
        console.error('Failed to load homecare visits data:', err);
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
    if (!chartData || chartData.length === 0) return 40;
    const highest = Math.max(...chartData.map((d) => d.visits || 0), 10);
    return Math.ceil((highest * 1.15) / 10) * 10;
  }, [chartData]);

  // Custom Dot matching the blue circle badge with white number inside
  const renderCustomDot = (props) => {
    const { cx, cy, payload } = props;
    if (payload.visits === null || payload.visits === undefined) return null;
    const r = 13;

    return (
      <g key={`dot-${payload.month_key || payload.month}`}>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="#2f65b9"
          stroke="#ffffff"
          strokeWidth={1.5}
        />
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fill="#ffffff"
          fontSize={11}
          fontWeight="700"
        >
          {payload.visits}
        </text>
      </g>
    );
  };

  return (
    <PptChartCard
      id="chart-homecare-visits"
      title="Homecare visits"
      description="Monthly volume of home visits (excluding teleconsults) from patient visits"
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
              No homecare visit records found for the selected range.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <LineChart
                data={chartData}
                margin={{ top: 28, right: 36, left: 10, bottom: 20 }}
              >
                {/* Horizontal grid lines */}
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  horizontal={true}
                  className="stroke-border/40"
                />

                <XAxis
                  dataKey="month"
                  tickLine={true}
                  axisLine={{ stroke: 'hsl(var(--border))', strokeWidth: 1.5 }}
                  tick={{
                    fontSize: 12,
                    fontWeight: 600,
                    fill: 'hsl(var(--foreground))',
                  }}
                  angle={-30}
                  textAnchor="end"
                  height={50}
                />

                <YAxis
                  domain={[0, maxVal]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />

                <Tooltip content={<ChartTooltip />} />

                <Line
                  type="linear"
                  dataKey="visits"
                  name="Homecare visits"
                  stroke="#2f65b9"
                  strokeWidth={2.8}
                  dot={renderCustomDot}
                  activeDot={{
                    r: 15,
                    fill: '#1e40af',
                    stroke: '#ffffff',
                    strokeWidth: 2,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}

          {/* Footer Metric */}
          <div className="mt-3 flex items-center justify-end border-t border-border pt-3 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">
              Total Homecare Visits:{' '}
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {totalCount}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <HomecareVisitsTable data={chartData} total={totalCount} />
      )}
    </PptChartCard>
  );
}

export default HomecareVisitsChart;
