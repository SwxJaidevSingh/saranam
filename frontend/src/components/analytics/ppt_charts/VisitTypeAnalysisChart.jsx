import React, { useEffect, useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
} from 'recharts';
import PptChartCard from './shared/charts/PptChartCard';
import pptChartsApi from '@/api/pptCharts';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const newVisits = payload.find((p) => p.dataKey === 'new_visit')?.value ?? 0;
  const followUpVisits = payload.find((p) => p.dataKey === 'follow_up_visit')?.value ?? 0;
  const bereavementVisits = payload.find((p) => p.dataKey === 'bereavement_visit')?.value ?? 0;
  const total = newVisits + followUpVisits + bereavementVisits;

  return (
    <div className="rounded-xl border border-border bg-card p-3 text-xs text-card-foreground shadow-xl">
      <div className="font-semibold text-foreground mb-1.5">{label}</div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            New visit:
          </span>
          <span className="font-bold text-blue-600 dark:text-blue-400">{newVisits}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-orange-500" />
            Follow up visit:
          </span>
          <span className="font-bold text-orange-600 dark:text-orange-400">{followUpVisits}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            Bereavement visit:
          </span>
          <span className="font-bold text-slate-600 dark:text-slate-300">{bereavementVisits}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-6 border-t border-border pt-1 font-semibold">
          <span className="text-foreground">Total Visits:</span>
          <span className="text-foreground">{total}</span>
        </div>
      </div>
    </div>
  );
}

function VisitTypeTable({ data, totalNew, totalFollowUp, totalBereavement, grandTotal }) {
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground">
        No visit type analysis data available in the selected range.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-semibold">Month</th>
            <th className="px-4 py-3 font-semibold text-right">New Visits</th>
            <th className="px-4 py-3 font-semibold text-right">Follow-up Visits</th>
            <th className="px-4 py-3 font-semibold text-right">Bereavement Visits</th>
            <th className="px-4 py-3 font-semibold text-right">Total Visits</th>
            <th className="px-4 py-3 font-semibold text-right">% of Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row) => (
            <tr key={row.month_key} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-medium text-foreground">{row.month}</td>
              <td className="px-4 py-3 text-right font-bold text-blue-600 dark:text-blue-400">
                {row.new_visit}
              </td>
              <td className="px-4 py-3 text-right font-bold text-orange-600 dark:text-orange-400">
                {row.follow_up_visit}
              </td>
              <td className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">
                {row.bereavement_visit}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-foreground">
                {row.total}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {grandTotal > 0 ? `${roundVal((row.total / grandTotal) * 100)}%` : '0%'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-border bg-muted/30 font-semibold">
          <tr>
            <td className="px-4 py-3 text-foreground font-bold">Grand Total</td>
            <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400 font-bold">{totalNew}</td>
            <td className="px-4 py-3 text-right text-orange-600 dark:text-orange-400 font-bold">{totalFollowUp}</td>
            <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300 font-bold">{totalBereavement}</td>
            <td className="px-4 py-3 text-right text-foreground font-bold">{grandTotal}</td>
            <td className="px-4 py-3 text-right text-muted-foreground">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function roundVal(num) {
  return Math.round(num * 10) / 10;
}

export function VisitTypeAnalysisChart({ dateRange = null }) {
  const [view, setView] = useState('chart'); // 'chart' | 'table'
  const [status, setStatus] = useState('all');
  const [complexity, setComplexity] = useState('all');
  const [chartData, setChartData] = useState([]);
  const [totalNew, setTotalNew] = useState(0);
  const [totalFollowUp, setTotalFollowUp] = useState(0);
  const [totalBereavement, setTotalBereavement] = useState(0);
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

        const res = await pptChartsApi.getVisitTypeAnalysis(params);

        if (isMounted) {
          const list = res?.data || [];
          setChartData(list);
          setTotalNew(res?.total_new_visits ?? 0);
          setTotalFollowUp(res?.total_follow_up_visits ?? 0);
          setTotalBereavement(res?.total_bereavement_visits ?? 0);
          setGrandTotal(res?.grand_total ?? 0);
        }
      } catch (err) {
        console.error('Failed to load visit type analysis data:', err);
        if (isMounted) {
          setChartData([]);
          setTotalNew(0);
          setTotalFollowUp(0);
          setTotalBereavement(0);
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

  const maxVal = useMemo(() => {
    if (!chartData || chartData.length === 0) return 140;
    const highest = Math.max(
      ...chartData.map((d) =>
        Math.max(d.new_visit || 0, d.follow_up_visit || 0, d.bereavement_visit || 0)
      ),
      20
    );
    return Math.ceil(highest / 20) * 20 + 20;
  }, [chartData]);

  return (
    <PptChartCard
      id="chart-visit-type-analysis"
      title="Type of Home-Visit Analysis"
      description="Monthly volume breakdown by visit type: First visit, Follow up visits, and Bereavement visits"
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
          {chartData.length === 0 || grandTotal === 0 ? (
            <div className="flex h-[340px] items-center justify-center text-xs text-muted-foreground">
              No visit type data available in the selected range.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart
                data={chartData}
                margin={{ top: 24, right: 30, left: 10, bottom: 8 }}
                barGap={4}
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

                <Legend
                  verticalAlign="bottom"
                  iconType="rect"
                  wrapperStyle={{ paddingTop: '14px' }}
                  formatter={(val) => (
                    <span className="text-xs font-medium text-foreground">{val}</span>
                  )}
                />

                <Bar
                  dataKey="new_visit"
                  name="New visit"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={38}
                >
                  <LabelList
                    dataKey="new_visit"
                    position="top"
                    offset={6}
                    className="fill-foreground font-bold text-xs"
                  />
                </Bar>

                <Bar
                  dataKey="follow_up_visit"
                  name="Follow up visit"
                  fill="#f97316"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={38}
                >
                  <LabelList
                    dataKey="follow_up_visit"
                    position="top"
                    offset={6}
                    className="fill-foreground font-bold text-xs"
                  />
                </Bar>

                <Bar
                  dataKey="bereavement_visit"
                  name="Bereavement visit"
                  fill="#94a3b8"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={38}
                >
                  <LabelList
                    dataKey="bereavement_visit"
                    position="top"
                    offset={6}
                    className="fill-foreground font-bold text-xs"
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* Footer Total Bar */}
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>
                New: <strong className="text-blue-600 dark:text-blue-400">{totalNew}</strong>
              </span>
              <span>
                Follow-up: <strong className="text-orange-600 dark:text-orange-400">{totalFollowUp}</strong>
              </span>
              <span>
                Bereavement: <strong className="text-slate-600 dark:text-slate-300">{totalBereavement}</strong>
              </span>
            </div>
            <div className="font-medium text-foreground">
              Total Home Visits: <span className="font-bold text-foreground">{grandTotal}</span>
            </div>
          </div>
        </div>
      ) : (
        <VisitTypeTable
          data={chartData}
          totalNew={totalNew}
          totalFollowUp={totalFollowUp}
          totalBereavement={totalBereavement}
          grandTotal={grandTotal}
        />
      )}
    </PptChartCard>
  );
}

export default VisitTypeAnalysisChart;
