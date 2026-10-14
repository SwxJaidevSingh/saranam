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
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percentage }) => {
  if (!percentage || percentage === 0) return null;
  // Position label slightly outside or at rim for clear reading
  const radius = innerRadius + (outerRadius - innerRadius) * 1.25;
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
      {`${percentage}%`}
    </text>
  );
};

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const data = item.payload;

  return (
    <div className="rounded-xl border border-border bg-card p-3 text-xs text-card-foreground shadow-xl">
      <div className="font-semibold text-foreground mb-1">{data.name}</div>
      <div className="flex items-center justify-between gap-6">
        <span className="text-muted-foreground">Cases:</span>
        <span className="font-bold text-foreground">
          {data.count} ({data.percentage}%)
        </span>
      </div>
    </div>
  );
}

function CancerCategoryTable({ data, total }) {
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground">
        No cancer category records found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-semibold">Cancer Category</th>
            <th className="px-4 py-3 font-semibold text-right">Cases</th>
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
            <td className="px-4 py-3 text-foreground font-bold">Total Cases</td>
            <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400 font-bold">{total}</td>
            <td className="px-4 py-3 text-right text-muted-foreground">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function CancerCategoryChart({ dateRange = null }) {
  const [view, setView] = useState('chart'); // 'chart' | 'table'
  const [status, setStatus] = useState('all');
  const [complexity, setComplexity] = useState('all');
  const [chartData, setChartData] = useState([]);
  const [totalCases, setTotalCases] = useState(0);
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

        const res = await pptChartsApi.getCancerCategory(params);

        if (isMounted) {
          const list = res?.data || [];
          setChartData(list);
          setTotalCases(res?.total ?? 0);
        }
      } catch (err) {
        console.error('Failed to load cancer category data:', err);
        if (isMounted) {
          setChartData([]);
          setTotalCases(0);
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
      id="chart-cancer-category"
      title="Cancer category bifurcation (Oncology)"
      description="Distribution of patients based on clinical diagnosis in the patient registry"
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
          {chartData.length === 0 || totalCases === 0 ? (
            <div className="flex h-[360px] items-center justify-center text-xs text-muted-foreground">
              No diagnosis records found for this period.
            </div>
          ) : (
            <div>
              {/* Badge showing Total Cases N=... matching slide */}
              <div className="text-center font-bold text-sm tracking-wide text-foreground mb-1">
                Total Cases N={totalCases}
              </div>

              <ResponsiveContainer width="100%" height={340}>
                <PieChart margin={{ top: 10, right: 35, left: 35, bottom: 25 }}>
                  <Pie
                    data={chartData.filter((item) => item.count > 0)}
                    cx="50%"
                    cy="48%"
                    outerRadius={105}
                    labelLine={true}
                    label={renderCustomizedLabel}
                    dataKey="count"
                  >
                    {chartData.filter((item) => item.count > 0).map((entry) => (
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
                    iconType="square"
                    wrapperStyle={{ paddingTop: '16px' }}
                    formatter={(value) => (
                      <span className="text-xs font-medium text-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      ) : (
        <CancerCategoryTable data={chartData} total={totalCases} />
      )}
    </PptChartCard>
  );
}

export default CancerCategoryChart;
