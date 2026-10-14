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

const COLORS = {
  Male: '#3b82f6',   // Blue
  Female: '#f97316', // Orange
};

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const data = payload[0];
  const { name, value, payload: item } = data;

  return (
    <div className="rounded-xl border border-border bg-card p-3 text-xs text-card-foreground shadow-xl">
      <div className="font-semibold text-foreground">{name}</div>
      <div className="mt-1 flex items-center justify-between gap-6">
        <span className="text-muted-foreground">Patients:</span>
        <span className="font-bold text-foreground">
          {value} ({item.percentage}%)
        </span>
      </div>
    </div>
  );
}

const renderCustomLabel = ({ cx, cy, midAngle, outerRadius, value, percentage }) => {
  if (!value || percentage < 3) return null;
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 22;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="currentColor"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      className="fill-foreground font-semibold text-xs"
    >
      {`${value}, ${Math.round(percentage)}%`}
    </text>
  );
};

function GenderProfileTable({ data, total }) {
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground">
        No gender demographic data available in the selected range.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-semibold">Gender</th>
            <th className="px-4 py-3 font-semibold text-right">Count</th>
            <th className="px-4 py-3 font-semibold text-right">% of Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row) => (
            <tr key={row.name} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-medium text-foreground flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full inline-block"
                  style={{ backgroundColor: COLORS[row.name] || '#a855f7' }}
                />
                {row.name}
              </td>
              <td className="px-4 py-3 text-right font-bold text-foreground">{row.value}</td>
              <td className="px-4 py-3 text-right text-muted-foreground">{row.percentage}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-border bg-muted/30 font-semibold">
          <tr>
            <td className="px-4 py-3 text-foreground font-bold">Grand Total</td>
            <td className="px-4 py-3 text-right text-foreground font-bold">{total}</td>
            <td className="px-4 py-3 text-right text-muted-foreground">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function GenderProfileChart({ dateRange = null }) {
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

        const res = await pptChartsApi.getGenderProfile(params);

        if (isMounted) {
          const list = res?.data || [];
          setChartData(list);
          setTotalCount(res?.total ?? list.reduce((sum, d) => sum + (d.value || 0), 0));
        }
      } catch (err) {
        console.error('Failed to load actual gender profile data:', err);
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

  return (
    <PptChartCard
      id="chart-gender-profile"
      title="Gender Profile"
      description="Patient cohort distribution by gender breakdown"
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
              No patient gender data available in the selected range.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <PieChart margin={{ top: 20, right: 30, left: 30, bottom: 20 }}>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="46%"
                  innerRadius={55}
                  outerRadius={95}
                  labelLine={true}
                  label={renderCustomLabel}
                  paddingAngle={2}
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={COLORS[entry.name] || '#a855f7'}
                      stroke="hsl(var(--card))"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  align="center"
                  iconType="square"
                  iconSize={10}
                  wrapperStyle={{
                    fontSize: 11,
                    paddingTop: 16,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      ) : (
        <GenderProfileTable data={chartData} total={totalCount} />
      )}
    </PptChartCard>
  );
}

export default GenderProfileChart;
