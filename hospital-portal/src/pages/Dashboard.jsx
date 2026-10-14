/**
 * Portal Dashboard — org-scoped analytics, replacing the Wave 2 placeholder.
 *
 * Every metric is fetched through the portal axios client, so the X-Org-Id
 * header scopes it to the active org on the backend (an org user sees only
 * their org; a platform admin in god view sees all orgs). Each chart owns its
 * own loading / empty / error state (reusing ui/States) so one failing endpoint
 * never blanks the whole page.
 *
 * Charts:
 *   - Summary cards (totals / active / inactive / deceased / new this week+month)
 *   - LineChart  — intake trend (day|week|month)
 *   - PieChart   — origin breakdown
 *   - BarChart   — top referral sources
 *   - BarChart   — age bands (WHO scheme)
 *   - PieChart   — gender split
 *   - BarChart   — geography (geographic_cluster)
 *   - BarChart   — by-org comparison (platform admin in god view ONLY)
 *
 * The brand accent (per-org accent_color, applied to --accent-color by
 * OrgContext) drives the primary chart color; a small categorical palette
 * covers multi-series charts.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  Download,
  Heart,
  HeartPulse,
  LayoutGrid,
  Map as MapIcon,
  ShieldAlert,
  Thermometer,
  TrendingUp,
  UserCheck,
  UserMinus,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { analyticsApi } from '../api/analytics'
import { ORIGIN_TYPE_LABELS } from '../constants/origin'
import { useOrg } from '../context/OrgContext'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States'
import PalliativeOutcomes from '../components/analytics/PalliativeOutcomes'
import PatientGenderMap from '../components/analytics/PatientGenderMap'
import PatientAgeMap from '../components/analytics/PatientAgeMap'
import PatientLocationsMap from '../components/analytics/PatientLocationsMap'
import PatientVitalsMap from '../components/analytics/PatientVitalsMap'
// import PatientDiseaseMap from '../components/analytics/PatientDiseaseMap'
import RealTimeLocationTab from '../components/analytics/RealTimeLocationTab'
import { exportChartAsSvg } from '../utils/chartExport'

// Read the live per-org accent so charts respect branding.
function accentColor() {
  if (typeof window === 'undefined') return '#0284c7'
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent-color')
    .trim()
  return v || '#0284c7'
}

// Categorical palette for multi-slice charts (origin / gender / by-org).
const PALETTE = [
  '#0284c7', '#7c3aed', '#059669', '#d97706', '#dc2626',
  '#0891b2', '#db2777', '#65a30d', '#4f46e5', '#ea580c',
]

const PERIOD_OPTIONS = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
]

/** Generic async-data hook returning { data, loading, error, reload }. */
function useAsync(fetcher, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetcher()
      setData(res)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    run()
  }, [run])

  return { data, loading, error, reload: run }
}

/** Card wrapper for a chart with consistent title + body sizing. */
function ChartCard({ id, title, subtitle, action, children, className = '' }) {
  return (
    <div className={`card ${className}`} id={id}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {action}
          {id && (
            <button
              onClick={() => exportChartAsSvg(id, `${title.toLowerCase().replace(/\s+/g, '-')}.svg`)}
              className="btn btn-secondary !h-8 !w-8 !p-0 flex items-center justify-center text-muted-foreground hover:text-foreground"
              title="Download Chart SVG"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  )
}

/** Wraps chart body in the right state (loading / error / empty / data). */
function ChartBody({ loading, error, isEmpty, onRetry, height = 280, children }) {
  if (loading) return <LoadingState label="Loading…" className="!py-10" />
  if (error) return <ErrorState message={error} onRetry={onRetry} />
  if (isEmpty) {
    return (
      <EmptyState
        title="No data yet"
        message="There is nothing to chart for this organization yet."
      />
    )
  }
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

function SummaryCard({ icon: Icon, label, value, tone = 'default' }) {
  const toneClass = {
    default: 'text-foreground',
    good: 'text-emerald-600',
    warn: 'text-amber-600',
    bad: 'text-rose-600',
  }[tone]
  return (
    <div className="card flex items-center gap-3">
      <div className="rounded-lg bg-secondary p-2.5 text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className={`text-2xl font-bold tabular-nums ${toneClass}`}>
          {value === null || value === undefined ? '—' : value.toLocaleString()}
        </div>
        <div className="truncate text-xs font-medium text-muted-foreground">{label}</div>
      </div>
    </div>
  )
}

// ── Sub-sections ──────────────────────────────────────────────────────────────

function SummaryCards() {
  const { data, loading, error, reload } = useAsync(() => analyticsApi.summary(), [])

  if (loading) {
    return (
      <div className="card">
        <LoadingState label="Loading summary…" className="!py-8" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="card">
        <ErrorState message={error} onRetry={reload} />
      </div>
    )
  }
  const s = data || {}
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <SummaryCard icon={Users} label="Total patients" value={s.total_patients} />
      <SummaryCard icon={UserCheck} label="Active" value={s.active} tone="good" />
      <SummaryCard icon={UserMinus} label="Inactive" value={s.inactive} tone="warn" />
      <SummaryCard icon={HeartPulse} label="Deceased" value={s.deceased} tone="bad" />
      <SummaryCard icon={Activity} label="New this week" value={s.new_this_week} />
      <SummaryCard icon={TrendingUp} label="New this month" value={s.new_this_month} />
    </div>
  )
}

function IntakeTrendChart() {
  const [period, setPeriod] = useState('month')
  const { data, loading, error, reload } = useAsync(
    () => analyticsApi.intakeTrend({ period }),
    [period],
  )
  const series = data?.series || []
  const accent = accentColor()

  return (
    <ChartCard
      id="intake-trend-chart"
      title="Patient intake trend"
      subtitle="New patients created over time"
      action={
        <select
          className="input !h-8 !w-auto !py-0 text-xs"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          aria-label="Trend period"
        >
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      }
    >
      <ChartBody loading={loading} error={error} isEmpty={series.length === 0} onRetry={reload}>
        <LineChart data={series} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="bucket" tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="count"
            name="New patients"
            stroke={accent}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ChartBody>
    </ChartCard>
  )
}

function OriginBreakdownChart() {
  const { data, loading, error, reload } = useAsync(() => analyticsApi.originBreakdown(), [])
  const rows = (data?.breakdown || []).map((r) => ({
    name: r.origin_type === 'none' ? 'Unspecified' : (ORIGIN_TYPE_LABELS[r.origin_type] || r.origin_type),
    value: r.count,
  }))

  return (
    <ChartCard id="origin-breakdown-chart" title="Referral origin" subtitle="Where patients came from">
      <ChartBody loading={loading} error={error} isEmpty={rows.length === 0} onRetry={reload}>
        <PieChart>
          <Pie
            data={rows}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={90}
            label={(e) => `${e.name} (${e.value})`}
            labelLine={false}
          >
            {rows.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ChartBody>
    </ChartCard>
  )
}

function TopSourcesChart() {
  const { data, loading, error, reload } = useAsync(() => analyticsApi.topSources({ limit: 10 }), [])
  const rows = data?.sources || []
  const accent = accentColor()

  return (
    <ChartCard id="top-sources-chart" title="Top referral sources" subtitle="Highest-volume sources">
      <ChartBody loading={loading} error={error} isEmpty={rows.length === 0} onRetry={reload}>
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <YAxis
            type="category"
            dataKey="source"
            width={120}
            tick={{ fontSize: 11 }}
            stroke="#9ca3af"
          />
          <Tooltip />
          <Bar dataKey="count" name="Patients" fill={accent} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartBody>
    </ChartCard>
  )
}

function AgeBandsChart() {
  const [activeView, setActiveView] = useState('graph')
  const { data, loading, error, reload } = useAsync(() => analyticsApi.demographics(), [])
  const bands = data?.age_bands || []
  // Empty only when every band is zero (the backend always returns the full
  // scheme zero-filled, so length alone isn't a reliable empty signal).
  const isEmpty = bands.length === 0 || bands.every((b) => !b.count)
  const accent = accentColor()

  return (
    <ChartCard
      id={activeView === 'graph' ? 'age-bands-chart' : undefined}
      title="Age distribution"
      subtitle={activeView === 'graph' ? 'WHO life-course bands' : 'Geospatial distribution of patients by age cohort'}
      action={
        <div className="inline-flex rounded-lg border border-border bg-muted/60 p-0.5">
          <button
            onClick={() => setActiveView('graph')}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all duration-200 ${
              activeView === 'graph'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Graph</span>
          </button>
          <button
            onClick={() => setActiveView('map')}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all duration-200 ${
              activeView === 'map'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MapIcon className="h-3.5 w-3.5" />
            <span>Map</span>
          </button>
        </div>
      }
    >
      {activeView === 'graph' ? (
        <ChartBody loading={loading} error={error} isEmpty={isEmpty} onRetry={reload}>
          <BarChart data={bands} margin={{ top: 8, right: 12, left: -12, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="band"
              tick={{ fontSize: 10 }}
              stroke="#9ca3af"
              interval={0}
              angle={-30}
              textAnchor="end"
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#9ca3af" />
            <Tooltip />
            <Bar dataKey="count" name="Patients" fill={accent} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartBody>
      ) : (
        <div className="h-[280px]">
          <PatientAgeMap />
        </div>
      )}
    </ChartCard>
  )
}

function GenderChart() {
  const [activeView, setActiveView] = useState('graph')
  const { data, loading, error, reload } = useAsync(() => analyticsApi.demographics(), [])
  const rows = (data?.gender || []).map((r) => ({ name: r.gender, value: r.count }))

  return (
    <ChartCard
      id={activeView === 'graph' ? 'gender-chart' : undefined}
      title="Gender split"
      subtitle={activeView === 'graph' ? 'Distribution by gender' : 'Geospatial distribution of patients by gender'}
      action={
        <div className="inline-flex rounded-lg border border-border bg-muted/60 p-0.5">
          <button
            onClick={() => setActiveView('graph')}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all duration-200 ${
              activeView === 'graph'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Graph</span>
          </button>
          <button
            onClick={() => setActiveView('map')}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all duration-200 ${
              activeView === 'map'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MapIcon className="h-3.5 w-3.5" />
            <span>Map</span>
          </button>
        </div>
      }
    >
      {activeView === 'graph' ? (
        <ChartBody loading={loading} error={error} isEmpty={rows.length === 0} onRetry={reload}>
          <PieChart>
            <Pie
              data={rows}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={90}
              label={(e) => `${e.name} (${e.value})`}
              labelLine={false}
            >
              {rows.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ChartBody>
      ) : (
        <div className="h-[280px]">
          <PatientGenderMap />
        </div>
      )}
    </ChartCard>
  )
}

function GeographyChart() {
  const [activeView, setActiveView] = useState('graph')
  const { data, loading, error, reload } = useAsync(() => analyticsApi.geography(), [])
  const rows = data?.clusters || []
  const accent = accentColor()

  return (
    <ChartCard
      id={activeView === 'graph' ? 'geography-chart' : undefined}
      title="Geography"
      subtitle={activeView === 'graph' ? 'Patients by geographic cluster' : 'Geospatial distribution of patients'}
      action={
        <div className="inline-flex rounded-lg border border-border bg-muted/60 p-0.5">
          <button
            onClick={() => setActiveView('graph')}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all duration-200 ${
              activeView === 'graph'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Graph</span>
          </button>
          <button
            onClick={() => setActiveView('map')}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all duration-200 ${
              activeView === 'map'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MapIcon className="h-3.5 w-3.5" />
            <span>Map</span>
          </button>
        </div>
      }
    >
      {activeView === 'graph' ? (
        <ChartBody loading={loading} error={error} isEmpty={rows.length === 0} onRetry={reload}>
          <BarChart data={rows} margin={{ top: 8, right: 12, left: -12, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="cluster" tick={{ fontSize: 11 }} stroke="#9ca3af" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#9ca3af" />
            <Tooltip />
            <Bar dataKey="count" name="Patients" fill={accent} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartBody>
      ) : (
        <div className="h-[280px]">
          <PatientLocationsMap />
        </div>
      )}
    </ChartCard>
  )
}

// Platform-admin-only cross-org comparison (god view).
function ByOrgChart() {
  const { data, loading, error, reload } = useAsync(() => analyticsApi.byOrg(), [])
  const rows = data?.organizations || []

  return (
    <ChartCard
      id="by-org-chart"
      title="Patients by organization"
      subtitle="Cross-organization comparison (platform admin)"
      className="lg:col-span-2"
    >
      <ChartBody
        loading={loading}
        error={error}
        isEmpty={rows.length === 0}
        onRetry={reload}
        height={Math.max(280, rows.length * 34)}
      >
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <YAxis
            type="category"
            dataKey="code"
            width={120}
            tick={{ fontSize: 11 }}
            stroke="#9ca3af"
          />
          <Tooltip
            formatter={(value) => [value, 'Patients']}
            labelFormatter={(code) => {
              const org = rows.find((r) => r.code === code)
              return org ? `${org.name} (${org.code})` : code
            }}
          />
          <Bar dataKey="count" name="Patients" radius={[0, 4, 4, 0]}>
            {rows.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ChartBody>
    </ChartCard>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { isGodView, isPlatformAdmin, needsOrgSelection, branding } = useOrg()
  const [activeTab, setActiveTab] = useState('patient')

  // A regular user with multiple orgs and none chosen can't make scoped calls —
  // mirror the rest of the portal and prompt them to pick an org first.
  if (needsOrgSelection) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="alert-info">
          Select an organization to view its dashboard.
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'patient', label: 'Patient', icon: Users },
    { id: 'vitals', label: 'Vitals', icon: Thermometer },
    { id: 'diseases', label: 'Diseases', icon: Activity },
    { id: 'location', label: 'Real-time Location', icon: MapIcon },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {isGodView
            ? 'Analytics across all organizations.'
            : `Analytics for ${branding.displayName}.`}
        </p>
      </div>

      {/* Tabs Navigation */}
      <div className="inline-flex flex-wrap rounded-lg border border-border bg-card p-1 max-w-full">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-neutral-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-950'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {activeTab === 'patient' && (
        <>
          <SummaryCards />

          <IntakeTrendChart />

          <PalliativeOutcomes />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <OriginBreakdownChart />
            <TopSourcesChart />
            <AgeBandsChart />
            <GenderChart />
            <GeographyChart />
            {/* by-org is platform-admin only; show in god view (cross-org) */}
            {isPlatformAdmin && isGodView && <ByOrgChart />}
          </div>
        </>
      )}

      {activeTab === 'vitals' && <VitalsTabContent />}

      {activeTab === 'diseases' && <DiseasesTabContent />}

      {activeTab === 'location' && <RealTimeLocationTab />}

    </div>
  )
}

function VitalsKpiCard({ title, value, subtitle, icon: Icon, gradient }) {
  return (
    <div className={`card bg-gradient-to-br ${gradient} border-opacity-20 flex flex-col justify-between p-5 relative overflow-hidden`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">{title}</span>
        <Icon className="h-4 w-4 text-muted-foreground/70" />
      </div>
      <div className="mt-3">
        <div className="text-3xl font-extrabold text-foreground tabular-nums">
          {value}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 font-medium">{subtitle}</p>
      </div>
    </div>
  )
}

function VitalsTabContent() {
  const [selectedVital, setSelectedVital] = useState('bp_systolic')
  const [vitalsView, setVitalsView] = useState('graph')

  const { data: vitalsData, loading: vitalsLoading, error: vitalsError, reload: reloadVitals } = useAsync(
    () => analyticsApi.vitalsSummary(),
    []
  )

  const { data: deathsData, loading: deathsLoading, error: deathsError, reload: reloadDeaths } = useAsync(
    () => analyticsApi.deaths({ windowDays: 30 }),
    []
  )

  const { data: distData, loading: distLoading, error: distError, reload: reloadDist } = useAsync(
    () => analyticsApi.vitalsDistribution(),
    []
  )

  const loading = vitalsLoading || deathsLoading || distLoading
  const error = vitalsError || deathsError || distError
  const reload = () => {
    reloadVitals()
    reloadDeaths()
    reloadDist()
  }

  if (loading) {
    return (
      <div className="card">
        <LoadingState label="Loading vitals…" className="!py-8" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="card">
        <ErrorState message={error} onRetry={reload} />
      </div>
    )
  }

  const totalPatients = vitalsData?.data?.total_patients_with_vitals ?? 0
  const deathsCount = deathsData?.deaths_in_window ?? 0
  const avgVisits = deathsData?.avg_visits_before_death != null
    ? Number(deathsData.avg_visits_before_death).toFixed(1)
    : '—'

  const VITAL_LABELS = {
    bp_systolic: 'BP Systolic',
    bp_diastolic: 'BP Diastolic',
    pr: 'Pulse Rate',
    spo2: 'SpO2',
    temperature: 'Temperature',
    rr: 'Resp. Rate',
    grbs: 'GRBS',
  }

  const distChartData = distData?.data?.[selectedVital]?.buckets || []
  const currentDistInfo = distData?.data?.[selectedVital]

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <VitalsKpiCard
          title="Patients Tracked"
          value={totalPatients}
          subtitle="With initial + follow-up vitals"
          icon={Users}
          gradient="from-blue-50/50 to-indigo-50/50 border-blue-100/50 dark:from-blue-950/20 dark:to-indigo-950/20 dark:border-blue-900/30"
        />
        <VitalsKpiCard
          title="Deaths (last 30 days)"
          value={deathsCount}
          subtitle="Palliative care outcomes"
          icon={Heart}
          gradient="from-rose-50/60 to-pink-50/60 border-rose-100/50 dark:from-rose-950/20 dark:to-pink-950/20 dark:border-rose-900/30"
        />
        <VitalsKpiCard
          title="Avg Visits Before Death"
          value={avgVisits}
          subtitle="Team visits per deceased patient"
          icon={Activity}
          gradient="from-amber-50/60 to-orange-50/60 border-amber-100/50 dark:from-amber-950/20 dark:to-orange-950/20 dark:border-amber-900/30"
        />
      </div>

      {/* Vitals Distribution Card */}
      <div className="card" id="vitals-distribution-chart">
        <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              Vitals Distribution (Latest Visit)
            </h2>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {Object.entries(VITAL_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSelectedVital(key)}
                  className={`rounded px-2.5 py-1 text-[11px] font-semibold border transition-all duration-150 ${
                    selectedVital === key
                      ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-zinc-100 dark:text-zinc-950 dark:border-zinc-100'
                      : 'text-muted-foreground border-muted-foreground/20 hover:text-foreground hover:bg-muted/40'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Graph/Map View Switcher */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            {vitalsView === 'graph' && (
              <button
                onClick={() => exportChartAsSvg('vitals-distribution-chart', `vitals-${selectedVital}-distribution.svg`)}
                className="btn btn-secondary !h-8 !w-8 !p-0 flex items-center justify-center text-muted-foreground hover:text-foreground"
                title="Download Chart SVG"
              >
                <Download className="h-4 w-4" />
              </button>
            )}
            <div className="inline-flex rounded-lg bg-secondary/85 p-0.5 border border-muted-foreground/10">
              <button
                onClick={() => setVitalsView('graph')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                  vitalsView === 'graph'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Graph</span>
              </button>
              <button
                onClick={() => setVitalsView('map')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                  vitalsView === 'map'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <MapIcon className="h-3.5 w-3.5" />
                <span>Map</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        {vitalsView === 'graph' ? (
          <div className="flex flex-col">
            <ChartBody loading={false} error={null} isEmpty={distChartData.length === 0} height={280}>
              <BarChart data={distChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card-background)',
                    borderColor: 'var(--border-color)',
                  }}
                  itemStyle={{ color: 'var(--foreground)' }}
                  labelStyle={{ fontWeight: 'bold' }}
                />
                <Bar dataKey="count" fill={accentColor()} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartBody>

            {currentDistInfo && (
              <p className="text-xs text-muted-foreground mt-4 text-center">
                Normal range:{' '}
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {currentDistInfo.normal_range}
                </span>{' '}
                {currentDistInfo.unit} | {currentDistInfo.total} patients
              </p>
            )}
          </div>
        ) : (
          <div className="h-[350px]">
            <PatientVitalsMap selectedVital={selectedVital} />
          </div>
        )}
      </div>
    </div>
  )
}

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

function DiseasesTabContent() {
  const [chartLayout, setChartLayout] = useState('all-scrollable') // 'top-5' | 'all-scrollable'

  const { data: diagnosesRes, loading: diagnosesLoading, error: diagnosesError, reload: reloadDiagnoses } = useAsync(
    () => analyticsApi.diseasesDiagnoses(),
    []
  )

  const { data: complaintsRes, loading: complaintsLoading, error: complaintsError, reload: reloadComplaints } = useAsync(
    () => analyticsApi.diseasesComplaints(),
    []
  )

  const loading = diagnosesLoading || complaintsLoading
  const error = diagnosesError || complaintsError
  const reload = () => {
    reloadDiagnoses()
    reloadComplaints()
  }

  if (loading) {
    return (
      <div className="card">
        <LoadingState label="Loading disease analytics…" className="!py-8" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="card">
        <ErrorState message={error} onRetry={reload} />
      </div>
    )
  }

  const PRESET_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6']
  const diagStats = diagnosesRes?.stats || []
  const compStats = complaintsRes?.stats || []

  return (
    <div className="space-y-6">
      {/* Layout Presentation Toggle Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center card p-4 gap-4">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold text-foreground">Disease Chart View Option</h3>
          <p className="text-xs text-muted-foreground">Select how to display the diagnoses and chief complaints distribution</p>
        </div>
        <div className="inline-flex p-0.5 bg-muted/60 rounded-lg border border-border">
          <button
            onClick={() => setChartLayout('top-5')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
              chartLayout === 'top-5'
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Top 5 + Others
          </button>
          <button
            onClick={() => setChartLayout('all-scrollable')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
              chartLayout === 'all-scrollable'
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All (Scrollable List)
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Primary Diagnoses Card */}
        <div className="card" id="primary-diagnoses-chart">
          <div className="mb-4 flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-indigo-500" />
                Primary Diagnosis Distribution
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Distribution of patient clinical diagnoses recorded in the profile
              </p>
            </div>
            {diagStats.length > 0 && (
              <button
                onClick={() => exportChartAsSvg('primary-diagnoses-chart', 'primary-diagnoses-distribution.svg')}
                className="btn btn-secondary !h-8 !w-8 !p-0 flex items-center justify-center text-muted-foreground hover:text-foreground"
                title="Download Chart SVG"
              >
                <Download className="h-4 w-4" />
              </button>
            )}
          </div>
          
          <div className="pt-2">
            {diagStats.length > 0 ? (
              chartLayout === 'all-scrollable' ? (
                // Scrollable container for all diagnoses
                <div className="h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  <ResponsiveContainer width="100%" height={Math.max(300, diagStats.length * 38)}>
                    <BarChart data={diagStats} layout="vertical" margin={{ left: 5, right: 20, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 10 }}
                        width={130}
                      />
                      <Tooltip />
                      <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]}>
                        {diagStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PRESET_COLORS[index % PRESET_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                // Clean Top 5 list
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getTop5WithOthers(diagStats)} layout="vertical" margin={{ left: 5, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      width={130}
                    />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]}>
                      {getTop5WithOthers(diagStats).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PRESET_COLORS[index % PRESET_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No diagnosis data</p>
            )}
          </div>
        </div>

        {/* Chief Complaints Card */}
        <div className="card" id="chief-complaints-chart">
          <div className="mb-4 flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-500" />
                Chief Complaints (Latest Visits)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Distribution of patient symptoms/complaints reported in the latest encounter
              </p>
            </div>
            {compStats.length > 0 && (
              <button
                onClick={() => exportChartAsSvg('chief-complaints-chart', 'chief-complaints-distribution.svg')}
                className="btn btn-secondary !h-8 !w-8 !p-0 flex items-center justify-center text-muted-foreground hover:text-foreground"
                title="Download Chart SVG"
              >
                <Download className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="pt-2">
            {compStats.length > 0 ? (
              chartLayout === 'all-scrollable' ? (
                // Scrollable container for all complaints
                <div className="h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  <ResponsiveContainer width="100%" height={Math.max(300, compStats.length * 38)}>
                    <BarChart data={compStats} layout="vertical" margin={{ left: 5, right: 20, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 10 }}
                        width={130}
                      />
                      <Tooltip />
                      <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]}>
                        {compStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PRESET_COLORS[index % PRESET_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                // Clean Top 5 list
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getTop5WithOthers(compStats)} layout="vertical" margin={{ left: 5, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      width={130}
                    />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]}>
                      {getTop5WithOthers(compStats).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PRESET_COLORS[index % PRESET_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No complaint data</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
