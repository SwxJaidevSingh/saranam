import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import PptChartCard from './shared/charts/PptChartCard';
import pptChartsApi from '@/api/pptCharts';

const RADIAN = Math.PI / 180;

const renderCustomizedLabel = ({
  cx, cy, midAngle, innerRadius, outerRadius, value, percentage,
}) => {
  if (!value) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 1.3;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="currentColor"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      className="text-xs font-bold fill-foreground select-none"
    >
      {`${value}, ${percentage}%`}
    </text>
  );
};

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-xs shadow-xl">
      <div className="font-semibold text-foreground mb-1">{data.name}</div>
      <div className="flex items-center justify-between gap-6">
        <span className="text-muted-foreground">Patients:</span>
        <span className="font-bold text-foreground">
          {data.count} ({data.percentage}%)
        </span>
      </div>
    </div>
  );
}

function PlaceOfDeathTable({ data, total }) {
  if (!data?.length) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground">
        No place of death records found.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-semibold">Place of Death</th>
            <th className="px-4 py-3 font-semibold text-right">Patients</th>
            <th className="px-4 py-3 font-semibold text-right">% Share</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row) => (
            <tr key={row.name} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-medium text-foreground flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: row.color }} />
                {row.name}
              </td>
              <td className="px-4 py-3 text-right font-bold text-foreground">{row.count}</td>
              <td className="px-4 py-3 text-right text-muted-foreground">{row.percentage}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-border bg-muted/30 font-semibold">
          <tr>
            <td className="px-4 py-3 text-foreground font-bold">Total Deaths Recorded</td>
            <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400 font-bold">{total}</td>
            <td className="px-4 py-3 text-right text-muted-foreground">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function PlaceOfDeathChart({ dateRange = null }) {
  const [view, setView] = useState('chart');
  const [status, setStatus] = useState('all');
  const [complexity, setComplexity] = useState('all');
  const [chartData, setChartData] = useState([]);
  const [total, setTotal] = useState(0);
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

        const res = await pptChartsApi.getPlaceOfDeath(params);

        if (isMounted) {
          setChartData(res?.data || []);
          setTotal(res?.total ?? 0);
        }
      } catch (err) {
        console.error('Failed to load place of death data:', err);
        if (isMounted) {
          setChartData([]);
          setTotal(0);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, [status, complexity, dateRange]);

  // Only show slices with count > 0
  const visibleData = chartData.filter((d) => d.count > 0);

  return (
    <PptChartCard
      id="chart-place-of-death"
      title="Place of Death Analysis"
      description="Distribution of deceased patients by where death occurred"
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
          {total === 0 ? (
            <div className="flex h-[320px] items-center justify-center text-xs text-muted-foreground">
              No place of death records found.
            </div>
          ) : (
            <div>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart margin={{ top: 15, right: 40, left: 40, bottom: 15 }}>
                  <Pie
                    data={visibleData}
                    cx="50%"
                    cy="50%"
                    outerRadius={105}
                    labelLine={true}
                    label={renderCustomizedLabel}
                    dataKey="count"
                  >
                    {visibleData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={entry.color}
                        stroke="hsl(var(--card))"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    iconType="rect"
                    wrapperStyle={{ paddingTop: '16px' }}
                    formatter={(value) => (
                      <span className="text-xs font-medium text-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="mt-3 flex items-center justify-end border-t border-border pt-3 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">
                  Total Deaths:{' '}
                  <span className="font-bold text-blue-600 dark:text-blue-400">{total}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <PlaceOfDeathTable data={chartData} total={total} />
      )}
    </PptChartCard>
  );
}

export default PlaceOfDeathChart;
