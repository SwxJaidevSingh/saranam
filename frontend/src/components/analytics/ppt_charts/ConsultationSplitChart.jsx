import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import PptChartCard from './shared/charts/PptChartCard';
import pptChartsApi from '@/api/pptCharts';

// Custom Label inside stacked horizontal bar segments
const renderSegmentLabel = (props) => {
  const { x, y, width, height, value } = props;
  if (!value || value <= 0 || width < 18) return null;
  return (
    <text
      x={x + width / 2}
      y={y + height / 2}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-[11px] font-bold select-none drop-shadow"
    >
      {value}
    </text>
  );
};

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((acc, curr) => acc + (curr.value || 0), 0);

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
      <div className="mt-2 border-t border-border pt-1 flex justify-between font-bold text-foreground">
        <span>Total:</span>
        <span>{total}</span>
      </div>
    </div>
  );
}

function ConsultationSplitTable({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground">
        No consultation split data available.
      </div>
    );
  }

  const totalHomecare = data.reduce((acc, curr) => acc + (curr.homecare || 0), 0);
  const totalPhonecall = data.reduce((acc, curr) => acc + (curr.phonecall || 0), 0);
  const grandTotal = data.reduce((acc, curr) => acc + (curr.total || 0), 0);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-semibold">Healthcare Role</th>
            <th className="px-4 py-3 font-semibold text-right">Homecare Consultations</th>
            <th className="px-4 py-3 font-semibold text-right">Phonecall Consultations</th>
            <th className="px-4 py-3 font-semibold text-right">Total Consultations</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row) => (
            <tr key={row.role} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-medium text-foreground">{row.role}</td>
              <td className="px-4 py-3 text-right font-medium text-blue-600 dark:text-blue-400">
                {row.homecare}
              </td>
              <td className="px-4 py-3 text-right font-medium text-green-600 dark:text-green-400">
                {row.phonecall}
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
            <td className="px-4 py-3 text-right text-green-600 dark:text-green-400 font-bold">{totalPhonecall}</td>
            <td className="px-4 py-3 text-right text-foreground font-bold">{grandTotal}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function ConsultationSplitChart({ dateRange = null }) {
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

        const res = await pptChartsApi.getConsultationSplit(params);

        if (isMounted) {
          const list = res?.data || [];
          setChartData(list);
          setGrandTotal(res?.grand_total ?? 0);
        }
      } catch (err) {
        console.error('Failed to load consultation split data:', err);
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
      id="chart-consultation-split"
      title="Split of Consultations"
      description="Breakdown of consultations across clinical roles (Physiotherapist, Counsellor, Nurse, Doctor) by care mode"
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
              No consultation records found for this period.
            </div>
          ) : (
            <div>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  layout="vertical"
                  data={chartData}
                  margin={{ top: 10, right: 30, left: 30, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.2} />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tick={{ fill: 'currentColor', fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    dataKey="role"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'currentColor', fontSize: 12, fontWeight: 500 }}
                    width={110}
                    className="text-foreground"
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    iconType="rect"
                    wrapperStyle={{ paddingTop: '16px' }}
                    formatter={(value) => (
                      <span className="text-xs font-medium text-foreground">{value}</span>
                    )}
                  />
                  <Bar
                    dataKey="homecare"
                    name="Homecare consultations"
                    stackId="a"
                    fill="#2f65b9"
                    label={renderSegmentLabel}
                    maxBarSize={32}
                  />
                  <Bar
                    dataKey="phonecall"
                    name="Phonecall consultations"
                    stackId="a"
                    fill="#558b2f"
                    radius={[0, 4, 4, 0]}
                    label={renderSegmentLabel}
                    maxBarSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Footer Metric */}
          <div className="mt-3 flex items-center justify-end border-t border-border pt-3 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">
              Total Consultations:{' '}
              <span className="font-bold text-blue-600 dark:text-blue-400">{grandTotal}</span>
            </div>
          </div>
        </div>
      ) : (
        <ConsultationSplitTable data={chartData} />
      )}
    </PptChartCard>
  );
}

export default ConsultationSplitChart;
