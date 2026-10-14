import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Thermometer, Users, Activity, ArrowUpDown, Heart, Download, LayoutGrid, Table, Map } from 'lucide-react';
import { subMonths } from 'date-fns';
import { exportChartAsSvg } from '@/utils/chartExport';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { TimelineSwitch } from './TimelineSwitch';
import PatientVitalsMap from './PatientVitalsMap';
import analyticsApi from '@/api/analytics';

const COLORS = {
  improved: '#10b981',
  stable: '#f59e0b',
  deteriorated: '#ef4444',
};

const VITAL_LABELS = {
  bp_systolic: 'BP Systolic',
  bp_diastolic: 'BP Diastolic',
  pr: 'Pulse Rate',
  spo2: 'SpO2',
  temperature: 'Temperature',
  rr: 'Resp. Rate',
  grbs: 'GRBS',
};

const REFERENCE_RANGES = {
  bp_systolic: {'min': 90, 'max': 140, 'unit': 'mmHg'},
  bp_diastolic: {'min': 60, 'max': 90, 'unit': 'mmHg'},
  pr: {'min': 60, 'max': 100, 'unit': 'bpm'},
  spo2: {'min': 95, 'max': 100, 'unit': '%'},
  temperature: {'min': 36.1, 'max': 37.2, 'unit': '°C'},
  rr: {'min': 12, 'max': 20, 'unit': '/min'},
  grbs: {'min': 70, 'max': 140, 'unit': 'mg/dL'},
};

function KpiCard({ title, value, subtitle, icon: Icon, gradient, isLoading }) {
  return (
    <Card className={`bg-gradient-to-br ${gradient} border-opacity-20 transition-all hover:shadow-lg`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 opacity-70" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DistributionTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-border rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold mb-1">{label}</p>
      <p>{payload[0]?.value} patients</p>
    </div>
  );
}

const VitalsDataTable = ({ data = [], vitalKey }) => {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="h-[300px] overflow-y-auto border border-border rounded-lg bg-card custom-scrollbar">
      <table className="min-w-full divide-y divide-border text-xs text-left">
        <thead className="bg-muted/50 sticky top-0 backdrop-blur-sm z-10">
          <tr>
            <th className="p-3 font-semibold text-muted-foreground">Range ({REFERENCE_RANGES[vitalKey].unit})</th>
            <th className="p-3 font-semibold text-muted-foreground text-right">Count</th>
            <th className="p-3 font-semibold text-muted-foreground text-right">Percentage</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((item, idx) => {
            const pct = total > 0 ? ((item.count / total) * 100).toFixed(1) : '0.0';
            return (
              <tr key={idx} className="hover:bg-muted/10 transition-colors">
                <td className="p-3 font-medium text-foreground">{item.range}</td>
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

export const VitalsAnalysisView = () => {
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState(null);
  const [distributionData, setDistributionData] = useState(null);
  const [deathsData, setDeathsData] = useState(null);
  const [selectedVital, setSelectedVital] = useState('bp_systolic');
  const [vitalsView, setVitalsView] = useState('graph');
  const [patientStatus, setPatientStatus] = useState('all');
  const [ageGroup, setAgeGroup] = useState('all');

  // Timeline States (Default 1M)
  const [timelineRange, setTimelineRange] = useState('1M');
  const [dateRange, setDateRange] = useState({
    from: subMonths(new Date(), 1),
    to: new Date()
  });

  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      setLoading(true);
      try {
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

        const params = {
          start_date: dateRange.from.toISOString(),
          end_date: dateRange.to.toISOString(),
          patient_status: patientStatus,
          age_group: ageGroup
        };

        const [summaryRes, distRes, deathsRes] = await Promise.all([
          analyticsApi.getVitalsSummary(params),
          analyticsApi.getVitalsDistribution(params),
          analyticsApi.getDeathsImpact(days).catch((err) => {
            console.error('Error fetching deaths impact:', err);
            return null;
          }),
        ]);

        if (!cancelled) {
          setSummaryData(summaryRes);
          setDistributionData(distRes);
          if (deathsRes) {
            setDeathsData(deathsRes);
          }
        }
      } catch (error) {
        console.error('Error fetching vitals analytics:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAll();
    return () => { cancelled = true; };
  }, [dateRange, timelineRange, patientStatus, ageGroup]);

  // Prepare distribution chart data for selected vital
  const distChartData = distributionData?.[selectedVital]?.buckets || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          title="Patients Tracked"
          value={summaryData?.total_patients_with_vitals || 0}
          subtitle="With initial + follow-up vitals"
          icon={Users}
          gradient="from-blue-500/10 to-indigo-500/10 border-blue-500/20"
          isLoading={loading}
        />
        <KpiCard
          title={`Deaths (last ${timelineRange})`}
          value={deathsData?.deaths_in_window ?? 0}
          subtitle="Palliative care outcomes"
          icon={Heart}
          gradient="from-rose-500/10 to-pink-500/10 border-rose-500/20"
          isLoading={loading}
        />
        <KpiCard
          title="Avg Visits Before Death"
          value={
            deathsData?.avg_visits_before_death != null
              ? Number(deathsData.avg_visits_before_death).toFixed(1)
              : '—'
          }
          subtitle="Team visits per deceased patient"
          icon={Activity}
          gradient="from-amber-500/10 to-orange-500/10 border-amber-500/20"
          isLoading={loading}
        />
      </div>

      <div className="grid gap-6 grid-cols-1">
        {/* Vitals Distribution */}
        <Card id="vitals-distribution-analysis-chart" className="transition-all hover:shadow-lg">
          <CardHeader className="flex flex-col space-y-3 pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowUpDown className="h-5 w-5 text-blue-500" />
                  Vitals Distribution (Latest Visit)
                </CardTitle>
                <div className="text-xs text-muted-foreground mt-1">
                  Distribution of patient vital metrics collected in the latest completed visit
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {vitalsView === 'graph' && (
                  <button
                    onClick={() => exportChartAsSvg('vitals-distribution-analysis-chart', `vitals-${selectedVital}-distribution.svg`)}
                    className="inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none h-8 w-8"
                    title="Download Chart SVG"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                )}
                
                <div className="inline-flex items-center p-0.5 bg-muted/60 backdrop-blur-sm rounded-lg border border-border/60 shadow-sm h-8">
                  <button
                    onClick={() => setVitalsView('graph')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold rounded transition-all duration-150 ${
                      vitalsView === 'graph'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Show Graph"
                  >
                    <LayoutGrid className="h-3 w-3" />
                    <span>Graph</span>
                  </button>
                  <button
                    onClick={() => setVitalsView('table')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold rounded transition-all duration-150 ${
                      vitalsView === 'table'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Show Table"
                  >
                    <Table className="h-3 w-3" />
                    <span>Table</span>
                  </button>
                  <button
                    onClick={() => setVitalsView('map')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold rounded transition-all duration-150 ${
                      vitalsView === 'map'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Show Map"
                  >
                    <Map className="h-3 w-3" />
                    <span>Map</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {Object.keys(VITAL_LABELS).map(key => (
                <button
                  key={key}
                  onClick={() => setSelectedVital(key)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all ${
                    selectedVital === key
                      ? 'bg-primary border-primary text-white'
                      : 'border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {VITAL_LABELS[key]}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-2 mt-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={patientStatus} onValueChange={setPatientStatus}>
                  <SelectTrigger className="w-[125px] h-8 text-xs font-semibold bg-background border-border">
                    <SelectValue placeholder="Patient Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Patients</SelectItem>
                    <SelectItem value="alive_active" className="text-xs">Alive & Active</SelectItem>
                    <SelectItem value="inactive" className="text-xs">Alive & Inactive</SelectItem>
                    <SelectItem value="dead" className="text-xs">Deceased</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={ageGroup} onValueChange={setAgeGroup}>
                  <SelectTrigger className="w-[125px] h-8 text-xs font-semibold bg-background border-border">
                    <SelectValue placeholder="Age Group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Ages</SelectItem>
                    <SelectItem value="child_adolescent" className="text-xs">Child & Adolescent</SelectItem>
                    <SelectItem value="adults" className="text-xs">Adults (19-59)</SelectItem>
                    <SelectItem value="older_adults" className="text-xs">Older Adults (&gt;=60)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <TimelineSwitch
                value={timelineRange}
                onChange={(val, range) => {
                  setTimelineRange(val);
                  setDateRange(range);
                }}
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3 py-8">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-4 w-1/3 mx-auto" />
              </div>
            ) : vitalsView === 'graph' ? (
              <>
                {distChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={distChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="range" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                      <Tooltip content={<DistributionTooltip />} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No distribution data</p>
                )}
                {distributionData?.[selectedVital] && (
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    Normal range: <span className="font-semibold text-green-600">{REFERENCE_RANGES[selectedVital].min}-{REFERENCE_RANGES[selectedVital].max}</span> {REFERENCE_RANGES[selectedVital].unit}
                    {' '} | {distributionData[selectedVital].total} patients
                  </p>
                )}
              </>
            ) : vitalsView === 'table' ? (
              <>
                {distChartData.length > 0 ? (
                  <VitalsDataTable data={distChartData} vitalKey={selectedVital} />
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No distribution data</p>
                )}
                {distributionData?.[selectedVital] && (
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    Normal range: <span className="font-semibold text-green-600">{REFERENCE_RANGES[selectedVital].min}-{REFERENCE_RANGES[selectedVital].max}</span> {REFERENCE_RANGES[selectedVital].unit}
                    {' '} | {distributionData[selectedVital].total} patients
                  </p>
                )}
              </>
            ) : (
              <PatientVitalsMap selectedVital={selectedVital} patientStatus={patientStatus} ageGroup={ageGroup} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VitalsAnalysisView;
