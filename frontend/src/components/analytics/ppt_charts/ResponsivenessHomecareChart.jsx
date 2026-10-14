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
import { HomecareDaysInfoContent } from './shared/charts/ResponsivenessInfoContent';
import pptChartsApi from '@/api/pptCharts';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;
  const hcDays = item?.average_homecare_days ?? payload[0]?.value;

  return (
    <div className="rounded-xl border border-border bg-card p-3 text-xs text-card-foreground shadow-xl">
      <div className="font-semibold text-foreground mb-1.5">{label}</div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Avg Homecare Days:</span>
          <span className="font-bold text-blue-600 dark:text-blue-400">
            {hcDays} days
          </span>
        </div>
        <div className="flex items-center justify-between gap-6 pt-1 border-t border-border/50">
          <span className="text-muted-foreground">Patients Contacted:</span>
          <span className="font-medium text-foreground">{item?.patients_count}</span>
        </div>
      </div>
    </div>
  );
}

function ResponsivenessHomecareTable({ data, overallAvg, totalPatients }) {
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground">
        No responsiveness data available in the selected range.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-semibold">Registration Month</th>
            <th className="px-4 py-3 font-semibold text-right">Patients Contacted</th>
            <th className="px-4 py-3 font-semibold text-right text-blue-600 dark:text-blue-400">
              Avg Homecare Days to First Contact
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row) => (
            <tr key={row.month_key} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-medium text-foreground">{row.month}</td>
              <td className="px-4 py-3 text-right font-medium text-foreground">
                {row.patients_count}
              </td>
              <td className="px-4 py-3 text-right font-bold text-blue-600 dark:text-blue-400">
                {row.average_homecare_days} days
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-border bg-muted/30 font-semibold">
          <tr>
            <td className="px-4 py-3 text-foreground font-bold">Overall Average</td>
            <td className="px-4 py-3 text-right text-foreground font-bold">{totalPatients}</td>
            <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400 font-bold">
              {overallAvg} days
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function ResponsivenessHomecareChart({ dateRange = null }) {
  const [view, setView] = useState('chart'); // 'chart' | 'table'
  const [status, setStatus] = useState('all');
  const [complexity, setComplexity] = useState('all');
  const [chartData, setChartData] = useState([]);
  const [overallAvg, setOverallAvg] = useState(0);
  const [totalPatients, setTotalPatients] = useState(0);
  const [hcNote, setHcNote] = useState('Home Care Days are:\nMon, Tue, and Thu, Friday');
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

        const res = await pptChartsApi.getResponsivenessAnalysis(params);

        if (isMounted) {
          const list = res?.data || [];
          setChartData(list);
          setOverallAvg(res?.overall_average_homecare_days ?? res?.overall_average_days ?? 0);
          setTotalPatients(res?.total_patients_with_contact ?? 0);
          if (res?.homecare_days_note) {
            setHcNote(res.homecare_days_note);
          }
        }
      } catch (err) {
        console.error('Failed to load responsiveness homecare data:', err);
        if (isMounted) {
          setChartData([]);
          setOverallAvg(0);
          setTotalPatients(0);
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
    if (!chartData || chartData.length === 0) return 20;
    const highest = Math.max(...chartData.map((d) => d.average_homecare_days || 0), 10);
    return Math.ceil(highest / 4) * 4 + 4;
  }, [chartData]);

  return (
    <PptChartCard
      id="chart-responsiveness-homecare"
      title="Responsiveness Analysis (in Homecare Days)"
      description={`Registration to First Contact (n=${totalPatients})`}
      isLoading={isLoading}
      view={view}
      onViewChange={setView}
      status={status}
      onStatusChange={setStatus}
      complexity={complexity}
      onComplexityChange={setComplexity}
      infoContent={<HomecareDaysInfoContent />}
      infoTitle="Responsiveness Analysis (in Homecare Days) – Calculation & Formula"
    >
      {view === 'chart' ? (
        <div className="pt-2">
          {chartData.length === 0 || totalPatients === 0 ? (
            <div className="flex h-[340px] items-center justify-center text-xs text-muted-foreground">
              No responsiveness data available in the selected range.
            </div>
          ) : (
            <div className="relative">
              {/* Internal Subtitle & Protocol Badge matching presentation slide */}
              <div className="mb-2 flex items-start justify-between gap-4">
                <div className="text-xs text-muted-foreground font-medium">
                  Responsiveness Analysis between registration and <strong className="text-foreground">first contact</strong> (in homecare days)
                </div>
                <div className="rounded-md bg-zinc-800 text-zinc-100 dark:bg-zinc-800 px-3 py-1.5 text-[11px] shadow-sm border border-zinc-700 whitespace-pre-line text-left leading-tight shrink-0">
                  {hcNote}
                </div>
              </div>

              <ResponsiveContainer width="100%" height={320}>
                <LineChart
                  data={chartData}
                  margin={{ top: 20, right: 36, left: 10, bottom: 12 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    horizontal={true}
                    className="stroke-border/40"
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
                    dataKey="average_homecare_days"
                    name="Avg Homecare Days"
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
                      dataKey="average_homecare_days"
                      position="top"
                      offset={10}
                      className="fill-foreground font-semibold text-xs"
                    />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Footer Metrics */}
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
            <div>
              Overall Average Turnaround:{' '}
              <strong className="text-foreground font-semibold">{overallAvg} homecare days</strong>
            </div>
            <div className="font-medium text-foreground">
              Total Contacted Patients:{' '}
              <span className="font-bold text-blue-600 dark:text-blue-400">{totalPatients}</span>
            </div>
          </div>
        </div>
      ) : (
        <ResponsivenessHomecareTable
          data={chartData}
          overallAvg={overallAvg}
          totalPatients={totalPatients}
        />
      )}
    </PptChartCard>
  );
}

export default ResponsivenessHomecareChart;
