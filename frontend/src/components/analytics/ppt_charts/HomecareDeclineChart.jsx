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
import pptChartsApi from '@/api/pptCharts';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const declinePct = payload[0]?.value;
  const item = payload[0]?.payload;

  return (
    <div className="rounded-xl border border-border bg-card p-3 text-xs text-card-foreground shadow-xl">
      <div className="font-semibold text-foreground mb-1.5">{label}</div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Decline Rate:</span>
          <span className="font-bold text-blue-600 dark:text-blue-400">
            {declinePct}%
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Registered:</span>
          <span className="font-medium text-foreground">{item?.registered}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Willing for homecare:</span>
          <span className="font-medium text-foreground">{item?.willing}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Not willing:</span>
          <span className="font-medium text-foreground">{item?.not_willing}</span>
        </div>
      </div>
    </div>
  );
}

function HomecareDeclineTable({ data, totalReg, totalWill, totalNotWill, overallPct, notes }) {
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground">
        No homecare decline data available in the selected range.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Month name</th>
              <th className="px-4 py-3 font-semibold text-right">Patients registered per month</th>
              <th className="px-4 py-3 font-semibold text-right">Patients willing for homecare (Yes)</th>
              <th className="px-4 py-3 font-semibold text-right">Patients not willing for home care</th>
              <th className="px-4 py-3 font-semibold text-right">Homecare decline %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((row) => (
              <tr key={row.month_key} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{row.month}</td>
                <td className="px-4 py-3 text-right font-medium text-foreground">{row.registered}</td>
                <td className="px-4 py-3 text-right font-medium text-foreground">{row.willing}</td>
                <td className="px-4 py-3 text-right font-medium text-foreground">{row.not_willing}</td>
                <td className="px-4 py-3 text-right font-bold text-blue-600 dark:text-blue-400">
                  {row.decline_percentage}%
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-border bg-muted/30 font-semibold">
            <tr>
              <td className="px-4 py-3 text-foreground font-bold">Total</td>
              <td className="px-4 py-3 text-right text-foreground font-bold">{totalReg}</td>
              <td className="px-4 py-3 text-right text-foreground font-bold">{totalWill}</td>
              <td className="px-4 py-3 text-right text-foreground font-bold">{totalNotWill}</td>
              <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400 font-bold">
                {overallPct}%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {notes?.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-border bg-muted/20 p-3.5 text-xs text-muted-foreground">
          <div className="font-semibold text-foreground mb-1">Reference Notes:</div>
          {notes.map((note, idx) => (
            <p key={idx} className="leading-relaxed">
              • {note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function HomecareDeclineChart({ dateRange = null }) {
  const [view, setView] = useState('chart'); // 'chart' | 'table'
  const [status, setStatus] = useState('all');
  const [complexity, setComplexity] = useState('all');
  const [chartData, setChartData] = useState([]);
  const [totalReg, setTotalReg] = useState(0);
  const [totalWill, setTotalWill] = useState(0);
  const [totalNotWill, setTotalNotWill] = useState(0);
  const [overallPct, setOverallPct] = useState(0);
  const [notes, setNotes] = useState([]);
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

        const res = await pptChartsApi.getHomecareDecline(params);

        if (isMounted) {
          const list = res?.data || [];
          setChartData(list);
          setTotalReg(res?.total_registered ?? 0);
          setTotalWill(res?.total_willing ?? 0);
          setTotalNotWill(res?.total_not_willing ?? 0);
          setOverallPct(res?.overall_decline_percentage ?? 0);
          setNotes(res?.notes || []);
        }
      } catch (err) {
        console.error('Failed to load homecare decline data:', err);
        if (isMounted) {
          setChartData([]);
          setTotalReg(0);
          setTotalWill(0);
          setTotalNotWill(0);
          setOverallPct(0);
          setNotes([]);
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
    if (!chartData || chartData.length === 0) return 45;
    const highest = Math.max(...chartData.map((d) => d.decline_percentage || 0), 10);
    return Math.min(100, Math.ceil(highest / 5) * 5 + 5);
  }, [chartData]);

  return (
    <PptChartCard
      id="chart-homecare-decline"
      title="Homecare Decline %"
      description="Monthly percentage of newly registered patients declining home-based palliative care"
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
              No homecare decline data available in the selected range.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <LineChart
                data={chartData}
                margin={{ top: 24, right: 36, left: 10, bottom: 12 }}
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
                  tickFormatter={(val) => `${val}%`}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />

                <Tooltip content={<ChartTooltip />} />

                <Line
                  type="linear"
                  dataKey="decline_percentage"
                  name="Decline %"
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
                    dataKey="decline_percentage"
                    position="top"
                    offset={10}
                    formatter={(val) => `${val}%`}
                    className="fill-foreground font-semibold text-xs"
                  />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          )}

          {/* Footer Metrics */}
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
            <div>
              Overall Decline Rate:{' '}
              <strong className="text-blue-600 dark:text-blue-400 font-semibold">{overallPct}%</strong>
            </div>
            <div className="font-medium text-foreground">
              Total Evaluated Patients:{' '}
              <span className="font-bold text-foreground">{totalReg}</span>
            </div>
          </div>
        </div>
      ) : (
        <HomecareDeclineTable
          data={chartData}
          totalReg={totalReg}
          totalWill={totalWill}
          totalNotWill={totalNotWill}
          overallPct={overallPct}
          notes={notes}
        />
      )}
    </PptChartCard>
  );
}

export default HomecareDeclineChart;
