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
  const alive = payload.find((p) => p.dataKey === 'alive')?.value ?? 0;
  const deceased = payload.find((p) => p.dataKey === 'deceased')?.value ?? 0;
  const total = alive + deceased;

  return (
    <div className="rounded-xl border border-border bg-card p-3 text-xs text-card-foreground shadow-xl">
      <div className="font-semibold text-foreground mb-1.5">{label}</div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Alive:
          </span>
          <span className="font-bold text-blue-600 dark:text-blue-400">{alive}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-orange-500" />
            Deceased:
          </span>
          <span className="font-bold text-orange-600 dark:text-orange-400">{deceased}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-6 border-t border-border pt-1 font-semibold">
          <span className="text-foreground">Total:</span>
          <span className="text-foreground">{total}</span>
        </div>
      </div>
    </div>
  );
}

function VisitsCategorizationTable({ data, totalAlive, totalDeceased, grandTotal }) {
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground">
        No visit categorization data available in the selected range.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Visit Category</th>
              <th className="px-4 py-3 font-semibold text-right">Alive</th>
              <th className="px-4 py-3 font-semibold text-right">Deceased</th>
              <th className="px-4 py-3 font-semibold text-right">Total Patients</th>
              <th className="px-4 py-3 font-semibold text-right">% of Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((row) => (
              <tr key={row.category} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{row.category}</td>
                <td className="px-4 py-3 text-right font-bold text-blue-600 dark:text-blue-400">
                  {row.alive}
                </td>
                <td className="px-4 py-3 text-right font-bold text-orange-600 dark:text-orange-400">
                  {row.deceased}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-foreground">
                  {row.total}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">{row.percentage}%</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-border bg-muted/30 font-semibold">
            <tr>
              <td className="px-4 py-3 text-foreground font-bold">Grand Total</td>
              <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400 font-bold">{totalAlive}</td>
              <td className="px-4 py-3 text-right text-orange-600 dark:text-orange-400 font-bold">{totalDeceased}</td>
              <td className="px-4 py-3 text-right text-foreground font-bold">{grandTotal}</td>
              <td className="px-4 py-3 text-right text-muted-foreground">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export function VisitsCategorizationChart({ dateRange = null }) {
  const [view, setView] = useState('chart'); // 'chart' | 'table'
  const [status, setStatus] = useState('all');
  const [complexity, setComplexity] = useState('all');
  const [chartData, setChartData] = useState([]);
  const [totalAlive, setTotalAlive] = useState(0);
  const [totalDeceased, setTotalDeceased] = useState(0);
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

        const res = await pptChartsApi.getVisitsCategorization(params);

        if (isMounted) {
          const list = res?.data || [];
          setChartData(list);
          setTotalAlive(res?.total_alive ?? 0);
          setTotalDeceased(res?.total_deceased ?? 0);
          setGrandTotal(res?.grand_total ?? 0);
        }
      } catch (err) {
        console.error('Failed to load visits categorization data:', err);
        if (isMounted) {
          setChartData([]);
          setTotalAlive(0);
          setTotalDeceased(0);
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
    if (!chartData || chartData.length === 0) return 50;
    const highest = Math.max(
      ...chartData.map((d) => Math.max(d.alive || 0, d.deceased || 0)),
      10
    );
    return Math.ceil(highest / 10) * 10 + 10;
  }, [chartData]);

  return (
    <PptChartCard
      id="chart-visits-categorization"
      title="Categorization by Number of Visits (for Alive and Deceased Patients)"
      description="Patient volume cohorts across home visit frequency, split by alive and deceased outcome"
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
              No visit categorization data available in the selected range.
            </div>
          ) : (
            <>
              {/* Category Total Badges Row (as shown in slide presentation) */}
              <div className="mb-2 grid grid-cols-5 gap-2 px-10 text-center">
                {chartData.map((d) => (
                  <div
                    key={d.category}
                    className="flex flex-col items-center justify-center rounded-md border border-border bg-card px-2 py-1 shadow-sm"
                  >
                    <span className="text-[10px] text-muted-foreground font-medium">Total</span>
                    <span className="text-sm font-bold text-foreground">{d.total}</span>
                  </div>
                ))}
              </div>

              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 10, bottom: 8 }}
                  barGap={4}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    horizontal={true}
                    className="stroke-border/40"
                  />

                  <XAxis
                    dataKey="category"
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
                    wrapperStyle={{ paddingTop: '12px' }}
                    formatter={(val) => (
                      <span className="text-xs font-medium text-foreground">{val}</span>
                    )}
                  />

                  <Bar
                    dataKey="alive"
                    name="Alive"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={42}
                  >
                    <LabelList
                      dataKey="alive"
                      position="top"
                      offset={6}
                      className="fill-foreground font-bold text-xs"
                    />
                  </Bar>

                  <Bar
                    dataKey="deceased"
                    name="Deceased"
                    fill="#f97316"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={42}
                  >
                    <LabelList
                      dataKey="deceased"
                      position="top"
                      offset={6}
                      className="fill-foreground font-bold text-xs"
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </>
          )}

          {/* Footer Total Bar */}
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>
                Alive: <strong className="text-blue-600 dark:text-blue-400">{totalAlive}</strong>
              </span>
              <span>
                Deceased: <strong className="text-orange-600 dark:text-orange-400">{totalDeceased}</strong>
              </span>
            </div>
            <div className="font-medium text-foreground">
              Total Patients: <span className="font-bold text-foreground">{grandTotal}</span>
            </div>
          </div>
        </div>
      ) : (
        <VisitsCategorizationTable
          data={chartData}
          totalAlive={totalAlive}
          totalDeceased={totalDeceased}
          grandTotal={grandTotal}
        />
      )}
    </PptChartCard>
  );
}

export default VisitsCategorizationChart;
