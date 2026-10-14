import React, { useState, useEffect, useMemo } from 'react';
import { subMonths, format } from 'date-fns';
import {
  PhoneCall,
  UserCheck,
  UserPlus,
  Users,
  AlertCircle,
  Download,
  LayoutGrid,
  Table as TableIcon,
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TimelineSwitch, getPeriodForTimelineRange } from '@/components/analytics/TimelineSwitch';
import analyticsApi from '@/api/analytics';
import { exportChartAsSvg } from '@/utils/chartExport';

const PIE_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b'];

// Helper Table View for Distribution Data
function DataTable({ data, labelHeader = "Category", valueHeader = "Count" }) {
  const total = useMemo(() => data.reduce((acc, curr) => acc + (curr.value || curr.sessions || curr.count || 0), 0), [data]);

  return (
    <div className="overflow-x-auto border border-border rounded-lg max-h-[260px] overflow-y-auto">
      <table className="w-full text-xs text-left">
        <thead className="bg-muted/50 text-muted-foreground uppercase font-semibold sticky top-0 bg-background border-b border-border">
          <tr>
            <th className="px-4 py-2">{labelHeader}</th>
            <th className="px-4 py-2 text-right">{valueHeader}</th>
            <th className="px-4 py-2 text-right">Percentage</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                No data available
              </td>
            </tr>
          ) : (
            data.map((row, idx) => {
              const val = row.value ?? row.sessions ?? row.count ?? 0;
              const label = row.name || row.label || 'Other';
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
              return (
                <tr key={idx} className="hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-2 font-medium text-foreground">{label}</td>
                  <td className="px-4 py-2 text-right font-semibold">{val.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">
                    <div className="flex items-center justify-end gap-2">
                      <span>{pct}%</span>
                      <div className="w-12 bg-muted rounded-full h-1.5 overflow-hidden">
                        <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export function TelemedicineAnalyticsView() {
  // Global Patient Filter
  const [patientStatus, setPatientStatus] = useState('all');

  // Card 1: Trend
  const [trendRange, setTrendRange] = useState('1M');
  const [trendDateRange, setTrendDateRange] = useState({ from: subMonths(new Date(), 1), to: new Date() });
  const [trendView, setTrendView] = useState('graph');

  // Card 2: Consultation Type
  const [cTypeRange, setCTypeRange] = useState('1M');
  const [cTypeDateRange, setCTypeDateRange] = useState({ from: subMonths(new Date(), 1), to: new Date() });
  const [cTypeView, setCTypeView] = useState('graph');

  // Card 3: Call Purpose
  const [callTypeRange, setCallTypeRange] = useState('1M');
  const [callTypeDateRange, setCallTypeDateRange] = useState({ from: subMonths(new Date(), 1), to: new Date() });
  const [callTypeView, setCallTypeView] = useState('graph');

  // Card 4: Who Answered
  const [whoAnsRange, setWhoAnsRange] = useState('1M');
  const [whoAnsDateRange, setWhoAnsDateRange] = useState({ from: subMonths(new Date(), 1), to: new Date() });
  const [whoAnsView, setWhoAnsView] = useState('graph');

  // Card 5: Call Severity
  const [sevRange, setSevRange] = useState('1M');
  const [sevDateRange, setSevDateRange] = useState({ from: subMonths(new Date(), 1), to: new Date() });
  const [sevView, setSevView] = useState('graph');

  // Card 6: Call Direction
  const [dirRange, setDirRange] = useState('1M');
  const [dirDateRange, setDirDateRange] = useState({ from: subMonths(new Date(), 1), to: new Date() });
  const [dirView, setDirView] = useState('graph');

  // Data states
  const [mainData, setMainData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch summary & breakdowns
  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const reqPeriod = getPeriodForTimelineRange(trendRange);
        const res = await analyticsApi.getTelemedicineSummary({
          start_date: format(trendDateRange.from, 'yyyy-MM-dd'),
          end_date: format(trendDateRange.to, 'yyyy-MM-dd'),
          period: reqPeriod,
          patient_status: patientStatus,
        });
        if (active) setMainData(res);
      } catch (err) {
        console.error('Error fetching telemedicine summary:', err);
        if (active) setError('Failed to load telemedicine analytics.');
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    return () => { active = false; };
  }, [trendDateRange, trendRange, patientStatus]);

  const summary = mainData?.summary || {};
  const timelineData = useMemo(() => {
    if (!mainData?.timeline) return [];
    return (mainData.timeline.labels || []).map((label, idx) => ({
      label,
      sessions: mainData.timeline.data[idx] || 0,
    }));
  }, [mainData]);

  const consultationTypeData = mainData?.consultation_type_breakdown || [];
  const callTypeData = mainData?.call_type_breakdown || [];
  const callDirectionData = mainData?.call_direction_breakdown || [];
  const whoAnsweredData = mainData?.who_answered_breakdown || [];
  const severityData = mainData?.severity_breakdown || [];

  return (
    <div className="space-y-6">
      {/* Top Bar / Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Telemedicine & Teleconsult Analytics</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Insights on teleconsultation calls, SOP documentation forms, provider roles, and call purposes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Patient Status Filter */}
          <Select value={patientStatus} onValueChange={setPatientStatus}>
            <SelectTrigger className="w-[160px] h-9 text-xs font-semibold">
              <SelectValue placeholder="Patient Care Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Care Statuses</SelectItem>
              <SelectItem value="active">Active Care</SelectItem>
              <SelectItem value="inactive">Inactive Care</SelectItem>
              <SelectItem value="deceased">Deceased</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Headline Stat Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="transition-all hover:shadow-md">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Teleconsults</p>
              <h3 className="text-2xl font-bold mt-1">
                {loading ? <Skeleton className="h-8 w-16" /> : (summary.total_teleconsults ?? 0).toLocaleString()}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1">Calls & documentation forms</p>
            </div>
            <div className="p-3 bg-primary/10 text-primary rounded-xl">
              <PhoneCall className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="transition-all hover:shadow-md">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Nurse Consultations</p>
              <h3 className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                {loading ? <Skeleton className="h-8 w-16" /> : (summary.nurse_consults ?? 0).toLocaleString()}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1">Nurse-led phone calls</p>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
              <UserCheck className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="transition-all hover:shadow-md">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Doctor Consultations</p>
              <h3 className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
                {loading ? <Skeleton className="h-8 w-16" /> : (summary.doctor_consults ?? 0).toLocaleString()}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1">Physician specialist calls</p>
            </div>
            <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl">
              <UserPlus className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="transition-all hover:shadow-md">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Other Support Consults</p>
              <h3 className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
                {loading ? <Skeleton className="h-8 w-16" /> : ((summary.counsellor_consults || 0) + (summary.physio_consults || 0) + (summary.other_consults || 0)).toLocaleString()}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1">Counsellors & Physio</p>
            </div>
            <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Teleconsultations Over Time */}
        <Card id="telemedicine-trend-chart" className="col-span-1 lg:col-span-2 transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 flex-wrap gap-2">
            <div>
              <CardTitle className="text-base font-bold">Teleconsultation Sessions Over Time</CardTitle>
              <p className="text-xs text-muted-foreground">Aggregated trend based on selected timeline filter</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-md border border-input bg-background p-0.5">
                <Button
                  variant={trendView === 'graph' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setTrendView('graph')}
                  title="Graph View"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={trendView === 'table' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setTrendView('table')}
                  title="Table View"
                >
                  <TableIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
              <TimelineSwitch
                value={trendRange}
                onChange={(r, dr) => {
                  setTrendRange(r);
                  setTrendDateRange(dr);
                }}
              />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => exportChartAsSvg('telemedicine-trend-chart', 'teleconsult-trend.svg')}
                title="Download Chart SVG"
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : trendView === 'table' ? (
              <DataTable data={timelineData} labelHeader="Timeline Period" valueHeader="Sessions" />
            ) : timelineData.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                No teleconsultation records found for this period.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={timelineData}>
                  <defs>
                    <linearGradient id="teleGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="sessions"
                    name="Sessions"
                    stroke="#0ea5e9"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#teleGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Consultation Type (Nurse vs Doctor vs Counsellor vs Physio) */}
        <Card id="consultation-type-chart" className="transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 flex-wrap gap-2">
            <div>
              <CardTitle className="text-base font-bold">Consultation Type (By Role)</CardTitle>
              <p className="text-xs text-muted-foreground">Breakdown by healthcare practitioner role</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-md border border-input bg-background p-0.5">
                <Button
                  variant={cTypeView === 'graph' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setCTypeView('graph')}
                  title="Graph View"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={cTypeView === 'table' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setCTypeView('table')}
                  title="Table View"
                >
                  <TableIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
              <TimelineSwitch
                value={cTypeRange}
                onChange={(r, dr) => {
                  setCTypeRange(r);
                  setCTypeDateRange(dr);
                }}
              />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => exportChartAsSvg('consultation-type-chart', 'consultation-types.svg')}
                title="Download Chart SVG"
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : cTypeView === 'table' ? (
              <DataTable data={consultationTypeData} labelHeader="Practitioner Role" valueHeader="Consultations" />
            ) : consultationTypeData.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
                No consultation type data available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={consultationTypeData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="value" name="Consultations" fill="#10b981" radius={[0, 4, 4, 0]}>
                    {consultationTypeData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Call Purpose / Category (Follow-up vs Condolence vs Bereavement) */}
        <Card id="call-type-chart" className="transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 flex-wrap gap-2">
            <div>
              <CardTitle className="text-base font-bold">Call Purpose / Category</CardTitle>
              <p className="text-xs text-muted-foreground">Distribution by follow-up, condolence, or bereavement</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-md border border-input bg-background p-0.5">
                <Button
                  variant={callTypeView === 'graph' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setCallTypeView('graph')}
                  title="Graph View"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={callTypeView === 'table' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setCallTypeView('table')}
                  title="Table View"
                >
                  <TableIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
              <TimelineSwitch
                value={callTypeRange}
                onChange={(r, dr) => {
                  setCallTypeRange(r);
                  setCallTypeDateRange(dr);
                }}
              />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => exportChartAsSvg('call-type-chart', 'call-purpose.svg')}
                title="Download Chart SVG"
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : callTypeView === 'table' ? (
              <DataTable data={callTypeData} labelHeader="Call Purpose" valueHeader="Calls" />
            ) : callTypeData.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
                No call type data available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={callTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {callTypeData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Card 4: Who Answered the Call */}
        <Card id="who-answered-chart" className="transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 flex-wrap gap-2">
            <div>
              <CardTitle className="text-base font-bold">Who Answered the Call</CardTitle>
              <p className="text-xs text-muted-foreground">Patient vs Primary Caregiver vs Decision Maker</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-md border border-input bg-background p-0.5">
                <Button
                  variant={whoAnsView === 'graph' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setWhoAnsView('graph')}
                  title="Graph View"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={whoAnsView === 'table' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setWhoAnsView('table')}
                  title="Table View"
                >
                  <TableIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
              <TimelineSwitch
                value={whoAnsRange}
                onChange={(r, dr) => {
                  setWhoAnsRange(r);
                  setWhoAnsDateRange(dr);
                }}
              />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => exportChartAsSvg('who-answered-chart', 'who-answered.svg')}
                title="Download Chart SVG"
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : whoAnsView === 'table' ? (
              <DataTable data={whoAnsweredData} labelHeader="Recipient Role" valueHeader="Calls" />
            ) : whoAnsweredData.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
                No recipient data available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={whoAnsweredData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Calls" fill="#0ea5e9" radius={[4, 4, 0, 0]}>
                    {whoAnsweredData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[(index + 2) % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Card 5: Call Severity */}
        <Card id="call-severity-chart" className="transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 flex-wrap gap-2">
            <div>
              <CardTitle className="text-base font-bold">Call Severity Distribution</CardTitle>
              <p className="text-xs text-muted-foreground">Clinical severity rating recorded during teleconsult</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-md border border-input bg-background p-0.5">
                <Button
                  variant={sevView === 'graph' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setSevView('graph')}
                  title="Graph View"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={sevView === 'table' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setSevView('table')}
                  title="Table View"
                >
                  <TableIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
              <TimelineSwitch
                value={sevRange}
                onChange={(r, dr) => {
                  setSevRange(r);
                  setSevDateRange(dr);
                }}
              />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => exportChartAsSvg('call-severity-chart', 'call-severity.svg')}
                title="Download Chart SVG"
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : sevView === 'table' ? (
              <DataTable data={severityData} labelHeader="Severity Rating" valueHeader="Calls" />
            ) : severityData.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
                No severity data available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={severityData}
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {severityData.map((entry) => {
                      const color =
                        entry.name.toLowerCase() === 'high'
                          ? '#ef4444'
                          : entry.name.toLowerCase() === 'medium'
                          ? '#f59e0b'
                          : '#10b981';
                      return <Cell key={entry.name} fill={color} />;
                    })}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Card 6: Call Direction (Incoming vs Outgoing) */}
        <Card id="call-direction-chart" className="transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 flex-wrap gap-2">
            <div>
              <CardTitle className="text-base font-bold">Call Direction</CardTitle>
              <p className="text-xs text-muted-foreground">Incoming vs Outgoing call orientation</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-md border border-input bg-background p-0.5">
                <Button
                  variant={dirView === 'graph' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setDirView('graph')}
                  title="Graph View"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={dirView === 'table' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setDirView('table')}
                  title="Table View"
                >
                  <TableIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
              <TimelineSwitch
                value={dirRange}
                onChange={(r, dr) => {
                  setDirRange(r);
                  setDirDateRange(dr);
                }}
              />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => exportChartAsSvg('call-direction-chart', 'call-direction.svg')}
                title="Download Chart SVG"
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : dirView === 'table' ? (
              <DataTable data={callDirectionData} labelHeader="Call Direction" valueHeader="Calls" />
            ) : callDirectionData.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
                No call direction data available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={callDirectionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {callDirectionData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[(index + 3) % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default TelemedicineAnalyticsView;
