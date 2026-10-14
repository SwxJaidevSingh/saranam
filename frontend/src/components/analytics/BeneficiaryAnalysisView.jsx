import { useState, useEffect, useMemo } from 'react';
import { TimelineSwitch } from './TimelineSwitch';
import { ChartCard } from './ChartCard';
import { StatCard } from './StatCard';
import { Users, UserPlus, HeartPulse, Table, Activity } from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import analyticsApi from '@/api/analytics';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

const CHART_COLORS = {
  primary: '#0ea5e9',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  indigo: '#6366f1',
  slate: '#64748b',
  colors: ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#6366f1', '#14b8a6']
};

export function BeneficiaryAnalysisView() {
  const [timelineRange, setTimelineRange] = useState('1M');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [livingStatus, setLivingStatus] = useState('all');
  const [patientStatus, setPatientStatus] = useState('all');

  // View switchers for the 3 charts
  const [growthView, setGrowthView] = useState('graph');
  const [relationsView, setRelationsView] = useState('graph');
  const [conditionsView, setConditionsView] = useState('graph');

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        setLoading(true);
        let days = 30;
        if (timelineRange === '1D') days = 1;
        else if (timelineRange === '5D') days = 5;
        else if (timelineRange === '1M') days = 30;
        else if (timelineRange === '6M') days = 180;
        else if (timelineRange === 'YTD') {
          const startOfYear = new Date(new Date().getFullYear(), 0, 1);
          days = Math.max(1, Math.round((new Date() - startOfYear) / (1000 * 60 * 60 * 24)));
        }
        else if (timelineRange === '1Y') days = 365;
        else if (timelineRange === '5Y') days = 1825;
        else if (timelineRange === 'Max') days = 3650;

        const end_date = new Date().toISOString().split('T')[0];
        const start_date = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const reqPeriod = ['5Y', 'Max'].includes(timelineRange)
          ? 'yearly'
          : ['1D', '5D', '1M'].includes(timelineRange)
          ? 'daily'
          : 'monthly'; // 6M, 1Y, YTD
        const res = await analyticsApi.getBeneficiaryStats({
          start_date,
          end_date,
          living_status: livingStatus !== 'all' ? livingStatus : undefined,
          patient_status: patientStatus !== 'all' ? patientStatus : undefined,
          period: reqPeriod
        });
        if (!cancelled) setData(res);
      } catch (err) {
        console.error('Error fetching beneficiary stats:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [timelineRange, livingStatus, patientStatus]);

  // Transform relationships for pie chart
  const relationshipsData = useMemo(() => {
    if (!data?.relationships) return [];
    return data.relationships
      .filter(item => item.name && item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 7); // top 7
  }, [data]);

  // Transform conditions for bar chart
  const conditionsData = useMemo(() => {
    if (!data?.conditions) return [];
    return data.conditions
      .filter(item => item.name && item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // top 8
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Overview StatCards */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Total Registered Patients"
          value={data?.total_patients ?? 0}
          Icon={Users}
          iconColor="text-blue-500"
          iconBgColor="bg-blue-50"
          isLoading={loading}
        />
        <StatCard
          title="Family Dependents Supported"
          value={data?.total_dependents ?? 0}
          valueDescription="From family chart & genogram"
          Icon={UserPlus}
          iconColor="text-emerald-500"
          iconBgColor="bg-emerald-50"
          isLoading={loading}
        />
        <StatCard
          title="Total Beneficiaries"
          value={data?.total_beneficiaries ?? 0}
          valueDescription="Total lives impacted"
          Icon={Activity}
          iconColor="text-amber-500"
          iconBgColor="bg-amber-50"
          isLoading={loading}
        />
      </div>

      {/* Main Growth Timeline Card */}
      <ChartCard
        title="Beneficiary Growth Trends"
        description={
          (growthView === 'graph' ? "Comparison of new patient registrations vs. new family dependents added" :
            `Tabular breakdown of beneficiaries added by ${
              ['5Y','Max'].includes(timelineRange) ? 'year' :
              ['1D','5D','1M'].includes(timelineRange) ? 'day' : 'month'
            }`) +
          (livingStatus !== 'all' ? " (Note: Cohabitation filters apply only to Family Chart records, not Genogram diagrams)" : "")
        }
        isLoading={loading}
        headerAction={
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={patientStatus} onValueChange={setPatientStatus}>
              <SelectTrigger className="w-[130px] h-8 text-xs font-semibold bg-background border-border">
                <SelectValue placeholder="Patient Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                <SelectItem value="alive_active" className="text-xs">Alive & Active</SelectItem>
                <SelectItem value="inactive" className="text-xs">Alive & Inactive</SelectItem>
                <SelectItem value="dead" className="text-xs">Deceased</SelectItem>
              </SelectContent>
            </Select>
            <Select value={livingStatus} onValueChange={setLivingStatus}>
              <SelectTrigger className="w-[195px] h-8 text-xs font-semibold bg-background border-border">
                <SelectValue placeholder="Living Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Dependents</SelectItem>
                <SelectItem value="yes" className="text-xs">Living with Patient (Family Chart)</SelectItem>
                <SelectItem value="no" className="text-xs">Not Living with Patient (Family Chart)</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex border border-border rounded-lg p-0.5 bg-muted/40">
              <button
                onClick={() => setGrowthView('graph')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${growthView === 'graph' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Graph
              </button>
              <button
                onClick={() => setGrowthView('table')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${growthView === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Table
              </button>
            </div>
            <TimelineSwitch
              value={timelineRange}
              onChange={(val) => setTimelineRange(val)}
            />
          </div>
        }
      >
        {growthView === 'graph' ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data?.timeline || []} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis allowDecimals={false} className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  padding: '8px 12px'
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="new_patients"
                stroke={CHART_COLORS.primary}
                strokeWidth={2.5}
                name="Patients Added"
                dot={{ r: 3, fill: CHART_COLORS.primary }}
              />
              <Line
                type="monotone"
                dataKey="new_dependents"
                stroke={CHART_COLORS.success}
                strokeWidth={2.5}
                name="Dependents Added"
                dot={{ r: 3, fill: CHART_COLORS.success }}
              />
              <Line
                type="monotone"
                dataKey="total_beneficiaries"
                stroke={CHART_COLORS.warning}
                strokeWidth={2.5}
                name="Total Beneficiaries Added"
                dot={{ r: 3, fill: CHART_COLORS.warning }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] overflow-y-auto border border-border rounded-lg bg-card custom-scrollbar">
            <table className="min-w-full divide-y divide-border text-xs text-left">
              <thead className="bg-muted/50 sticky top-0 backdrop-blur-sm z-10">
                <tr>
                  <th className="p-3 font-semibold text-muted-foreground">
                    Period ({['5Y','Max'].includes(timelineRange) ? 'Year' : ['1D','5D','1M'].includes(timelineRange) ? 'Day' : 'Month'})
                  </th>
                  <th className="p-3 font-semibold text-muted-foreground text-right">Patients Added</th>
                  <th className="p-3 font-semibold text-muted-foreground text-right">Dependents Added</th>
                  <th className="p-3 font-semibold text-muted-foreground text-right">Total Impacted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(!data?.timeline || data.timeline.length === 0) ? (
                  <tr>
                    <td colSpan={4} className="p-3 text-center text-muted-foreground">No data available</td>
                  </tr>
                ) : (
                  data.timeline.map((item, idx) => (
                    <tr key={idx} className="hover:bg-muted/10 transition-colors">
                      <td className="p-3 font-medium text-foreground">{item.month}</td>
                      <td className="p-3 text-right font-mono text-foreground">{item.new_patients}</td>
                      <td className="p-3 text-right font-mono text-foreground">{item.new_dependents}</td>
                      <td className="p-3 text-right font-mono font-semibold text-foreground">{item.total_beneficiaries}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>

      {/* Row 2 — Dependents Split & Health Conditions */}
      {false && (
      <div className="grid gap-6 md:grid-cols-2">
        {/* Relationship Breakdown */}
        <ChartCard
          title="Family Relationships"
          description="Support circle relationship distribution of family dependents"
          isLoading={loading}
          headerAction={
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={patientStatus} onValueChange={setPatientStatus}>
                <SelectTrigger className="w-[130px] h-8 text-xs font-semibold bg-background border-border">
                  <SelectValue placeholder="Patient Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                  <SelectItem value="alive_active" className="text-xs">Alive & Active</SelectItem>
                  <SelectItem value="inactive" className="text-xs">Alive & Inactive</SelectItem>
                  <SelectItem value="dead" className="text-xs">Deceased</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex border border-border rounded-lg p-0.5 bg-muted/40">
                <button
                  onClick={() => setRelationsView('graph')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${relationsView === 'graph' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Graph
                </button>
                <button
                  onClick={() => setRelationsView('table')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${relationsView === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Table
                </button>
              </div>
            </div>
          }
        >
          {relationsView === 'graph' ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
                <Pie
                  data={relationshipsData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  innerRadius={55}
                  paddingAngle={3}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={true}
                >
                  {relationshipsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS.colors[index % CHART_COLORS.colors.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] overflow-y-auto border border-border rounded-lg bg-card custom-scrollbar">
              <table className="min-w-full divide-y divide-border text-xs text-left">
                <thead className="bg-muted/50 sticky top-0 backdrop-blur-sm z-10">
                  <tr>
                    <th className="p-3 font-semibold text-muted-foreground">Relationship</th>
                    <th className="p-3 font-semibold text-muted-foreground text-right">Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {relationshipsData.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="p-3 text-center text-muted-foreground">No relationships recorded</td>
                    </tr>
                  ) : (
                    relationshipsData.map((item, idx) => (
                      <tr key={idx} className="hover:bg-muted/10 transition-colors">
                        <td className="p-3 font-medium text-foreground">{item.name}</td>
                        <td className="p-3 text-right font-mono text-foreground font-semibold">{item.value}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>

        {/* Genogram Conditions / Burden of Care */}
        <ChartCard
          title="Care Circle Burden & Genetic Risk"
          description="Condition tags tracked on the family genogram symbols"
          isLoading={loading}
          headerAction={
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={patientStatus} onValueChange={setPatientStatus}>
                <SelectTrigger className="w-[130px] h-8 text-xs font-semibold bg-background border-border">
                  <SelectValue placeholder="Patient Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                  <SelectItem value="alive_active" className="text-xs">Alive & Active</SelectItem>
                  <SelectItem value="inactive" className="text-xs">Alive & Inactive</SelectItem>
                  <SelectItem value="dead" className="text-xs">Deceased</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex border border-border rounded-lg p-0.5 bg-muted/40">
                <button
                  onClick={() => setConditionsView('graph')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${conditionsView === 'graph' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Graph
                </button>
                <button
                  onClick={() => setConditionsView('table')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${conditionsView === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Table
                </button>
              </div>
            </div>
          }
        >
          {conditionsView === 'graph' ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={conditionsData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis allowDecimals={false} className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <RechartsTooltip />
                <Bar dataKey="value" name="Dependents" fill={CHART_COLORS.purple} radius={[4, 4, 0, 0]}>
                  {conditionsData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={CHART_COLORS.colors[(idx + 2) % CHART_COLORS.colors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] overflow-y-auto border border-border rounded-lg bg-card custom-scrollbar">
              <table className="min-w-full divide-y divide-border text-xs text-left">
                <thead className="bg-muted/50 sticky top-0 backdrop-blur-sm z-10">
                  <tr>
                    <th className="p-3 font-semibold text-muted-foreground">Condition Tag</th>
                    <th className="p-3 font-semibold text-muted-foreground text-right">Family Members Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {conditionsData.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="p-3 text-center text-muted-foreground">No conditions recorded in genogram</td>
                    </tr>
                  ) : (
                    conditionsData.map((item, idx) => (
                      <tr key={idx} className="hover:bg-muted/10 transition-colors">
                        <td className="p-3 font-medium text-foreground">{item.name}</td>
                        <td className="p-3 text-right font-mono text-foreground font-semibold">{item.value}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>
      </div>
      )
}
    </div>
  );
}
