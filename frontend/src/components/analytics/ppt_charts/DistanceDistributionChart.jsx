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

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const count = payload[0]?.value;
  const item = payload[0]?.payload;

  return (
    <div className="rounded-xl border border-border bg-card p-3 text-xs text-card-foreground shadow-xl">
      <div className="font-semibold text-foreground">{label}</div>
      <div className="mt-1 flex items-center justify-between gap-6">
        <span className="text-muted-foreground">Patients Registered:</span>
        <span className="font-bold text-orange-600 dark:text-orange-400">
          {count} {item?.percentage ? `(${item.percentage}%)` : ''}
        </span>
      </div>
    </div>
  );
}

function DistanceDistributionTable({ data, total }) {
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground">
        No distance demographic data available in the selected range.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-semibold">Distance Band</th>
            <th className="px-4 py-3 font-semibold text-right">Patients Registered</th>
            <th className="px-4 py-3 font-semibold text-right">% of Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row) => (
            <tr key={row.range} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-medium text-foreground">{row.range}</td>
              <td className="px-4 py-3 text-right font-bold text-orange-600 dark:text-orange-400">
                {row.count}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">{row.percentage}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-border bg-muted/30 font-semibold">
          <tr>
            <td className="px-4 py-3 text-foreground font-bold">Grand Total</td>
            <td className="px-4 py-3 text-right text-orange-600 dark:text-orange-400 font-bold">{total}</td>
            <td className="px-4 py-3 text-right text-muted-foreground">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function DistanceDistributionChart({ dateRange = null }) {
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

        const res = await pptChartsApi.getDistanceDistribution(params);

        if (isMounted) {
          const list = res?.data || [];
          setChartData(list);
          setTotalCount(res?.total ?? list.reduce((sum, d) => sum + (d.count || 0), 0));
        }
      } catch (err) {
        console.error('Failed to load distance distribution data:', err);
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
    const highest = Math.max(...chartData.map((d) => d.count || 0), 10);
    return Math.ceil(highest / 20) * 20 + 20;
  }, [chartData]);

  return (
    <PptChartCard
      id="chart-distance-distribution"
      title="Distance of Patients Registered from Kidwai Hospital"
      description="Kilometre radial bands from base hospital across Bangalore metropolitan area"
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
            <div className="flex h-[320px] items-center justify-center text-xs text-muted-foreground">
              No patient distance data available in the selected range.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart
                data={chartData}
                margin={{ top: 24, right: 30, left: 10, bottom: 12 }}
                barSize={64}
              >
                {/* Horizontal guide lines */}
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  horizontal={true}
                  className="stroke-border/40"
                />

                <XAxis
                  dataKey="range"
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

                <Bar
                  dataKey="count"
                  name="Patients Registered"
                  fill="#f28a43"
                  radius={[4, 4, 0, 0]}
                >
                  <LabelList
                    dataKey="count"
                    position="top"
                    offset={8}
                    className="fill-foreground font-bold text-xs"
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* Footer Total */}
          <div className="mt-3 flex items-center justify-end border-t border-border pt-3 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">
              Total Patients: <span className="font-bold text-orange-600 dark:text-orange-400">{totalCount}</span>
            </div>
          </div>
        </div>
      ) : (
        <DistanceDistributionTable data={chartData} total={totalCount} />
      )}
    </PptChartCard>
  );
}

export default DistanceDistributionChart;
