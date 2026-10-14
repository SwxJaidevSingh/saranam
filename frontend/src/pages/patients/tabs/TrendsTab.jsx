/**
 * TrendsTab — Unified Vitals (all sources), ESAS-R, and PPS trends
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceArea, Dot,
} from 'recharts';
import { TrendingUp, TrendingDown, Activity, BarChart3, Thermometer, Heart } from 'lucide-react';
import saranamApi from '../../../api/saranam';

/* ─────────────────────── SOURCE CONFIG ─────────────────────── */
const SOURCE_COLORS = {
  initial: '#EF4444',
  follow_up: '#3B82F6',
  home_care: '#8B5CF6',
  opd: '#10B981',
  ipd: '#F59E0B',
};

const SOURCE_LABELS = {
  initial: 'Initial Assessment',
  follow_up: 'Follow-up',
  home_care: 'Home Care',
  opd: 'OPD Visit',
  ipd: 'IPD Visit',
};

/* ─────────────────────── VITALS CONFIG ─────────────────────── */
const VITALS_TABS = [
  { key: 'bp', label: 'Blood Pressure', lines: ['bp_systolic', 'bp_diastolic'] },
  { key: 'pr', label: 'Pulse Rate', lines: ['pr'] },
  { key: 'spo2', label: 'SpO2', lines: ['spo2'] },
  { key: 'temperature', label: 'Temperature', lines: ['temperature'] },
  { key: 'rr', label: 'Resp. Rate', lines: ['rr'] },
  { key: 'grbs', label: 'GRBS', lines: ['grbs'] },
];

const VITAL_COLORS = {
  bp_systolic: '#EF4444',
  bp_diastolic: '#F97316',
  pr: '#8B5CF6',
  spo2: '#3B82F6',
  temperature: '#14B8A6',
  rr: '#22C55E',
  grbs: '#EAB308',
};

const VITAL_LABELS = {
  bp_systolic: 'Systolic',
  bp_diastolic: 'Diastolic',
  pr: 'Pulse Rate',
  spo2: 'SpO2',
  temperature: 'Temperature',
  rr: 'Resp. Rate',
  grbs: 'GRBS',
};

function getVitalDomain(key) {
  switch (key) {
    case 'bp': return [40, 200];
    case 'pr': return [40, 140];
    case 'spo2': return [80, 100];
    case 'temperature': return [35, 40];
    case 'rr': return [5, 40];
    case 'grbs': return [30, 300];
    default: return ['auto', 'auto'];
  }
}

/* ─────────────────────── ESAS CONFIG ─────────────────────── */
const ESAS_SYMPTOMS = [
  { key: 'pain', label: 'Pain', color: '#EF4444' },
  { key: 'tiredness', label: 'Tiredness', color: '#F97316' },
  { key: 'nausea', label: 'Nausea', color: '#EAB308' },
  { key: 'depression', label: 'Depression', color: '#8B5CF6' },
  { key: 'anxiety', label: 'Anxiety', color: '#EC4899' },
  { key: 'drowsiness', label: 'Drowsiness', color: '#6366F1' },
  { key: 'appetite', label: 'Appetite', color: '#14B8A6' },
  { key: 'wellbeing', label: 'Wellbeing', color: '#22C55E' },
  { key: 'shortness_of_breath', label: 'Breath', color: '#3B82F6' },
];

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/* ─────────────────────── CUSTOM DOT (source-colored) ─────────────────────── */
function SourceDot(props) {
  const { cx, cy, payload, dataKey } = props;
  if (cx == null || cy == null || payload?.vitals?.[dataKey] == null) return null;
  const sourceType = payload.source_type || 'follow_up';
  const fill = SOURCE_COLORS[sourceType] || '#6366F1';
  return (
    <circle cx={cx} cy={cy} r={5} fill={fill} stroke="#fff" strokeWidth={2} />
  );
}

/* ─────────────────────── TOOLTIPS ─────────────────────── */
function VitalsTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  const sourceType = data?.source_type || 'follow_up';
  return (
    <div className="bg-white dark:bg-slate-800 border border-border rounded-lg shadow-lg p-3 text-xs min-w-[160px]">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SOURCE_COLORS[sourceType] }} />
        <span className="font-bold">{data?.source || label}</span>
      </div>
      <p className="text-[10px] text-muted-foreground mb-1.5">{data?.visit_date ? formatDate(data.visit_date) : label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">{VITAL_LABELS[p.dataKey] || p.name}</span>
          <span className="font-semibold">{p.value != null ? p.value : '—'}</span>
        </div>
      ))}
      {data?.change_from_baseline && (
        <div className="mt-1.5 pt-1.5 border-t border-border">
          {payload.map(p => {
            const delta = data.change_from_baseline?.[p.dataKey];
            if (delta == null) return null;
            return (
              <div key={`d-${p.dataKey}`} className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground text-[10px]">{VITAL_LABELS[p.dataKey]} change</span>
                <span className={`text-[10px] font-semibold ${delta > 0 ? 'text-red-500' : delta < 0 ? 'text-green-500' : 'text-slate-400'}`}>
                  {delta > 0 ? '+' : ''}{delta}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EsasTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-border rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold mb-1.5">{label}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        {payload.map(p => (
          <div key={p.dataKey} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-muted-foreground">{p.name}:</span>
            <span className="font-semibold">{p.value}/10</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PpsTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  return (
    <div className="bg-white dark:bg-slate-800 border border-border rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold mb-1.5">{label}</p>
      <p className="text-lg font-bold mb-1">PPS: {data?.pps_score}%</p>
      {data?.ambulation && <p><span className="text-muted-foreground">Ambulation:</span> {data.ambulation}</p>}
      {data?.self_care && <p><span className="text-muted-foreground">Self-Care:</span> {data.self_care}</p>}
      {data?.intake && <p><span className="text-muted-foreground">Intake:</span> {data.intake}</p>}
      {data?.consciousness_level && <p><span className="text-muted-foreground">Consciousness:</span> {data.consciousness_level}</p>}
    </div>
  );
}

/* ─────────────────────── BASELINE CARD ─────────────────────── */
function BaselineCard({ vitalKey, baseline, latest, refRange }) {
  if (baseline == null && latest == null) return null;
  const delta = (latest != null && baseline != null) ? +(latest - baseline).toFixed(1) : null;
  const center = refRange ? (refRange.min + refRange.max) / 2 : null;
  let status = 'stable';
  if (delta != null && center != null) {
    const initDist = Math.abs((latest - delta) - center);
    const currDist = Math.abs(latest - center);
    if (currDist < initDist - 2) status = 'improved';
    else if (currDist > initDist + 2) status = 'deteriorated';
  }
  const statusColor = status === 'improved' ? 'text-green-600' : status === 'deteriorated' ? 'text-red-600' : 'text-yellow-600';
  const bgColor = status === 'improved' ? 'bg-green-50 dark:bg-green-900/20' : status === 'deteriorated' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-slate-50 dark:bg-slate-700/50';

  return (
    <div className={`${bgColor} rounded-lg p-2.5 min-w-[110px]`}>
      <p className="text-[10px] text-muted-foreground font-medium">{VITAL_LABELS[vitalKey]}</p>
      <p className="text-base font-bold mt-0.5">{latest != null ? latest : '—'}</p>
      <div className="flex items-center gap-1 mt-0.5">
        {delta != null && (
          <>
            {delta > 0 ? <TrendingUp className="h-3 w-3" /> : delta < 0 ? <TrendingDown className="h-3 w-3" /> : null}
            <span className={`text-[10px] font-semibold ${statusColor}`}>
              {delta > 0 ? '+' : ''}{delta}
            </span>
          </>
        )}
        <span className="text-[10px] text-muted-foreground">
          {refRange ? `(${refRange.min}-${refRange.max})` : ''}
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────── MAIN COMPONENT ─────────────────────── */
export default function TrendsTab({ patientId }) {
  const [esasScores, setEsasScores] = useState([]);
  const [ppsScores, setPpsScores] = useState([]);
  const [vitalsData, setVitalsData] = useState({ visits: [], baseline: null, reference_ranges: {} });
  const [loading, setLoading] = useState(true);
  const [visibleSymptoms, setVisibleSymptoms] = useState(new Set(ESAS_SYMPTOMS.map(s => s.key)));
  const [activeVitalTab, setActiveVitalTab] = useState('bp');

  useEffect(() => {
    if (!patientId) return;
    loadData();
  }, [patientId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [esasRes, ppsRes, vitalsRes] = await Promise.all([
        saranamApi.getPatientScores(patientId, 'esas').catch(() => ({ scores: [] })),
        saranamApi.getPatientScores(patientId, 'pps').catch(() => ({ scores: [] })),
        saranamApi.getPatientScores(patientId, 'vitals').catch(() => ({ visits: [], baseline: null, reference_ranges: {} })),
      ]);
      setEsasScores(esasRes.scores || []);
      setPpsScores(ppsRes.scores || []);
      setVitalsData(vitalsRes);
    } catch {
      // handled per-call
    } finally {
      setLoading(false);
    }
  };

  const toggleSymptom = (key) => {
    setVisibleSymptoms(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // ── Chart data ──
  const vitalsChartData = useMemo(() => {
    return (vitalsData.visits || []).map(v => ({
      date: formatDate(v.visit_date),
      source: v.source,
      source_type: v.source_type,
      visit_date: v.visit_date,
      change_from_baseline: v.change_from_baseline,
      ...v.vitals,
    }));
  }, [vitalsData.visits]);

  const esasChartData = useMemo(() => {
    return esasScores.map(s => ({
      date: formatDate(s.recorded_at || s.created_at),
      ...ESAS_SYMPTOMS.reduce((acc, sym) => { acc[sym.key] = s[sym.key] ?? null; return acc; }, {}),
      total_score: s.total_score,
    }));
  }, [esasScores]);

  const ppsChartData = useMemo(() => {
    return ppsScores.map(s => ({
      date: formatDate(s.recorded_at || s.created_at),
      pps_score: s.pps_score,
      ambulation: s.ambulation,
      self_care: s.self_care,
      intake: s.intake,
      consciousness_level: s.consciousness_level,
      activity_level: s.activity_level,
    }));
  }, [ppsScores]);

  const latestVitals = useMemo(() => {
    const visits = vitalsData.visits || [];
    return visits.length ? visits[visits.length - 1].vitals : null;
  }, [vitalsData.visits]);

  // Unique source types present in data
  const presentSources = useMemo(() => {
    const types = new Set((vitalsData.visits || []).map(v => v.source_type));
    return [...types];
  }, [vitalsData.visits]);

  const latestPps = ppsScores.length > 0 ? ppsScores[ppsScores.length - 1] : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  const hasData = esasScores.length > 0 || ppsScores.length > 0 || vitalsChartData.length > 0;

  if (!hasData) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-border rounded-xl p-12 text-center">
        <BarChart3 className="h-12 w-12 mx-auto mb-3 text-slate-300" />
        <p className="text-muted-foreground font-medium">No assessment data recorded yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Vitals, ESAS-R and PPS scores will appear here after assessments are completed during visits.
        </p>
      </div>
    );
  }

  const activeTab = VITALS_TABS.find(t => t.key === activeVitalTab) || VITALS_TABS[0];
  const refRanges = vitalsData.reference_ranges || {};

  return (
    <div className="space-y-6">

      {/* ══════════════════ VITALS TRENDS ══════════════════ */}
      {vitalsChartData.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Thermometer className="h-5 w-5 text-red-500" />
            <h3 className="text-base font-bold">Vitals Trends</h3>
            <span className="text-xs text-muted-foreground">({vitalsChartData.length} records from {presentSources.length} sources)</span>
          </div>

          {/* Source Legend */}
          <div className="flex flex-wrap gap-3 mb-3 pb-3 border-b border-border">
            {presentSources.map(st => (
              <div key={st} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: SOURCE_COLORS[st] || '#6366F1' }} />
                <span className="text-[11px] text-muted-foreground font-medium">{SOURCE_LABELS[st] || st}</span>
              </div>
            ))}
          </div>

          {/* Vital Tab Selector */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {VITALS_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveVitalTab(tab.key)}
                className={`px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-all ${
                  activeVitalTab === tab.key
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Vitals Chart */}
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={vitalsChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              {/* Normal range band */}
              {activeTab.key === 'bp' ? (
                <ReferenceArea y1={refRanges.bp_systolic?.min || 90} y2={refRanges.bp_systolic?.max || 140} fill="#22c55e" fillOpacity={0.06} />
              ) : refRanges[activeTab.key] ? (
                <ReferenceArea y1={refRanges[activeTab.key].min} y2={refRanges[activeTab.key].max} fill="#22c55e" fillOpacity={0.08} />
              ) : null}
              {/* Baseline reference lines */}
              {vitalsData.baseline && activeTab.lines.map(lineKey => (
                vitalsData.baseline[lineKey] != null && (
                  <ReferenceLine
                    key={`bl-${lineKey}`}
                    y={vitalsData.baseline[lineKey]}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    label={{ value: `Baseline: ${vitalsData.baseline[lineKey]}`, position: 'right', fontSize: 10, fill: '#94a3b8' }}
                  />
                )
              ))}
              <XAxis dataKey="source" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={60} interval={0} />
              <YAxis domain={getVitalDomain(activeTab.key)} tick={{ fontSize: 11 }} />
              <Tooltip content={<VitalsTooltip />} />
              {activeTab.lines.map(lineKey => (
                <Line
                  key={lineKey}
                  type="monotone"
                  dataKey={lineKey}
                  name={VITAL_LABELS[lineKey]}
                  stroke={VITAL_COLORS[lineKey]}
                  strokeWidth={2.5}
                  dot={<SourceDot dataKey={lineKey} />}
                  activeDot={{ r: 7, stroke: '#fff', strokeWidth: 2 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          {/* Baseline Comparison Cards */}
          {latestVitals && vitalsData.baseline && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Change from Baseline (Initial Visit)</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
                {Object.keys(VITAL_LABELS).map(key => (
                  <BaselineCard
                    key={key}
                    vitalKey={key}
                    baseline={vitalsData.baseline[key]}
                    latest={latestVitals[key]}
                    refRange={refRanges[key]}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ ESAS-R Trends ══════════════════ */}
      {esasScores.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-blue-500" />
            <h3 className="text-base font-bold">ESAS-R Symptom Trends</h3>
            <span className="text-xs text-muted-foreground">({esasScores.length} assessments)</span>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-4">
            {ESAS_SYMPTOMS.map(sym => (
              <button
                key={sym.key}
                onClick={() => toggleSymptom(sym.key)}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-full border transition-all ${
                  visibleSymptoms.has(sym.key)
                    ? 'border-transparent text-white'
                    : 'border-slate-200 text-slate-400 bg-transparent'
                }`}
                style={visibleSymptoms.has(sym.key) ? { backgroundColor: sym.color } : {}}
              >
                {sym.label}
              </button>
            ))}
            <button
              onClick={() => {
                if (visibleSymptoms.size === ESAS_SYMPTOMS.length) setVisibleSymptoms(new Set());
                else setVisibleSymptoms(new Set(ESAS_SYMPTOMS.map(s => s.key)));
              }}
              className="px-2.5 py-1 text-[10px] font-medium rounded-full border border-slate-300 text-slate-500 hover:bg-slate-100"
            >
              {visibleSymptoms.size === ESAS_SYMPTOMS.length ? 'Hide All' : 'Show All'}
            </button>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={esasChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <ReferenceArea y1={0} y2={3} fill="#22c55e" fillOpacity={0.06} />
              <ReferenceArea y1={3} y2={6} fill="#eab308" fillOpacity={0.06} />
              <ReferenceArea y1={6} y2={10} fill="#ef4444" fillOpacity={0.06} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
              <Tooltip content={<EsasTooltip />} />
              {ESAS_SYMPTOMS.filter(s => visibleSymptoms.has(s.key)).map(sym => (
                <Line
                  key={sym.key}
                  type="monotone"
                  dataKey={sym.key}
                  name={sym.label}
                  stroke={sym.color}
                  strokeWidth={2}
                  dot={{ r: 3, fill: sym.color }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          {esasChartData.some(d => d.total_score != null) && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Total Symptom Burden</p>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={esasChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => [`${v}/100`, 'Total']} />
                  <Area type="monotone" dataKey="total_score" stroke="#6366F1" fill="#6366F1" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ PPS Trends ══════════════════ */}
      {ppsScores.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-green-500" />
            <h3 className="text-base font-bold">Palliative Performance Scale (PPS)</h3>
            <span className="text-xs text-muted-foreground">({ppsScores.length} assessments)</span>
          </div>

          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={ppsChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <ReferenceArea y1={0} y2={39} fill="#ef4444" fillOpacity={0.06} />
              <ReferenceArea y1={39} y2={69} fill="#eab308" fillOpacity={0.06} />
              <ReferenceArea y1={69} y2={100} fill="#22c55e" fillOpacity={0.06} />
              <ReferenceLine y={40} stroke="#eab308" strokeDasharray="5 5" label={{ value: '40%', position: 'left', fontSize: 10 }} />
              <ReferenceLine y={70} stroke="#22c55e" strokeDasharray="5 5" label={{ value: '70%', position: 'left', fontSize: 10 }} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
              <Tooltip content={<PpsTooltip />} />
              <Area type="monotone" dataKey="pps_score" name="PPS Score" stroke="#22C55E" fill="#22C55E" fillOpacity={0.15} strokeWidth={2.5} dot={{ r: 4, fill: '#22C55E' }} activeDot={{ r: 6 }} />
            </AreaChart>
          </ResponsiveContainer>

          {latestPps && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                Latest PPS — Score: <span className={`font-bold ${latestPps.pps_score >= 70 ? 'text-green-600' : latestPps.pps_score >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>{latestPps.pps_score}%</span>
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { label: 'Ambulation', value: latestPps.ambulation },
                  { label: 'Activity', value: latestPps.activity_level },
                  { label: 'Self-Care', value: latestPps.self_care },
                  { label: 'Intake', value: latestPps.intake },
                  { label: 'Consciousness', value: latestPps.consciousness_level },
                ].map(dim => dim.value && (
                  <div key={dim.label} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2">
                    <p className="text-[10px] text-muted-foreground">{dim.label}</p>
                    <p className="text-xs font-medium">{dim.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
