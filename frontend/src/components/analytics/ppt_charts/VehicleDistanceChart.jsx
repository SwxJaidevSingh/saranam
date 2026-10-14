import React, { useEffect, useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
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

  return (
    <div className="rounded-xl border border-border bg-card p-3 text-xs text-card-foreground shadow-xl">
      <div className="font-semibold text-foreground mb-2">{label}</div>
      <div className="space-y-1.5">
        {payload.map((item) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              {item.name}:
            </span>
            <span className="font-bold" style={{ color: item.color }}>
              {item.value !== null && item.value !== undefined ? `${item.value.toLocaleString()} kms` : '-'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VehicleDistanceTable({ data, vehicles, totals }) {
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground">
        No vehicle mileage logs available for the selected range.
      </div>
    );
  }

  const vList = vehicles || [];

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-semibold">Month</th>
            {vList.map((v) => (
              <th key={v.key} className="px-4 py-3 font-semibold text-right">
                {v.name}
              </th>
            ))}
            <th className="px-4 py-3 font-semibold text-right">Total (in kms)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row) => (
            <tr key={row.month_key || row.month} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-semibold text-foreground">{row.month}</td>
              {vList.map((v) => {
                const val = row[v.key];
                return (
                  <td
                    key={v.key}
                    className="px-4 py-3 text-right font-medium"
                    style={{ color: v.color }}
                  >
                    {val !== null && val !== undefined ? val.toLocaleString() : '-'}
                  </td>
                );
              })}
              <td className="px-4 py-3 text-right font-bold text-foreground">
                {row.total ? row.total.toLocaleString() : 0}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-border bg-muted/30 font-semibold">
          <tr>
            <td className="px-4 py-3 text-foreground font-bold">Total</td>
            {vList.map((v) => (
              <td
                key={v.key}
                className="px-4 py-3 text-right font-bold"
                style={{ color: v.color }}
              >
                {totals?.[v.key] ? totals[v.key].toLocaleString() : 0}
              </td>
            ))}
            <td className="px-4 py-3 text-right text-foreground font-bold">
              {totals?.grand_total ? totals.grand_total.toLocaleString() : 0}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function VehicleDistanceChart({ dateRange = null }) {
  const [view, setView] = useState('chart'); // 'chart' | 'table'
  const [chartData, setChartData] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [totals, setTotals] = useState({});
  const [grandTotal, setGrandTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        const params = {
          start_date: dateRange?.from ? dateRange.from.toISOString().split('T')[0] : undefined,
          end_date: dateRange?.to ? dateRange.to.toISOString().split('T')[0] : undefined,
        };

        const res = await pptChartsApi.getVehicleDistance(params);

        if (isMounted) {
          const list = res?.data || [];
          setChartData(list);
          setVehicles(res?.vehicles || []);
          setTotals(res?.totals || {});
          setGrandTotal(res?.grand_total || 0);
        }
      } catch (err) {
        console.error('Failed to load vehicle distance data:', err);
        if (isMounted) {
          setChartData([]);
          setVehicles([]);
          setTotals({});
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
  }, [dateRange]);

  // Compute maximum Y value so labels fit comfortably
  const maxVal = useMemo(() => {
    if (!chartData || chartData.length === 0) return 100;
    let highest = 0;
    chartData.forEach((row) => {
      vehicles.forEach((v) => {
        const val = row[v.key];
        if (typeof val === 'number' && val > highest) {
          highest = val;
        }
      });
    });
    if (highest === 0) return 100;
    return Math.ceil((highest * 1.15) / 20) * 20;
  }, [chartData, vehicles]);

  return (
    <PptChartCard
      id="chart-vehicle-distance"
      title="Distance travelled (in kms)"
      description="Monthly comparison of vehicle travel mileage recorded in vehicle logs"
      isLoading={isLoading}
      view={view}
      onViewChange={setView}
    >
      {view === 'chart' ? (
        <div className="pt-2">
          {chartData.length === 0 ? (
            <div className="flex h-[340px] items-center justify-center text-xs text-muted-foreground">
              No vehicle log records found for the selected range.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <LineChart
                data={chartData}
                margin={{ top: 28, right: 36, left: 10, bottom: 20 }}
              >
                {/* Subtle horizontal grid lines matching the reference chart */}
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  horizontal={true}
                  className="stroke-border/40"
                />

                <XAxis
                  dataKey="month"
                  tickLine={true}
                  axisLine={{ stroke: 'hsl(var(--border))', strokeWidth: 1.5 }}
                  tick={{
                    fontSize: 12,
                    fontWeight: 600,
                    fill: 'hsl(var(--foreground))',
                  }}
                  angle={-30}
                  textAnchor="end"
                  height={50}
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
                  wrapperStyle={{ paddingTop: '12px' }}
                  formatter={(value, entry) => (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded"
                      style={{ color: entry.color }}
                    >
                      {value}
                    </span>
                  )}
                />

                {vehicles.map((v) => (
                  <Line
                    key={v.key}
                    type="linear"
                    dataKey={v.key}
                    name={v.name}
                    stroke={v.color}
                    strokeWidth={2.8}
                    connectNulls={false}
                    dot={{
                      r: 5.5,
                      fill: v.color,
                      stroke: '#ffffff',
                      strokeWidth: 2,
                    }}
                    activeDot={{
                      r: 8,
                      fill: v.color,
                      stroke: '#ffffff',
                      strokeWidth: 2,
                    }}
                  >
                    <LabelList
                      dataKey={v.key}
                      position="top"
                      offset={10}
                      className="fill-foreground font-bold text-xs"
                      formatter={(val) =>
                        val !== null && val !== undefined ? `${val}` : ''
                      }
                    />
                  </Line>
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}

          {/* Footer Metric */}
          <div className="mt-3 flex items-center justify-end border-t border-border pt-3 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">
              Total Distance Travelled:{' '}
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {grandTotal.toLocaleString()} kms
              </span>
            </div>
          </div>
        </div>
      ) : (
        <VehicleDistanceTable
          data={chartData}
          vehicles={vehicles}
          totals={totals}
        />
      )}
    </PptChartCard>
  );
}

export default VehicleDistanceChart;
