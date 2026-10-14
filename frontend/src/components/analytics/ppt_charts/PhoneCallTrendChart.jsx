import React, { useEffect, useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
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
      <div className="font-semibold text-foreground mb-1">{label}</div>
      <div className="flex items-center justify-between gap-6">
        <span className="text-muted-foreground">Phone Consultations:</span>
        <span className="font-bold text-blue-600 dark:text-blue-400">{count}</span>
      </div>
    </div>
  );
}

function PhoneCallTrendTable({ data, total }) {
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground">
        No phone call trend data available for the selected range.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-semibold">Month</th>
            <th className="px-4 py-3 font-semibold text-right">Phone Consultations</th>
            <th className="px-4 py-3 font-semibold text-right">% of Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row) => (
            <tr key={row.month_key} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-medium text-foreground">{row.month}</td>
              <td className="px-4 py-3 text-right font-bold text-blue-600 dark:text-blue-400">
                {row.consultations}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {total > 0 ? `${Math.round((row.consultations / total) * 100)}%` : '0%'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-border bg-muted/30 font-semibold">
          <tr>
            <td className="px-4 py-3 text-foreground font-bold">Total</td>
            <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400 font-bold">{total}</td>
            <td className="px-4 py-3 text-right text-muted-foreground">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function PhoneCallTrendChart({ dateRange = null }) {
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

        const res = await pptChartsApi.getPhoneCallTrend(params);

        if (isMounted) {
          const list = res?.data || [];
          setChartData(list);
          setTotalCount(res?.total_consultations ?? list.reduce((acc, d) => acc + (d.consultations || 0), 0));
        }
      } catch (err) {
        console.error('Failed to load phone call trend data:', err);
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

  const maxVal = useMemo(() => {
    if (!chartData || chartData.length === 0) return 120;
    const highest = Math.max(...chartData.map((d) => d.consultations || 0), 20);
    return Math.ceil(highest / 20) * 20 + 20;
  }, [chartData]);

  return (
    <PptChartCard
      id="chart-phone-call-trend"
      title="Month Wise Trend of Phone Call Consultations"
      description="Monthly volume progression of telephone consultations"
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
          {chartData.length === 0 || totalCount === 0 ? (
            <div className="flex h-[340px] items-center justify-center text-xs text-muted-foreground">
              No phone consultation trend data available in the selected range.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <LineChart
                data={chartData}
                margin={{ top: 24, right: 36, left: 10, bottom: 12 }}
              >
                {/* Vertical droplines matching slide design */}
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={true}
                  horizontal={false}
                  className="stroke-border/50"
                />

                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tick={{
                    fontSize: 12,
                    fontWeight: 600,
                    fill: 'hsl(var(--muted-foreground))',
                  }}
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
                  dataKey="consultations"
                  name="Phone Consultations"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
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
                    dataKey="consultations"
                    position="top"
                    offset={10}
                    className="fill-foreground font-semibold text-xs"
                  />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          )}

          {/* Footer Metric */}
          <div className="mt-3 flex items-center justify-end border-t border-border pt-3 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">
              Total Consultations: <span className="font-bold text-blue-600 dark:text-blue-400">{totalCount}</span>
            </div>
          </div>
        </div>
      ) : (
        <PhoneCallTrendTable data={chartData} total={totalCount} />
      )}
    </PptChartCard>
  );
}

export default PhoneCallTrendChart;
