/**
 * PrescriptionAnalyticsView — prescription-PDF metrics:
 * total downloads, total issued versions, patients with a prescription, and a
 * per-user download breakdown. Data from GET /api/analytics/prescriptions.
 * Also includes Patient Distribution by Pain Intensity chart and custom WHO Pain Ladder from GET /api/analytics/pain-ladder.
 */
import { useState, useEffect, useMemo } from 'react';
import { FileText, Download, Users, Loader2, Pill } from 'lucide-react';
import apiClient from '@/api/client';
import { ChartCard } from '@/components/analytics/ChartCard';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { format, subMonths } from 'date-fns';
import { TimelineSwitch } from './TimelineSwitch';
import AnalgesicPainLadder from './AnalgesicPainLadder';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const TIER_COLORS = {
  'Mild (1-3)': '#10B981',      // Green
  'Moderate (4-6)': '#F59E0B',  // Orange
  'Severe (7-10)': '#EF4444'     // Red
};

function PainDataTable({ data = [] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="h-[260px] overflow-y-auto border border-border rounded-lg custom-scrollbar">
      <table className="min-w-full divide-y divide-border text-xs text-left">
        <thead className="bg-muted/50 sticky top-0 backdrop-blur-sm z-10">
          <tr>
            <th className="p-3 font-semibold text-muted-foreground">Pain Intensity</th>
            <th className="p-3 font-semibold text-muted-foreground text-right">Patients</th>
            <th className="p-3 font-semibold text-muted-foreground text-right">Percentage</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((item, idx) => (
            <tr key={idx} className="hover:bg-muted/10 transition-colors">
              <td className="p-3 font-medium text-foreground">{item.name}</td>
              <td className="p-3 text-right font-mono text-foreground">{item.value}</td>
              <td className="p-3 text-right font-mono text-muted-foreground">{item.percentage}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


function StatCard({ icon: Icon, label, value, isLoading }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
      <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
        <Icon className="h-5 w-5 text-blue-600" />
      </div>
      <div className="flex-1">
        {isLoading ? (
          <div className="h-8 w-16 bg-muted animate-pulse rounded-md mb-0.5" />
        ) : (
          <div className="text-2xl font-bold text-foreground">{value}</div>
        )}
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

export default function PrescriptionAnalyticsView() {
  const [data, setData] = useState(null);
  
  // Decoupled states for Pain Intensity (Pie Chart)
  const [pieLadderData, setPieLadderData] = useState([]);
  const [intensityStatus, setIntensityStatus] = useState('all');
  const [intensityAge, setIntensityAge] = useState('all');
  const [pieLoading, setPieLoading] = useState(true);

  // Decoupled states for WHO Pain Ladder
  const [ladderData, setLadderData] = useState([]);
  const [medDetails, setMedDetails] = useState({});
  const [othersBreakdown, setOthersBreakdown] = useState({});
  const [ladderStatus, setLadderStatus] = useState('all');
  const [ladderAge, setLadderAge] = useState('all');
  const [ladderLoading, setLadderLoading] = useState(true);
  
  const [rxLoading, setRxLoading] = useState(true);
  const [error, setError] = useState('');

  // Toggle view modes (chart vs table)
  const [pieView, setPieView] = useState('chart');
  const [ladderView, setLadderView] = useState('chart');


  // Prescription Stats Timeline Range (Default 1M)
  const [rxTimelineRange, setRxTimelineRange] = useState('1M');
  const [rxDateRange, setRxDateRange] = useState({
    from: subMonths(new Date(), 1),
    to: new Date()
  });

  // Pain Intensity (Pie Chart) Timeline Range (Default 1M)
  const [pieTimelineRange, setPieTimelineRange] = useState('1M');
  const [pieDateRange, setPieDateRange] = useState({
    from: subMonths(new Date(), 1),
    to: new Date()
  });

  // WHO Pain Ladder Timeline Range (Default 1M)
  const [ladderTimelineRange, setLadderTimelineRange] = useState('1M');
  const [ladderDateRange, setLadderDateRange] = useState({
    from: subMonths(new Date(), 1),
    to: new Date()
  });

  // Fetch 1: Prescription Metrics
  useEffect(() => {
    let active = true;
    setRxLoading(true);

    const params = {
      start_date: format(rxDateRange.from, 'yyyy-MM-dd'),
      end_date: format(rxDateRange.to, 'yyyy-MM-dd')
    };

    apiClient.get('/analytics/prescriptions', { params })
      .then((res) => {
        if (active) {
          setData(res.data);
        }
      })
      .catch((err) => {
        console.error('Error loading prescription analytics:', err);
        if (active) setError('Could not load prescription analytics.');
      })
      .finally(() => {
        if (active) setRxLoading(false);
      });

    return () => { active = false; };
  }, [rxDateRange]);

  // Fetch 2: Pain Intensity Distribution (Pie Chart)
  useEffect(() => {
    let active = true;
    setPieLoading(true);

    const params = {
      start_date: format(pieDateRange.from, 'yyyy-MM-dd'),
      end_date: format(pieDateRange.to, 'yyyy-MM-dd'),
      patient_status: intensityStatus,
      age_group: intensityAge
    };

    apiClient.get('/analytics/pain-ladder', { params })
      .then((res) => {
        if (active) {
          setPieLadderData(res.data?.data || []);
        }
      })
      .catch((err) => {
        console.error('Error loading pain intensity analytics:', err);
        if (active) setError('Could not load pain intensity analytics.');
      })
      .finally(() => {
        if (active) setPieLoading(false);
      });

    return () => { active = false; };
  }, [pieDateRange, intensityStatus, intensityAge]);

  // Fetch 3: WHO Pain Analgesic Ladder
  useEffect(() => {
    let active = true;
    setLadderLoading(true);

    const params = {
      start_date: format(ladderDateRange.from, 'yyyy-MM-dd'),
      end_date: format(ladderDateRange.to, 'yyyy-MM-dd'),
      patient_status: ladderStatus,
      age_group: ladderAge
    };

    apiClient.get('/analytics/pain-ladder', { params })
      .then((res) => {
        if (active) {
          setLadderData(res.data?.data || []);
          setMedDetails(res.data?.med_details || {});
          setOthersBreakdown(res.data?.others_breakdown || {});
        }
      })
      .catch((err) => {
        console.error('Error loading pain ladder analytics:', err);
        if (active) setError('Could not load pain ladder analytics.');
      })
      .finally(() => {
        if (active) setLadderLoading(false);
      });

    return () => { active = false; };
  }, [ladderDateRange, ladderStatus, ladderAge]);

  // Compute total and distribution for pain levels
  const painDistData = useMemo(() => {
    if (!pieLadderData || pieLadderData.length === 0) return { items: [], total: 0 };
    
    let total = 0;
    const items = pieLadderData.map(item => {
      const sum = (item["No Analgesic"] || 0) + 
                  (item["Step 1 (Non-Opioid)"] || 0) + 
                  (item["Step 2 (Weak Opioid)"] || 0) + 
                  (item["Step 3 (Strong Opioid)"] || 0);
      total += sum;
      return {
        name: item.pain_tier,
        value: sum,
      };
    });

    return {
      items: items.map(item => ({
        ...item,
        percentage: total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0'
      })),
      total
    };
  }, [pieLadderData]);

  const isInitialLoading = (rxLoading && !data) || (pieLoading && pieLadderData.length === 0) || (ladderLoading && ladderData.length === 0);

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading prescription analytics…
      </div>
    );
  }
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  const byUser = data?.downloads_by_user || [];
  const painItems = painDistData.items || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Timeline row for prescriptions stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Prescriptions & Medication</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Track prescription usage and WHO pain ladder distribution</p>
        </div>
        <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-2 self-start sm:self-auto shadow-sm">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timeline</span>
          <TimelineSwitch
            value={rxTimelineRange}
            onChange={(val, range) => {
              setRxTimelineRange(val);
              setRxDateRange(range);
            }}
          />
        </div>
      </div>

      {/* Prescription Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Download} label="Total PDF downloads" value={data?.total_downloads ?? 0} isLoading={rxLoading} />
        <StatCard icon={FileText} label="Prescriptions issued (versions)" value={data?.total_versions ?? 0} isLoading={rxLoading} />
        <StatCard icon={Users} label="Patients with a prescription" value={data?.patients_with_prescription ?? 0} isLoading={rxLoading} />
      </div>

      {/* Patient Distribution by Pain Intensity */}
      <ChartCard
        id="pain-intensity-chart-container"
        title="Patient Distribution by Pain Intensity"
        description="Correlation of latest nursing assessment pain scores"
        isLoading={pieLoading}
        headerAction={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/30 mr-1">
              <button
                onClick={() => setPieView('chart')}
                className={`px-2 py-1 text-[10px] font-semibold rounded transition-all duration-150 ${pieView === 'chart' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                title="Show Pie Chart"
              >
                Chart
              </button>
              <button
                onClick={() => setPieView('table')}
                className={`px-2 py-1 text-[10px] font-semibold rounded transition-all duration-150 ${pieView === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                title="Show Table"
              >
                Table
              </button>
            </div>
            <Select value={intensityStatus} onValueChange={setIntensityStatus}>

              <SelectTrigger className="w-[140px] h-8 text-xs font-semibold bg-background border-border">
                <SelectValue placeholder="Patient Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Patients</SelectItem>
                <SelectItem value="alive_active" className="text-xs">Alive & Active</SelectItem>
                <SelectItem value="inactive" className="text-xs">Alive & Inactive</SelectItem>
                <SelectItem value="dead" className="text-xs">Deceased</SelectItem>
              </SelectContent>
            </Select>
            <Select value={intensityAge} onValueChange={setIntensityAge}>
              <SelectTrigger className="w-[140px] h-8 text-xs font-semibold bg-background border-border">
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
              value={pieTimelineRange}
              onChange={(val, range) => {
                setPieTimelineRange(val);
                setPieDateRange(range);
              }}
            />
          </div>
        }
      >
        {painItems.length === 0 ? (
          <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
            No pain assessment data recorded yet.
          </div>
        ) : pieView === 'table' ? (
          <PainDataTable data={painItems} />
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-4">

            <div className="h-[260px] w-[260px] flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={painItems}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={2.5}
                    dataKey="value"
                  >
                    {painItems.map((entry) => (
                      <Cell key={entry.name} fill={TIER_COLORS[entry.name] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-popover border border-border rounded-lg p-3 shadow-md text-xs space-y-1">
                            <div className="font-bold text-foreground">{data.name}</div>
                            <div className="text-muted-foreground">
                              Patients: <span className="font-semibold text-foreground">{data.value}</span> ({data.percentage}%)
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col justify-center space-y-4 w-full max-w-xs px-4">
              {painItems.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: TIER_COLORS[entry.name] || '#94a3b8' }}
                    />
                    <span className="text-sm font-medium text-foreground">{entry.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{entry.value}</span>
                    <span className="text-sm text-muted-foreground">({entry.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </ChartCard>

      {/* WHO Pain Ladder Visualization (Full width) */}
      <AnalgesicPainLadder 
        ladderData={ladderData} 
        medDetails={medDetails} 
        othersBreakdown={othersBreakdown} 
        isLoading={ladderLoading}
        viewMode={ladderView}
        headerAction={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/30 mr-1">
              <button
                onClick={() => setLadderView('chart')}
                className={`px-2 py-1 text-[10px] font-semibold rounded transition-all duration-150 ${ladderView === 'chart' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                title="Show Ladder"
              >
                Ladder
              </button>
              <button
                onClick={() => setLadderView('table')}
                className={`px-2 py-1 text-[10px] font-semibold rounded transition-all duration-150 ${ladderView === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                title="Show Table"
              >
                Table
              </button>
            </div>
            <Select value={ladderStatus} onValueChange={setLadderStatus}>

              <SelectTrigger className="w-[140px] h-8 text-xs font-semibold bg-background border-border">
                <SelectValue placeholder="Patient Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Patients</SelectItem>
                <SelectItem value="alive_active" className="text-xs">Alive & Active</SelectItem>
                <SelectItem value="inactive" className="text-xs">Alive & Inactive</SelectItem>
                <SelectItem value="dead" className="text-xs">Deceased</SelectItem>
              </SelectContent>
            </Select>
            <Select value={ladderAge} onValueChange={setLadderAge}>
              <SelectTrigger className="w-[140px] h-8 text-xs font-semibold bg-background border-border">
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
              value={ladderTimelineRange}
              onChange={(val, range) => {
                setLadderTimelineRange(val);
                setLadderDateRange(range);
              }}
            />
          </div>
        }
      />

      {/* Downloads by user (Full width at bottom) */}
      <ChartCard
        id="downloads-by-user-container"
        title="Downloads by user"
        description="Prescription PDF download counts per system user"
        isLoading={rxLoading}
      >
        <div className="overflow-y-auto max-h-[300px]">
          {byUser.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground text-center">No downloads recorded yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {byUser.map((u, i) => (
                <li key={u.user_id || i} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-foreground">{u.name}</span>
                  <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">{u.downloads}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </ChartCard>
    </div>
  );
}
