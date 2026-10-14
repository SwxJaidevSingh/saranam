import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, ShieldAlert, Download, Gauge, ShieldCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { subMonths } from 'date-fns';
import { exportChartAsSvg } from '@/utils/chartExport';
import { TimelineSwitch } from './TimelineSwitch';
import { Skeleton } from '@/components/ui/skeleton';
import analyticsApi from '@/api/analytics';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PRESET_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6'];

// Dynamic helper to compute Top 5 with an "Others" category on the client
const getTop5WithOthers = (stats) => {
  if (!stats || stats.length <= 5) return stats || [];
  const top5 = stats.slice(0, 5);
  const othersCount = stats.slice(5).reduce((sum, item) => sum + item.count, 0);
  const total = stats.reduce((sum, item) => sum + item.count, 0);
  const othersPct = total > 0 ? Number(((othersCount / total) * 100).toFixed(1)) : 0;

  return [
    ...top5,
    { name: 'Others', count: othersCount, percentage: othersPct }
  ];
};

const DataTable = ({ data = [] }) => {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="h-[300px] overflow-y-auto border border-border rounded-lg custom-scrollbar">
      <table className="min-w-full divide-y divide-border text-xs text-left">
        <thead className="bg-muted/50 sticky top-0 backdrop-blur-sm z-10">
          <tr>
            <th className="p-3 font-semibold text-muted-foreground">Category</th>
            <th className="p-3 font-semibold text-muted-foreground text-right">Count</th>
            <th className="p-3 font-semibold text-muted-foreground text-right">Percentage</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((item, idx) => {
            const pct = total > 0 ? ((item.count / total) * 100).toFixed(1) : 0;
            return (
              <tr key={idx} className="hover:bg-muted/10 transition-colors">
                <td className="p-3 font-medium text-foreground">{item.name}</td>
                <td className="p-3 text-right font-mono text-foreground">{item.count}</td>
                <td className="p-3 text-right font-mono text-muted-foreground">{pct}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};


const ChartFilters = ({ status, onStatusChange, age, onAgeChange, range, onRangeChange }) => {
  return (
    <div className="flex items-center gap-2">
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[130px] h-8 text-xs font-semibold bg-background border-border">
          <SelectValue placeholder="Patient Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">All Patients</SelectItem>
          <SelectItem value="alive_active" className="text-xs">Alive & Active</SelectItem>
          <SelectItem value="inactive" className="text-xs">Alive & Inactive</SelectItem>
          <SelectItem value="dead" className="text-xs">Deceased</SelectItem>
        </SelectContent>
      </Select>
      <Select value={age} onValueChange={onAgeChange}>
        <SelectTrigger className="w-[130px] h-8 text-xs font-semibold bg-background border-border">
          <SelectValue placeholder="Age Group" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">All Ages</SelectItem>
          <SelectItem value="child_adolescent" className="text-xs">Child & Adolescent (1-19)</SelectItem>
          <SelectItem value="adults" className="text-xs">Adults (19-59)</SelectItem>
          <SelectItem value="older_adults" className="text-xs">Older Adults (&gt;=60)</SelectItem>
        </SelectContent>
      </Select>
      <TimelineSwitch
        value={range}
        onChange={onRangeChange}
      />
    </div>
  );
};

export const DiseaseAnalysisView = () => {
  // 1. Diagnoses States
  const [diagRange, setDiagRange] = useState('1M');
  const [diagDateRange, setDiagDateRange] = useState({
    from: subMonths(new Date(), 1),
    to: new Date()
  });
  const [diagStatus, setDiagStatus] = useState('all');
  const [diagAge, setDiagAge] = useState('all');
  const [diagnosesRes, setDiagnosesRes] = useState({ data: [], stats: [] });
  const [diagLoading, setDiagLoading] = useState(true);

  // 2. Complexity States
  const [complexityRange, setComplexityRange] = useState('1M');
  const [complexityDateRange, setComplexityDateRange] = useState({
    from: subMonths(new Date(), 1),
    to: new Date()
  });
  const [complexityStatus, setComplexityStatus] = useState('all');
  const [complexityAge, setComplexityAge] = useState('all');
  const [complexityRes, setComplexityRes] = useState({ stats: [] });
  const [complexityLoading, setComplexityLoading] = useState(true);

  // 3. BSC States
  const [bscRange, setBscRange] = useState('1M');
  const [bscDateRange, setBscDateRange] = useState({
    from: subMonths(new Date(), 1),
    to: new Date()
  });
  const [bscStatus, setBscStatus] = useState('all');
  const [bscAge, setBscAge] = useState('all');
  const [bscRes, setBscRes] = useState({ stats: [] });
  const [bscLoading, setBscLoading] = useState(true);

  // 4. Complaints States
  const [complaintsRange, setComplaintsRange] = useState('1M');
  const [complaintsDateRange, setComplaintsDateRange] = useState({
    from: subMonths(new Date(), 1),
    to: new Date()
  });
  const [complaintsStatus, setComplaintsStatus] = useState('all');
  const [complaintsAge, setComplaintsAge] = useState('all');
  const [complaintsRes, setComplaintsRes] = useState({ data: [], stats: [] });
  const [complaintsLoading, setComplaintsLoading] = useState(true);

  const [chartLayout, setChartLayout] = useState('all-scrollable'); // 'top-5' | 'all-scrollable'

  // View modes (chart vs table)
  const [diagView, setDiagView] = useState('chart');
  const [complexityView, setComplexityView] = useState('chart');
  const [bscView, setBscView] = useState('chart');
  const [complaintsView, setComplaintsView] = useState('chart');


  // 1. Fetch Diagnoses
  useEffect(() => {
    let cancelled = false;
    const fetchDiagnoses = async () => {
      try {
        setDiagLoading(true);
        const res = await analyticsApi.getPatientDiagnoses({
          start_date: diagDateRange.from.toISOString(),
          end_date: diagDateRange.to.toISOString(),
          patient_status: diagStatus,
          age_group: diagAge
        });
        if (!cancelled && res.success) {
          setDiagnosesRes(res);
        }
      } catch (err) {
        console.error('Error loading diagnoses:', err);
      } finally {
        if (!cancelled) setDiagLoading(false);
      }
    };
    fetchDiagnoses();
    return () => { cancelled = true; };
  }, [diagDateRange, diagStatus, diagAge]);

  // 2. Fetch Complexity
  useEffect(() => {
    let cancelled = false;
    const fetchComplexity = async () => {
      try {
        setComplexityLoading(true);
        const res = await analyticsApi.getPatientComplexity({
          start_date: complexityDateRange.from.toISOString(),
          end_date: complexityDateRange.to.toISOString(),
          patient_status: complexityStatus,
          age_group: complexityAge
        });
        if (!cancelled && res.success) {
          setComplexityRes(res);
        }
      } catch (err) {
        console.error('Error loading complexity:', err);
      } finally {
        if (!cancelled) setComplexityLoading(false);
      }
    };
    fetchComplexity();
    return () => { cancelled = true; };
  }, [complexityDateRange, complexityStatus, complexityAge]);

  // 3. Fetch BSC
  useEffect(() => {
    let cancelled = false;
    const fetchBsc = async () => {
      try {
        setBscLoading(true);
        const res = await analyticsApi.getPatientBSC({
          start_date: bscDateRange.from.toISOString(),
          end_date: bscDateRange.to.toISOString(),
          patient_status: bscStatus,
          age_group: bscAge
        });
        if (!cancelled && res.success) {
          setBscRes(res);
        }
      } catch (err) {
        console.error('Error loading BSC:', err);
      } finally {
        if (!cancelled) setBscLoading(false);
      }
    };
    fetchBsc();
    return () => { cancelled = true; };
  }, [bscDateRange, bscStatus, bscAge]);

  // 4. Fetch Complaints
  useEffect(() => {
    let cancelled = false;
    const fetchComplaints = async () => {
      try {
        setComplaintsLoading(true);
        const res = await analyticsApi.getPatientComplaints({
          start_date: complaintsDateRange.from.toISOString(),
          end_date: complaintsDateRange.to.toISOString(),
          patient_status: complaintsStatus,
          age_group: complaintsAge
        });
        if (!cancelled && res.success) {
          setComplaintsRes(res);
        }
      } catch (err) {
        console.error('Error loading complaints:', err);
      } finally {
        if (!cancelled) setComplaintsLoading(false);
      }
    };
    fetchComplaints();
    return () => { cancelled = true; };
  }, [complaintsDateRange, complaintsStatus, complaintsAge]);

  return (
    <div className="space-y-6">
      {/* Layout Presentation Toggle Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card border border-border rounded-xl p-4 gap-4 shadow-sm">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold text-foreground">Disease Chart View Option</h3>
          <p className="text-xs text-muted-foreground">Select how to display the diagnoses and chief complaints distribution</p>
        </div>
        <div className="inline-flex p-1 bg-muted/60 backdrop-blur-sm rounded-lg border border-border shadow-sm">
          <button
            onClick={() => setChartLayout('top-5')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${chartLayout === 'top-5'
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
          >
            Top 5 + Others
          </button>
          <button
            onClick={() => setChartLayout('all-scrollable')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${chartLayout === 'all-scrollable'
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
          >
            All (Scrollable List)
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Primary Diagnoses Card */}
        <Card className="border-border bg-card shadow-sm transition-all hover:shadow-lg" id="primary-diagnoses-analysis-chart">
          <CardHeader className="flex flex-col space-y-3 pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-5 w-5 text-indigo-500" />
                  Types of Cancers
                </CardTitle>
                <CardDescription>
                  Distribution of primary cancer diagnoses among registered patients
                </CardDescription>
              </div>
              {diagnosesRes.stats.length > 0 && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/30">
                    <button
                      onClick={() => setDiagView('chart')}
                      className={`px-2 py-1 text-[10px] font-semibold rounded transition-all duration-150 ${diagView === 'chart' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      title="Show Chart"
                    >
                      Chart
                    </button>
                    <button
                      onClick={() => setDiagView('table')}
                      className={`px-2 py-1 text-[10px] font-semibold rounded transition-all duration-150 ${diagView === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      title="Show Table"
                    >
                      Table
                    </button>
                  </div>
                  <button
                    onClick={() => exportChartAsSvg('primary-diagnoses-analysis-chart', 'primary-diagnosis-distribution.svg')}
                    className="inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none h-8 w-8 flex-shrink-0"
                    title="Download Chart SVG"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              )}

            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2 mt-1 border-t border-border/40">
              <ChartFilters
                status={diagStatus}
                onStatusChange={setDiagStatus}
                age={diagAge}
                onAgeChange={setDiagAge}
                range={diagRange}
                onRangeChange={(val, range) => {
                  setDiagRange(val);
                  setDiagDateRange(range);
                }}
              />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {diagLoading ? (
              <div className="space-y-2 py-8">
                <Skeleton className="h-40 w-full" />
              </div>
            ) : diagnosesRes.stats.length > 0 ? (
              diagView === 'table' ? (
                <DataTable data={diagnosesRes.stats} />
              ) : chartLayout === 'all-scrollable' ? (

                // Scrollable container for all diagnoses
                <div className="h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  <ResponsiveContainer width="100%" height={Math.max(300, diagnosesRes.stats.length * 38)}>
                    <BarChart data={diagnosesRes.stats} layout="vertical" margin={{ left: 5, right: 20, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                      <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                        width={140}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]}>
                        {diagnosesRes.stats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PRESET_COLORS[index % PRESET_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                // Clean Top 5 list
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getTop5WithOthers(diagnosesRes.stats)} layout="vertical" margin={{ left: 5, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                    <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      width={140}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]}>
                      {getTop5WithOthers(diagnosesRes.stats).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PRESET_COLORS[index % PRESET_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No diagnosis data</p>
            )}
          </CardContent>
        </Card>

        {/*Complexity Card*/}
        <Card className="border-border bg-card shadow-sm transition-all hover:shadow-lg" id="clinical-complexity-chart">
          <CardHeader className="flex flex-col space-y-3 pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Gauge className="h-5 w-5 text-amber-500" />
                  Clinical Complexity
                </CardTitle>
                <CardDescription>
                  Distribution of patients by clinical complexity
                </CardDescription>
              </div>
              {complexityRes.stats.length > 0 && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/30">
                    <button
                      onClick={() => setComplexityView('chart')}
                      className={`px-2 py-1 text-[10px] font-semibold rounded transition-all duration-150 ${complexityView === 'chart' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      title="Show Chart"
                    >
                      Chart
                    </button>
                    <button
                      onClick={() => setComplexityView('table')}
                      className={`px-2 py-1 text-[10px] font-semibold rounded transition-all duration-150 ${complexityView === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      title="Show Table"
                    >
                      Table
                    </button>
                  </div>
                  <button
                    onClick={() =>
                      exportChartAsSvg(
                        "clinical-complexity-chart",
                        "clinical-complexity.svg"
                      )
                    }
                    className="inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none h-8 w-8 flex-shrink-0"
                    title="Download Chart SVG"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              )}

            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2 mt-1 border-t border-border/40">
              <ChartFilters
                status={complexityStatus}
                onStatusChange={setComplexityStatus}
                age={complexityAge}
                onAgeChange={setComplexityAge}
                range={complexityRange}
                onRangeChange={(val, range) => {
                  setComplexityRange(val);
                  setComplexityDateRange(range);
                }}
              />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {complexityLoading ? (
              <div className="space-y-2 py-8">
                <Skeleton className="h-40 w-full" />
              </div>
            ) : complexityRes.stats.length > 0 ? (
              complexityView === 'table' ? (
                <DataTable data={complexityRes.stats} />
              ) : (
                <ResponsiveContainer width="100%" height={300}>

                <BarChart
                  data={complexityRes.stats}
                  layout="vertical"
                  margin={{ left: 5, right: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                  <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    width={140}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {complexityRes.stats.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={PRESET_COLORS[index % PRESET_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No complexity data
              </p>

            )}
          </CardContent>
        </Card>

        {/*BSC Card*/}
        <Card className="border-border bg-card shadow-sm transition-all hover:shadow-lg" id="bsc-analysis-chart">
          <CardHeader className="flex flex-col space-y-3 pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-teal-500" />
                  BSC
                </CardTitle>
                <CardDescription>
                  Distribution of patients by BSC
                </CardDescription>
              </div>
              {bscRes.stats.length > 0 && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/30">
                    <button
                      onClick={() => setBscView('chart')}
                      className={`px-2 py-1 text-[10px] font-semibold rounded transition-all duration-150 ${bscView === 'chart' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      title="Show Chart"
                    >
                      Chart
                    </button>
                    <button
                      onClick={() => setBscView('table')}
                      className={`px-2 py-1 text-[10px] font-semibold rounded transition-all duration-150 ${bscView === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      title="Show Table"
                    >
                      Table
                    </button>
                  </div>
                  <button
                    onClick={() =>
                      exportChartAsSvg(
                        "bsc-analysis-chart",
                        "bsc-distribution.svg"
                      )
                    }
                    className="inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none h-8 w-8 flex-shrink-0"
                    title="Download Chart SVG"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              )}

            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2 mt-1 border-t border-border/40">
              <ChartFilters
                status={bscStatus}
                onStatusChange={setBscStatus}
                age={bscAge}
                onAgeChange={setBscAge}
                range={bscRange}
                onRangeChange={(val, range) => {
                  setBscRange(val);
                  setBscDateRange(range);
                }}
              />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {bscLoading ? (
              <div className="space-y-2 py-8">
                <Skeleton className="h-40 w-full" />
              </div>
            ) : bscRes.stats.length > 0 ? (
              bscView === 'table' ? (
                <DataTable data={bscRes.stats} />
              ) : (
                <ResponsiveContainer width="100%" height={300}>

                <BarChart
                  data={bscRes.stats}
                  layout="vertical"
                  margin={{ left: 5, right: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                  <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    width={140}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {bscRes.stats.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={PRESET_COLORS[index % PRESET_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No BSC data
              </p>

            )}
          </CardContent>
        </Card>

        {/* Chief Complaints Card */}
        <Card className="border-border bg-card shadow-sm transition-all hover:shadow-lg" id="chief-complaints-analysis-chart">
          <CardHeader className="flex flex-col space-y-3 pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-rose-500" />
                  Chief Complaints (Latest Visits)
                </CardTitle>
                <CardDescription>
                  Distribution of patient symptoms/complaints reported in the latest encounter
                </CardDescription>
              </div>
              {complaintsRes.stats.length > 0 && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/30">
                    <button
                      onClick={() => setComplaintsView('chart')}
                      className={`px-2 py-1 text-[10px] font-semibold rounded transition-all duration-150 ${complaintsView === 'chart' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      title="Show Chart"
                    >
                      Chart
                    </button>
                    <button
                      onClick={() => setComplaintsView('table')}
                      className={`px-2 py-1 text-[10px] font-semibold rounded transition-all duration-150 ${complaintsView === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      title="Show Table"
                    >
                      Table
                    </button>
                  </div>
                  <button
                    onClick={() => exportChartAsSvg('chief-complaints-analysis-chart', 'chief-complaints-distribution.svg')}
                    className="inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none h-8 w-8 flex-shrink-0"
                    title="Download Chart SVG"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              )}

            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2 mt-1 border-t border-border/40">
              <ChartFilters
                status={complaintsStatus}
                onStatusChange={setComplaintsStatus}
                age={complaintsAge}
                onAgeChange={setComplaintsAge}
                range={complaintsRange}
                onRangeChange={(val, range) => {
                  setComplaintsRange(val);
                  setComplaintsDateRange(range);
                }}
              />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {complaintsLoading ? (
              <div className="space-y-2 py-8">
                <Skeleton className="h-40 w-full" />
              </div>
            ) : complaintsRes.stats.length > 0 ? (
              complaintsView === 'table' ? (
                <DataTable data={complaintsRes.stats} />
              ) : chartLayout === 'all-scrollable' ? (

                // Scrollable container for all complaints
                <div className="h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  <ResponsiveContainer width="100%" height={Math.max(300, complaintsRes.stats.length * 38)}>
                    <BarChart data={complaintsRes.stats} layout="vertical" margin={{ left: 5, right: 20, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                      <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                        width={140}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]}>
                        {complaintsRes.stats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PRESET_COLORS[index % PRESET_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                // Clean Top 5 list
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getTop5WithOthers(complaintsRes.stats)} layout="vertical" margin={{ left: 5, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                    <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      width={140}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]}>
                      {getTop5WithOthers(complaintsRes.stats).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PRESET_COLORS[index % PRESET_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No complaint data</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
