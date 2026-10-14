import React, { useState, useEffect } from 'react'
import { Download, LayoutGrid, Map as MapIcon, RefreshCw } from 'lucide-react'
import { exportChartAsSvg } from '../../utils/chartExport'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { analyticsApi } from '../../api/analytics'
import DeceasedPatientsMap from './DeceasedPatientsMap'

// Read the live per-org accent so charts respect branding.
function accentColor() {
  if (typeof window === 'undefined') return '#0284c7'
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent-color')
    .trim()
  return v || '#0284c7'
}

export default function PalliativeOutcomes() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deathsView, setDeathsView] = useState('graph') // 'graph' or 'map'

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await analyticsApi.deaths({ windowDays: 30 })
      setData(res)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load palliative outcomes data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const accent = accentColor()

  if (loading) {
    return (
      <div className="card flex h-[350px] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading palliative outcomes…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card flex h-[350px] flex-col items-center justify-center gap-4">
        <p className="text-sm text-red-600">{error}</p>
        <button className="btn btn-secondary" onClick={fetchData}>
          Retry
        </button>
      </div>
    )
  }

  const { deaths_in_window = 0, avg_visits_before_death = 0, deceased_patients = [], deaths_by_month = [] } = data || {}

  return (
    <div className="card" id="palliative-outcomes-chart">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Deaths Over Time & Location</h2>
          <p className="text-xs text-muted-foreground">
            {deathsView === 'graph'
              ? 'Monthly deaths trend (last 12 months)'
              : 'Geospatial distribution of deceased patients'}
          </p>
        </div>

        {/* Custom switcher */}
        <div className="flex items-center gap-2">
          {deathsView === 'graph' && (
            <button
              onClick={() => exportChartAsSvg('palliative-outcomes-chart', 'palliative-outcomes.svg')}
              className="btn btn-secondary !h-8 !w-8 !p-0 flex items-center justify-center text-muted-foreground hover:text-foreground"
              title="Download Chart SVG"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
          <div className="inline-flex rounded-lg border border-border bg-muted/60 p-1">
            <button
              onClick={() => setDeathsView('graph')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                deathsView === 'graph'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Graph</span>
            </button>
            <button
              onClick={() => setDeathsView('map')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                deathsView === 'map'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <MapIcon className="h-3.5 w-3.5" />
              <span>Map</span>
            </button>
          </div>
        </div>
      </div>

      {/* Chart or Map body */}
      <div className="h-[300px] w-full">
        {deathsView === 'graph' ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={deaths_by_month} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="count"
                name="Deaths"
                stroke="#ef4444"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#ef4444' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full">
            <DeceasedPatientsMap deceasedPatients={deceased_patients} />
          </div>
        )}
      </div>
    </div>
  )
}
