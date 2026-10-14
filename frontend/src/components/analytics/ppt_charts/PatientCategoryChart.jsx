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
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value, percentage }) => {
  if (!value) return null;
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
      {`${value}, ${percentage}%`}
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
        <span className="text-muted-foreground">Patients:</span>
        <span className="font-bold text-foreground">
          {data.count} ({data.percentage}%)
        </span>
      </div>
    </div>
  );
}

function PatientCategoryTable({ data, total }) {
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground">
        No patient category records found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-semibold">Category</th>
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
            <td className="px-4 py-3 text-foreground font-bold">Total Registered Patients</td>
            <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400 font-bold">{total}</td>
            <td className="px-4 py-3 text-right text-muted-foreground">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function PatientCategoryChart({ dateRange = null }) {
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

        const res = await pptChartsApi.getPatientCategory(params);

        if (isMounted) {
          const list = res?.data || [];
          setChartData(list);
          setTotalCount(res?.total ?? 0);
        }
      } catch (err) {
        console.error('Failed to load patient category data:', err);
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
      id="chart-patient-category"
      title="Patient Category (BSC vs N-BSC)"
      description="Distribution of patients by Best Supportive Care (BSC) vs Non-BSC and Oncology status"
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
              No patient records found for this period.
            </div>
          ) : (
            <div>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart margin={{ top: 15, right: 35, left: 35, bottom: 15 }}>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    outerRadius={105}
                    labelLine={true}
                    label={renderCustomizedLabel}
                    dataKey="count"
                  >
                    {chartData.map((entry) => (
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

              {/* Footer Metric */}
              <div className="mt-3 flex items-center justify-end border-t border-border pt-3 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">
                  Total Patients: <span className="font-bold text-blue-600 dark:text-blue-400">{totalCount}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <PatientCategoryTable data={chartData} total={totalCount} />
      )}
    </PptChartCard>
  );
}

export default PatientCategoryChart;
