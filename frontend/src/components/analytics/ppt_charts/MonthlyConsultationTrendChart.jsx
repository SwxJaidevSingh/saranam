import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import PptChartCard from './shared/charts/PptChartCard';
import pptChartsApi from '@/api/pptCharts';

// Custom Label for Bars and Line
const renderValueLabel = (props) => {
  const { x, y, width, value } = props;
  if (!value && value !== 0) return null;
  return (
    <text
      x={x + (width ? width / 2 : 0)}
      y={y - 6}
      fill="currentColor"
      textAnchor="middle"
      className="text-[11px] font-bold fill-foreground"
    >
      {value}
    </text>
  );
};

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-3 text-xs text-card-foreground shadow-xl">
      <div className="font-semibold text-foreground mb-2">{label}</div>
      {payload.map((item, idx) => (
        <div key={idx} className="flex items-center justify-between gap-6 py-0.5">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="h-2 w-2 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
            {item.name}:
          </span>
          <span className="font-bold text-foreground">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function MonthlyConsultationTable({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground">
        No monthly consultation trend data available.
      </div>
    );
  }

  const totalHomecare = data.reduce((acc, curr) => acc + (curr.homecare || 0), 0);
  const totalPhone = data.reduce((acc, curr) => acc + (curr.phone || 0), 0);
  const grandTotal = data.reduce((acc, curr) => acc + (curr.total || 0), 0);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-semibold">Month</th>
            <th className="px-4 py-3 font-semibold text-right">Home Care Consultations</th>
            <th className="px-4 py-3 font-semibold text-right">Phone Care Consultations</th>
            <th className="px-4 py-3 font-semibold text-right">Total Consultations</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row) => (
            <tr key={row.month_key || row.month} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-medium text-foreground">{row.month}</td>
              <td className="px-4 py-3 text-right font-medium text-blue-600 dark:text-blue-400">
                {row.homecare}
              </td>
              <td className="px-4 py-3 text-right font-medium text-orange-600 dark:text-orange-400">
                {row.phone}
              </td>
              <td className="px-4 py-3 text-right font-bold text-foreground">
                {row.total}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-border bg-muted/30 font-semibold">
          <tr>
            <td className="px-4 py-3 text-foreground font-bold">Total</td>
            <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400 font-bold">{totalHomecare}</td>
            <td className="px-4 py-3 text-right text-orange-600 dark:text-orange-400 font-bold">{totalPhone}</td>
            <td className="px-4 py-3 text-right text-foreground font-bold">{grandTotal}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function MonthlyConsultationTrendChart({ dateRange = null }) {
  const [view, setView] = useState('chart'); // 'chart' | 'table'
  const [status, setStatus] = useState('all');
  const [complexity, setComplexity] = useState('all');
  const [chartData, setChartData] = useState([]);
  const [grandTotal, setGrandTotal] = useState(0);
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

        const res = await pptChartsApi.getConsultationMonthlyTrend(params);

        if (isMounted) {
          const list = res?.data || [];
          setChartData(list);
          setGrandTotal(res?.grand_total ?? 0);
        }
      } catch (err) {
        console.error('Failed to load consultation monthly trend:', err);
        if (isMounted) {
          setChartData([]);
          setGrandTotal(0);
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
      id="chart-monthly-consultation-trend"
      title="Monthwise trend of Consultations"
      description="Monthly comparison of Home Care and Phone Care consultations with total consultation volume"
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
              No monthly consultation data found for this period.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart
                data={chartData}
                margin={{ top: 25, right: 30, left: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tick={{ fill: 'currentColor', fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'currentColor', fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  wrapperStyle={{ paddingTop: '16px' }}
                  formatter={(value) => (
                    <span className="text-xs font-medium text-foreground">{value}</span>
                  )}
                />
                <Bar
                  dataKey="homecare"
                  name="Home Care Consultations"
                  fill="#2563eb"
                  radius={[4, 4, 0, 0]}
                  label={renderValueLabel}
                  maxBarSize={48}
                />
                <Bar
                  dataKey="phone"
                  name="Phone Care Consultations"
                  fill="#ea580c"
                  radius={[4, 4, 0, 0]}
                  label={renderValueLabel}
                  maxBarSize={48}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Total Consultations"
                  stroke="#94a3b8"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#94a3b8', strokeWidth: 2 }}
                  label={renderValueLabel}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}

          {/* Footer Metric */}
          <div className="mt-3 flex items-center justify-end border-t border-border pt-3 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">
              Total Consultations: <span className="font-bold text-blue-600 dark:text-blue-400">{grandTotal}</span>
            </div>
          </div>
        </div>
      ) : (
        <MonthlyConsultationTable data={chartData} />
      )}
    </PptChartCard>
  );
}

export default MonthlyConsultationTrendChart;
