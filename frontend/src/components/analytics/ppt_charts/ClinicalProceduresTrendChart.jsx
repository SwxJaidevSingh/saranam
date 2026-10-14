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

// Custom Label inside each segment
const renderSegmentLabel = (props) => {
  const { x, y, width, height, value } = props;
  if (!value || value <= 0 || height < 14) return null;
  return (
    <text
      x={x + width / 2}
      y={y + height / 2}
      fill="#1e293b"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-[11px] font-bold select-none drop-shadow-sm"
    >
      {value}
    </text>
  );
};

// Custom Total Label on top of each stacked bar
const renderTotalLabel = (props) => {
  const { x, y, width, value } = props;
  if (!value) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 8}
      fill="currentColor"
      textAnchor="middle"
      className="text-xs font-black fill-foreground"
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

function ClinicalProceduresTable({ data, hasDoctor }) {
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground">
        No at-home clinical procedures data available.
      </div>
    );
  }

  const totalNurse = data.reduce((acc, curr) => acc + (curr.nurse || 0), 0);
  const totalCounsellor = data.reduce((acc, curr) => acc + (curr.counsellor || 0), 0);
  const totalPhysio = data.reduce((acc, curr) => acc + (curr.physiotherapist || 0), 0);
  const totalDoctor = data.reduce((acc, curr) => acc + (curr.doctor || 0), 0);
  const grandTotal = data.reduce((acc, curr) => acc + (curr.total || 0), 0);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-semibold">Month</th>
            <th className="px-4 py-3 font-semibold text-right">Nurse</th>
            <th className="px-4 py-3 font-semibold text-right">Counsellor</th>
            <th className="px-4 py-3 font-semibold text-right">Physiotherapist</th>
            {hasDoctor && <th className="px-4 py-3 font-semibold text-right">Doctor</th>}
            <th className="px-4 py-3 font-semibold text-right">Total Procedures</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row) => (
            <tr key={row.month_key || row.month} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-medium text-foreground">{row.month}</td>
              <td className="px-4 py-3 text-right font-medium text-blue-600 dark:text-blue-400">
                {row.nurse}
              </td>
              <td className="px-4 py-3 text-right font-medium text-orange-600 dark:text-orange-400">
                {row.counsellor}
              </td>
              <td className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">
                {row.physiotherapist}
              </td>
              {hasDoctor && (
                <td className="px-4 py-3 text-right font-medium text-purple-600 dark:text-purple-400">
                  {row.doctor}
                </td>
              )}
              <td className="px-4 py-3 text-right font-bold text-foreground">
                {row.total}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-border bg-muted/30 font-semibold">
          <tr>
            <td className="px-4 py-3 text-foreground font-bold">Total</td>
            <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400 font-bold">{totalNurse}</td>
            <td className="px-4 py-3 text-right text-orange-600 dark:text-orange-400 font-bold">{totalCounsellor}</td>
            <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300 font-bold">{totalPhysio}</td>
            {hasDoctor && <td className="px-4 py-3 text-right text-purple-600 dark:text-purple-400 font-bold">{totalDoctor}</td>}
            <td className="px-4 py-3 text-right text-foreground font-bold">{grandTotal}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function ClinicalProceduresTrendChart({ dateRange = null }) {
  const [view, setView] = useState('chart'); // 'chart' | 'table'
  const [status, setStatus] = useState('all');
  const [complexity, setComplexity] = useState('all');
  const [chartData, setChartData] = useState([]);
  const [hasDoctor, setHasDoctor] = useState(false);
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

        const res = await pptChartsApi.getClinicalProceduresTrend(params);

        if (isMounted) {
          const list = res?.data || [];
          setChartData(list);
          setHasDoctor(!!res?.has_doctor);
          setGrandTotal(res?.grand_total ?? 0);
        }
      } catch (err) {
        console.error('Failed to load clinical procedures trend:', err);
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

  // Compute highest category to attach total label to the top-most bar
  const topBarKey = hasDoctor ? 'doctor' : 'physiotherapist';

  return (
    <PptChartCard
      id="chart-clinical-procedures-trend"
      title="At-Home Clinical Procedures"
      description="Nursing | Physio | Psycho-Social"
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
              No at-home clinical procedures recorded for this period.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart
                data={chartData}
                margin={{ top: 25, right: 25, left: 10, bottom: 10 }}
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

                {/* 1. Nurse (Bottom stack) */}
                <Bar
                  dataKey="nurse"
                  name="Nurse"
                  stackId="procedures"
                  fill="#93c5fd"
                  stroke="#3b82f6"
                  strokeWidth={1}
                  label={renderSegmentLabel}
                  maxBarSize={56}
                />

                {/* 2. Counsellor (Middle stack) */}
                <Bar
                  dataKey="counsellor"
                  name="Counsellor"
                  stackId="procedures"
                  fill="#fed7aa"
                  stroke="#f97316"
                  strokeWidth={1}
                  label={renderSegmentLabel}
                  maxBarSize={56}
                />

                {/* 3. Physiotherapist */}
                <Bar
                  dataKey="physiotherapist"
                  name="Physiotherapist"
                  stackId="procedures"
                  fill="#e2e8f0"
                  stroke="#94a3b8"
                  strokeWidth={1}
                  radius={!hasDoctor ? [4, 4, 0, 0] : undefined}
                  label={!hasDoctor ? renderTotalLabel : renderSegmentLabel}
                  maxBarSize={56}
                />

                {/* 4. Doctor (Optional top stack) */}
                {hasDoctor && (
                  <Bar
                    dataKey="doctor"
                    name="Doctor"
                    stackId="procedures"
                    fill="#e9d5ff"
                    stroke="#a855f7"
                    strokeWidth={1}
                    radius={[4, 4, 0, 0]}
                    label={renderTotalLabel}
                    maxBarSize={56}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* Footer Metric */}
          <div className="mt-3 flex items-center justify-end border-t border-border pt-3 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">
              Total Procedures:{' '}
              <span className="font-bold text-blue-600 dark:text-blue-400">{grandTotal}</span>
            </div>
          </div>
        </div>
      ) : (
        <ClinicalProceduresTable data={chartData} hasDoctor={hasDoctor} />
      )}
    </PptChartCard>
  );
}

export default ClinicalProceduresTrendChart;
