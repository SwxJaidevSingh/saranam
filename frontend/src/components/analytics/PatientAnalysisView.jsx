import { useState, useEffect, useMemo } from 'react';
import { subMonths } from 'date-fns';
import { TimelineSwitch } from './TimelineSwitch';
import {
  Users,
  UserPlus,
  Activity,
  FileText,
  Bell,
  HeartOff,
  HeartPulse,
  Table,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import { StatCard } from './StatCard';
import { ChartCard } from './ChartCard';
import { VitalsAnalysisView } from './VitalsAnalysisView';
import { VisitAnalysisView } from './VisitAnalysisView';
import { BeneficiaryAnalysisView } from './BeneficiaryAnalysisView';
import { ViewSwitcher } from './ViewSwitcher';
import DeceasedPatientsMap from './DeceasedPatientsMap';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import PatientAgeMap from './PatientAgeMap';
import PatientGenderMap from './PatientGenderMap';
import PatientLocationsMap from './PatientLocationsMap';
import analyticsApi from '@/api/analytics';

import { LayoutGrid, Map } from 'lucide-react';

const DemographicsViewSwitcher = ({ activeView, onViewChange, className }) => {
  return (
    <div className={`inline-flex items-center p-1 bg-muted/60 backdrop-blur-sm rounded-lg border border-border/60 shadow-sm ${className || ''}`}>
      <button
        onClick={() => onViewChange('graph')}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
          activeView === 'graph'
            ? "bg-background text-foreground shadow-sm scale-100"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
        }`}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        <span>Graph</span>
      </button>
      <button
        onClick={() => onViewChange('table')}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
          activeView === 'table'
            ? "bg-background text-foreground shadow-sm scale-100"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
        }`}
      >
        <Table className="h-3.5 w-3.5" />
        <span>Table</span>
      </button>
      <button
        onClick={() => onViewChange('map')}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
          activeView === 'map'
            ? "bg-background text-foreground shadow-sm scale-100"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
        }`}
      >
        <Map className="h-3.5 w-3.5" />
        <span>Map</span>
      </button>
    </div>
  );
};

const AgeDistributionTable = ({ data = [] }) => (
  <div className="h-[340px] overflow-y-auto border border-border rounded-lg bg-card custom-scrollbar">
    <table className="min-w-full divide-y divide-border text-xs text-left">
      <thead className="bg-muted/50 sticky top-0 backdrop-blur-sm z-10">
        <tr>
          <th className="p-3 font-semibold text-muted-foreground">Age Group</th>
          <th className="p-3 font-semibold text-muted-foreground text-right">Patients</th>
          <th className="p-3 font-semibold text-muted-foreground text-right">Percentage</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {data.length === 0 ? (
          <tr>
            <td colSpan={3} className="p-3 text-center text-muted-foreground">No data available</td>
          </tr>
        ) : (
          data.map((item, idx) => (
            <tr key={idx} className="hover:bg-muted/10 transition-colors">
              <td className="p-3 font-medium text-foreground">{item.ageGroup}</td>
              <td className="p-3 text-right font-mono text-foreground">{item.count}</td>
              <td className="p-3 text-right font-mono text-muted-foreground">{item.percentage}%</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

const GenderDistributionTable = ({ data = [] }) => (
  <div className="h-[300px] overflow-y-auto border border-border rounded-lg bg-card custom-scrollbar">
    <table className="min-w-full divide-y divide-border text-xs text-left">
      <thead className="bg-muted/50 sticky top-0 backdrop-blur-sm z-10">
        <tr>
          <th className="p-3 font-semibold text-muted-foreground">Gender</th>
          <th className="p-3 font-semibold text-muted-foreground text-right">Patients</th>
          <th className="p-3 font-semibold text-muted-foreground text-right">Percentage</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {data.length === 0 ? (
          <tr>
            <td colSpan={3} className="p-3 text-center text-muted-foreground">No data available</td>
          </tr>
        ) : (
          data.map((item, idx) => (
            <tr key={idx} className="hover:bg-muted/10 transition-colors">
              <td className="p-3 font-medium text-foreground">{item.name}</td>
              <td className="p-3 text-right font-mono text-foreground">{item.value}</td>
              <td className="p-3 text-right font-mono text-muted-foreground">{item.percentage}%</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

const RegistrationTrendsTable = ({ data = [] }) => (
  <div className="h-[300px] overflow-y-auto border border-border rounded-lg bg-card custom-scrollbar">
    <table className="min-w-full divide-y divide-border text-xs text-left">
      <thead className="bg-muted/50 sticky top-0 backdrop-blur-sm z-10">
        <tr>
          <th className="p-3 font-semibold text-muted-foreground">Period</th>
          <th className="p-3 font-semibold text-muted-foreground text-right">Child & Adolescent</th>
          <th className="p-3 font-semibold text-muted-foreground text-right">Adults</th>
          <th className="p-3 font-semibold text-muted-foreground text-right">Older Adults</th>
          <th className="p-3 font-semibold text-muted-foreground text-right">Unknown Age</th>
          <th className="p-3 font-semibold text-muted-foreground text-right">Total</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {data.length === 0 ? (
          <tr>
            <td colSpan={6} className="p-3 text-center text-muted-foreground">No data available</td>
          </tr>
        ) : (
          data.map((item, idx) => (
            <tr key={idx} className="hover:bg-muted/10 transition-colors">
              <td className="p-3 font-medium text-foreground">{item.month}</td>
              <td className="p-3 text-right font-mono text-foreground">{item.child_adolescent}</td>
              <td className="p-3 text-right font-mono text-foreground">{item.adults}</td>
              <td className="p-3 text-right font-mono text-foreground">{item.older_adults}</td>
              <td className="p-3 text-right font-mono text-muted-foreground">{item.unknown}</td>
              <td className="p-3 text-right font-mono font-semibold text-foreground">{item.count}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

const DeathsTrendsTable = ({ data = [] }) => (
  <div className="h-[280px] overflow-y-auto border border-border rounded-lg bg-card custom-scrollbar">
    <table className="min-w-full divide-y divide-border text-xs text-left">
      <thead className="bg-muted/50 sticky top-0 backdrop-blur-sm z-10">
        <tr>
          <th className="p-3 font-semibold text-muted-foreground">Period</th>
          <th className="p-3 font-semibold text-muted-foreground text-right">Child & Adolescent</th>
          <th className="p-3 font-semibold text-muted-foreground text-right">Adults</th>
          <th className="p-3 font-semibold text-muted-foreground text-right">Older Adults</th>
          <th className="p-3 font-semibold text-muted-foreground text-right">Unknown Age</th>
          <th className="p-3 font-semibold text-muted-foreground text-right">Total</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {data.length === 0 ? (
          <tr>
            <td colSpan={6} className="p-3 text-center text-muted-foreground">No data available</td>
          </tr>
        ) : (
          data.map((item, idx) => (
            <tr key={idx} className="hover:bg-muted/10 transition-colors">
              <td className="p-3 font-medium text-foreground">{item.month}</td>
              <td className="p-3 text-right font-mono text-foreground">{item.child_adolescent || 0}</td>
              <td className="p-3 text-right font-mono text-foreground">{item.adults || 0}</td>
              <td className="p-3 text-right font-mono text-foreground">{item.older_adults || 0}</td>
              <td className="p-3 text-right font-mono text-muted-foreground">{item.unknown || 0}</td>
              <td className="p-3 text-right font-mono font-semibold text-foreground">{item.count || 0}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

const CHART_COLORS = {
  primary: '#0ea5e9',
  secondary: '#d946ef',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#9c27b0',
  gradient: ['#0ea5e9', '#d946ef', '#22c55e', '#f59e0b', '#ef4444']
};

export function PatientAnalysisView({ data, loading }) {
  const { summary } = data || {};

  // Deaths Timeline Local States
  const [deathsTimelineRange, setDeathsTimelineRange] = useState('1M');
  const [deathsData, setDeathsData] = useState(null);
  const [deathsLoading, setDeathsLoading] = useState(true);
  const [deathsView, setDeathsView] = useState('graph');
  const [deathsPatientStatus, setDeathsPatientStatus] = useState('all');
  const [deathsInitialVisitStatus, setDeathsInitialVisitStatus] = useState('all');

  // Age Distribution Local States (Default 1M)
  const [ageTimelineRange, setAgeTimelineRange] = useState('1M');
  const [ageDateRange, setAgeDateRange] = useState({
    from: subMonths(new Date(), 1),
    to: new Date()
  });
  const [localAgeDistribution, setLocalAgeDistribution] = useState([]);
  const [ageLoading, setAgeLoading] = useState(true);
  const [ageView, setAgeView] = useState('graph');
  const [agePatientStatus, setAgePatientStatus] = useState('all');

  // Gender Distribution Local States (Default 1M)
  const [genderTimelineRange, setGenderTimelineRange] = useState('1M');
  const [genderDateRange, setGenderDateRange] = useState({
    from: subMonths(new Date(), 1),
    to: new Date()
  });
  const [localGenderDistribution, setLocalGenderDistribution] = useState([]);
  const [genderLoading, setGenderLoading] = useState(true);
  const [genderView, setGenderView] = useState('graph');
  const [genderPatientStatus, setGenderPatientStatus] = useState('all');
  const [genderAgeGroup, setGenderAgeGroup] = useState('all');

  // Registration Trends Local States (Default 1M)
  const [regTimelineRange, setRegTimelineRange] = useState('1M');
  const [regDateRange, setRegDateRange] = useState({
    from: subMonths(new Date(), 1),
    to: new Date()
  });
  const [localRegistrationTrends, setLocalRegistrationTrends] = useState([]);
  const [regLoading, setRegLoading] = useState(true);
  const [registrationView, setRegistrationView] = useState('graph');
  const [regPatientStatus, setRegPatientStatus] = useState('all');

  // 1. Fetch Deaths Impact dynamically
  useEffect(() => {
    let cancelled = false;
    const fetchDeaths = async () => {
      try {
        setDeathsLoading(true);
        let days = 30;
        if (deathsTimelineRange === '1D') days = 1;
        else if (deathsTimelineRange === '5D') days = 5;
        else if (deathsTimelineRange === '1M') days = 30;
        else if (deathsTimelineRange === '6M') days = 180;
        else if (deathsTimelineRange === 'YTD') {
          const startOfYear = new Date(new Date().getFullYear(), 0, 1);
          days = Math.max(1, Math.round((new Date() - startOfYear) / (1000 * 60 * 60 * 24)));
        }
        else if (deathsTimelineRange === '1Y') days = 365;
        else if (deathsTimelineRange === '5Y') days = 1825;
        else if (deathsTimelineRange === 'Max') days = 3650;

        const res = await analyticsApi.getDeathsImpact(days, {
          patient_status: deathsPatientStatus !== 'all' ? deathsPatientStatus : undefined,
          initial_visit_status: deathsInitialVisitStatus !== 'all' ? deathsInitialVisitStatus : undefined
        });
        if (!cancelled) setDeathsData(res);
      } catch (err) {
        console.error('Error fetching deaths impact:', err);
      } finally {
        if (!cancelled) setDeathsLoading(false);
      }
    };
    fetchDeaths();
    return () => { cancelled = true; };
  }, [deathsTimelineRange, deathsPatientStatus, deathsInitialVisitStatus]);

  // 2. Fetch Age demographics dynamically
  useEffect(() => {
    let cancelled = false;
    const fetchAge = async () => {
      try {
        setAgeLoading(true);
        const data = await analyticsApi.getDashboard({
          start_date: ageDateRange.from.toISOString(),
          end_date: ageDateRange.to.toISOString(),
          filters: JSON.stringify({
            patient_status: agePatientStatus !== 'all' ? agePatientStatus : undefined
          })
        });
        if (!cancelled) {
          setLocalAgeDistribution(data?.demographics?.age_distribution || []);
        }
      } catch (err) {
        console.error('Error fetching age demographics:', err);
      } finally {
        if (!cancelled) setAgeLoading(false);
      }
    };
    fetchAge();
    return () => { cancelled = true; };
  }, [ageDateRange, agePatientStatus]);

  // 3. Fetch Gender demographics dynamically
  useEffect(() => {
    let cancelled = false;
    const fetchGender = async () => {
      try {
        setGenderLoading(true);
        const data = await analyticsApi.getDashboard({
          start_date: genderDateRange.from.toISOString(),
          end_date: genderDateRange.to.toISOString(),
          filters: JSON.stringify({
            patient_status: genderPatientStatus !== 'all' ? genderPatientStatus : undefined,
            age_group: genderAgeGroup !== 'all' ? genderAgeGroup : undefined
          })
        });
        if (!cancelled) {
          setLocalGenderDistribution(data?.demographics?.gender_distribution || []);
        }
      } catch (err) {
        console.error('Error fetching gender demographics:', err);
      } finally {
        if (!cancelled) setGenderLoading(false);
      }
    };
    fetchGender();
    return () => { cancelled = true; };
  }, [genderDateRange, genderPatientStatus, genderAgeGroup]);

  // 4. Fetch Registration trends dynamically
  useEffect(() => {
    let cancelled = false;
    const fetchReg = async () => {
      try {
        setRegLoading(true);
        const data = await analyticsApi.getDashboard({
          start_date: regDateRange.from.toISOString(),
          end_date: regDateRange.to.toISOString(),
          filters: JSON.stringify({
            patient_status: regPatientStatus !== 'all' ? regPatientStatus : undefined
          })
        });
        if (!cancelled) {
          setLocalRegistrationTrends(data?.trends?.registration_over_time || []);
        }
      } catch (err) {
        console.error('Error fetching registration trends:', err);
      } finally {
        if (!cancelled) setRegLoading(false);
      }
    };
    fetchReg();
    return () => { cancelled = true; };
  }, [regDateRange, regPatientStatus]);

  // Format chart data.
  const ageChartData = useMemo(() => {
    return (localAgeDistribution || []).map((item) => {
      let label = item.range;
      if (item.min_age != null) {
        const ageText = item.max_age != null
          ? `${item.min_age}-${item.max_age}`
          : `${item.min_age}+`;
        label = `${item.range} (${ageText})`;
      }
      return {
        ageGroup: label,
        count: item.count,
        percentage: item.percentage,
      };
    });
  }, [localAgeDistribution]);

  const genderChartData = useMemo(() => {
    return (localGenderDistribution || []).map((item) => ({
      name: item.gender || 'Unknown',
      value: item.count,
      percentage: item.percentage,
    }));
  }, [localGenderDistribution]);

  const registrationChartData = useMemo(() => {
    return (localRegistrationTrends || []).map((item) => ({
      month: item.month,
      count: item.count,
      child_adolescent: item.child_adolescent || 0,
      adults: item.adults || 0,
      older_adults: item.older_adults || 0,
      unknown: item.unknown || 0,
    }));
  }, [localRegistrationTrends]);

  const deathsChartData = useMemo(() => {
    return (deathsData?.deaths_by_month || []).map((item) => ({
      month: item.month,
      count: item.count,
      child_adolescent: item.child_adolescent || 0,
      adults: item.adults || 0,
      older_adults: item.older_adults || 0,
      unknown: item.unknown || 0,
    }));
  }, [deathsData]);

  return (
    <div className="space-y-8">
      {/* Summary Stats Grid (Active Patients / Active Alerts removed 2026-04-11) */}
      <div className="grid gap-4 md:grid-cols-2">
        <StatCard
          title="Total Patients"
          value={summary?.total_patients?.toLocaleString() || '0'}
          icon={Users}
          iconColor="text-primary-600"
          iconBgColor="bg-primary-100"
          isLoading={loading}
        />
        <StatCard
          title="New Patients"
          value={summary?.new_patients?.toLocaleString() || '0'}
          icon={UserPlus}
          trend={summary?.growth_rate}
          trendLabel="vs last month"
          iconColor="text-success-600"
          iconBgColor="bg-success-100"
          isLoading={loading}
        />
        {/* Total Forms StatCard removed per user request
        <StatCard
          title="Total Forms"
          value={summary?.total_forms?.toLocaleString() || '0'}
          icon={FileText}
          iconColor="text-purple-600"
          iconBgColor="bg-purple-100"
          isLoading={loading}
        />
        */}
      </div>

      {/* Palliative Outcomes — replaces the improvement metrics removed 2026-04-07 */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Palliative Outcomes
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <StatCard
            title="Deaths"
            value={(deathsData?.deaths_in_window ?? 0).toLocaleString()}
            icon={HeartOff}
            trendLabel="Patients we cared for"
            iconColor="text-slate-600"
            iconBgColor="bg-slate-100"
            isLoading={deathsLoading}
          />
          <StatCard
            title="Avg Visits Before Death"
            value={(deathsData?.avg_visits_before_death ?? 0).toFixed(1)}
            icon={HeartPulse}
            trendLabel="Touchpoints per patient"
            iconColor="text-rose-600"
            iconBgColor="bg-rose-100"
            isLoading={deathsLoading}
          />
        </div>

        {/* Deaths Over Time */}
        <div className="mt-6">
          <ChartCard
            id={deathsView === 'graph' ? 'deaths-over-time-chart' : undefined}
            title="Deaths Over Time"
            description={deathsView === 'graph' ? "Monthly deaths in the selected range" : deathsView === 'table' ? "Tabular breakdown of patient deaths over time" : "Geospatial distribution of deceased patients"}
            isLoading={deathsLoading}
            headerAction={
              <div className="flex items-center gap-3 flex-wrap">
                <Select value={deathsPatientStatus} onValueChange={setDeathsPatientStatus}>
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
                <Select value={deathsInitialVisitStatus} onValueChange={setDeathsInitialVisitStatus}>
                  <SelectTrigger className="w-[165px] h-8 text-xs font-semibold bg-background border-border">
                    <SelectValue placeholder="Initial Visit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Visits</SelectItem>
                    <SelectItem value="completed" className="text-xs">Initial Visit Completed</SelectItem>
                    <SelectItem value="none" className="text-xs">No Initial Visit</SelectItem>
                  </SelectContent>
                </Select>
                <TimelineSwitch
                  value={deathsTimelineRange}
                  onChange={(val) => setDeathsTimelineRange(val)}
                />
                <DemographicsViewSwitcher
                  activeView={deathsView}
                  onViewChange={setDeathsView}
                />
              </div>
            }
          >
            {deathsView === 'graph' ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={deathsChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="month"
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
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
                    dataKey="child_adolescent"
                    stroke={CHART_COLORS.success}
                    strokeWidth={2}
                    name="Child & Adolescent (1-19)"
                    dot={{ r: 3, fill: CHART_COLORS.success }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="adults"
                    stroke={CHART_COLORS.primary}
                    strokeWidth={2}
                    name="Adults (19-59)"
                    dot={{ r: 3, fill: CHART_COLORS.primary }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="older_adults"
                    stroke={CHART_COLORS.warning}
                    strokeWidth={2}
                    name="Older Adults (>=60)"
                    dot={{ r: 3, fill: CHART_COLORS.warning }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="unknown"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    name="Unknown Age"
                    dot={{ r: 3, fill: "#94a3b8" }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke={CHART_COLORS.danger}
                    strokeWidth={2.5}
                    strokeDasharray="4 4"
                    name="Total"
                    dot={{ r: 3, fill: CHART_COLORS.danger }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : deathsView === 'table' ? (
              <DeathsTrendsTable data={deathsChartData} />
            ) : (
              <DeceasedPatientsMap deceasedPatients={deathsData?.deceased_patients || []} />
            )}
          </ChartCard>
        </div>
      </div>

      {/* Demographics Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Age Distribution */}
        <ChartCard
          id={ageView === 'graph' ? 'age-distribution-chart' : undefined}
          title="Age Distribution"
          description={ageView === 'graph' ? "Patient demographics by age group" : "Geospatial distribution of patients by age cohort"}
          isLoading={ageLoading}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3 mb-4 -mt-2">
            <DemographicsViewSwitcher
              activeView={ageView}
              onViewChange={setAgeView}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={agePatientStatus} onValueChange={setAgePatientStatus}>
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
              <TimelineSwitch
                value={ageTimelineRange}
                onChange={(val, range) => {
                  setAgeTimelineRange(val);
                  setAgeDateRange(range);
                }}
              />
            </div>
          </div>
          {ageView === 'graph' ? (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={ageChartData} margin={{ top: 10, right: 10, left: 0, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="ageGroup"
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                  height={60}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  allowDecimals={false}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    padding: '8px 12px'
                  }}
                  formatter={(value) => [value, 'Patients']}
                />
                <Legend />
                <Bar
                  dataKey="count"
                  fill={CHART_COLORS.primary}
                  name="Patients"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : ageView === 'table' ? (
            <AgeDistributionTable data={ageChartData} />
          ) : (
            <PatientAgeMap />
          )}
        </ChartCard>

        {/* Gender Distribution */}
        <ChartCard
          id={genderView === 'graph' ? 'gender-distribution-chart' : undefined}
          title="Gender Distribution"
          description={genderView === 'graph' ? "Patient demographics by gender" : "Geospatial distribution of patients by gender"}
          isLoading={genderLoading}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3 mb-4 -mt-2">
            <DemographicsViewSwitcher
              activeView={genderView}
              onViewChange={setGenderView}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={genderPatientStatus} onValueChange={setGenderPatientStatus}>
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
              <Select value={genderAgeGroup} onValueChange={setGenderAgeGroup}>
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
                value={genderTimelineRange}
                onChange={(val, range) => {
                  setGenderTimelineRange(val);
                  setGenderDateRange(range);
                }}
              />
            </div>
          </div>
          {genderView === 'graph' ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={genderChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {genderChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={CHART_COLORS.gradient[index % CHART_COLORS.gradient.length]}
                    />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    padding: '8px 12px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : genderView === 'table' ? (
            <GenderDistributionTable data={genderChartData} />
          ) : (
            <PatientGenderMap />
          )}
        </ChartCard>
      </div>

      {/* Trends Section */}
      <div className="grid gap-6">
        {/* Registration Trends */}
        <ChartCard
          id={registrationView === 'graph' ? 'registration-trends-chart' : undefined}
          title="Patient Registration Trends"
          description={registrationView === 'graph' ? "New patient registrations over time" : registrationView === 'table' ? "Tabular breakdown of new patient registrations" : "Geospatial distribution of active patients"}
          isLoading={regLoading}
          headerAction={
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={regPatientStatus} onValueChange={setRegPatientStatus}>
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
              <TimelineSwitch
                value={regTimelineRange}
                onChange={(val, range) => {
                  setRegTimelineRange(val);
                  setRegDateRange(range);
                }}
              />
              <DemographicsViewSwitcher
                activeView={registrationView}
                onViewChange={setRegistrationView}
              />
            </div>
          }
        >
          {registrationView === 'graph' ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={registrationChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="month"
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
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
                  dataKey="child_adolescent"
                  stroke={CHART_COLORS.success}
                  strokeWidth={2}
                  name="Child & Adolescent (1-19)"
                  dot={{ r: 3, fill: CHART_COLORS.success }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="adults"
                  stroke={CHART_COLORS.primary}
                  strokeWidth={2}
                  name="Adults (19-59)"
                  dot={{ r: 3, fill: CHART_COLORS.primary }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="older_adults"
                  stroke={CHART_COLORS.warning}
                  strokeWidth={2}
                  name="Older Adults (>=60)"
                  dot={{ r: 3, fill: CHART_COLORS.warning }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="unknown"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  name="Unknown Age"
                  dot={{ r: 3, fill: "#94a3b8" }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#64748b"
                  strokeWidth={2.5}
                  strokeDasharray="4 4"
                  name="Total"
                  dot={{ r: 3, fill: "#64748b" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : registrationView === 'table' ? (
            <RegistrationTrendsTable data={registrationChartData} />
          ) : (
            <PatientLocationsMap />
          )}
        </ChartCard>
      </div>

      {/* Beneficiary & Genogram Analytics */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Beneficiary & Genogram Analytics
        </h3>
        <BeneficiaryAnalysisView />
      </div>

      {/*Visit Analytics */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Visit Analytics
        </h3>
        <VisitAnalysisView />
      </div>

      {/* Vitals Analysis — mounted under the Patient tab so the main
          analytics view also shows the vitals charts. Self-fetches its own
          data, so no extra props are needed. */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Vitals Analysis
        </h3>
        <VitalsAnalysisView />
      </div>
    </div>
  );
}
