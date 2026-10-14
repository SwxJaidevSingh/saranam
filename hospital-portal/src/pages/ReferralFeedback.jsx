/**
 * Referral Feedback (§5) — outcomes for patients this organization referred.
 *
 *   GET /portal/referral-feedback?status=&page=&per_page=
 *     -> { counts: { total, active, inactive, deceased }, patients: [...],
 *          total, page, per_page, total_pages }
 *     403 { error: 'feedback_disabled' } when the org's toggle is off.
 *
 * Summary cards (total / active / inactive / deceased) double as a status filter:
 * clicking a card filters the table to that care status. When the feature is
 * disabled for the org we show a friendly empty state instead of an error.
 *
 * A platform admin in "All organizations" (god) view has no concrete org to scope
 * to — we ask them to pick one from the switcher first.
 */
import { useCallback, useEffect, useState } from 'react'
import { HeartPulse, MessageSquareText, RefreshCw } from 'lucide-react'
import { referralFeedbackApi } from '../api/orgSettings'
import { ORIGIN_TYPE_LABELS } from '../constants/origin'
import { useOrg } from '../context/OrgContext'
import { parseApiError } from '../utils/apiError'
import { formatDate, formatDateTime, dash } from '../utils/format'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States'
import Pagination from '../components/ui/Pagination'

const PER_PAGE = 20

// Filter tabs / summary cards. `key` is null for "all" (no status param).
const FILTERS = [
  { key: null, label: 'Total', countKey: 'total' },
  { key: 'active', label: 'Active', countKey: 'active' },
  { key: 'inactive', label: 'Inactive', countKey: 'inactive' },
  { key: 'deceased', label: 'Deceased', countKey: 'deceased' },
]

const CARE_STATUS_BADGE = {
  active: 'badge-success',
  inactive: 'badge-gray',
  deceased: 'badge bg-danger-100 text-danger-800',
}

function CareStatusBadge({ status }) {
  if (!status) return <span className="text-muted-foreground">—</span>
  const cls = CARE_STATUS_BADGE[status] || 'badge-gray'
  const label = status.charAt(0).toUpperCase() + status.slice(1)
  return <span className={cls}>{label}</span>
}

export default function ReferralFeedback() {
  const { hasActiveOrg, isGodView, needsOrgSelection } = useOrg()

  const [status, setStatus] = useState(null)
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // True when the backend reports the feature toggle is off for this org (403).
  const [disabled, setDisabled] = useState(false)

  const fetchPage = useCallback(async (s, p) => {
    setLoading(true)
    setError(null)
    setDisabled(false)
    try {
      const res = await referralFeedbackApi.list({ status: s || '', page: p, perPage: PER_PAGE })
      setData(res)
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.error === 'feedback_disabled') {
        setDisabled(true)
      } else {
        const { message } = parseApiError(err, 'Failed to load referral feedback')
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (hasActiveOrg) fetchPage(null, 1)
    else setLoading(false)
  }, [hasActiveOrg, fetchPage])

  const onFilter = (key) => {
    setStatus(key)
    setPage(1)
    fetchPage(key, 1)
  }

  const onPageChange = (p) => {
    setPage(p)
    fetchPage(status, p)
  }

  const counts = data?.counts || {}
  const patients = data?.patients || []

  const header = (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-foreground">Referral feedback</h1>
        <p className="text-sm text-muted-foreground">
          Care outcomes for patients your organization referred.
        </p>
      </div>
      {hasActiveOrg && !disabled && (
        <button
          type="button"
          className="btn-outline"
          onClick={() => fetchPage(status, page)}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      )}
    </div>
  )

  // God view / no concrete org selected.
  if (needsOrgSelection || (isGodView && !hasActiveOrg)) {
    return (
      <div className="space-y-5">
        {header}
        <div className="alert-warning">
          {isGodView
            ? 'You are in “All organizations” view. Select a specific organization from the switcher to view its referral feedback.'
            : 'Select an organization to view its referral feedback.'}
        </div>
      </div>
    )
  }

  // Feature toggle off for this org — friendly empty state, no summary cards.
  if (disabled) {
    return (
      <div className="space-y-5">
        {header}
        <div className="card">
          <EmptyState
            icon={MessageSquareText}
            title="Referral feedback isn't enabled"
            message="Referral feedback isn't enabled for your organization — contact your Saranam administrator."
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {header}

      {/* Summary cards double as a status filter. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FILTERS.map((f) => {
          const isActive = status === f.key
          const value = counts[f.countKey]
          return (
            <button
              key={f.label}
              type="button"
              onClick={() => onFilter(f.key)}
              aria-pressed={isActive}
              className={[
                'card cursor-pointer p-4 text-left transition-shadow hover:shadow-medium focus:outline-none focus:ring-2 focus:ring-ring',
                isActive ? 'ring-2 ring-brand' : '',
              ].join(' ')}
            >
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {f.label}
              </div>
              <div className="mt-1 text-2xl font-bold text-foreground">
                {value == null ? '—' : value}
              </div>
            </button>
          )
        })}
      </div>

      <div className="card overflow-hidden p-0">
        {loading ? (
          <LoadingState label="Loading referral feedback…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => fetchPage(status, page)} />
        ) : patients.length === 0 ? (
          <EmptyState
            icon={HeartPulse}
            title={status ? 'No patients with this status' : 'No referred patients yet'}
            message={
              status
                ? 'Try a different status filter.'
                : 'Patients your organization refers will appear here with their care outcomes.'
            }
          />
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Care status</th>
                  <th>Deceased</th>
                  <th>Last update</th>
                  <th>Origin</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.id}>
                    <td className="font-medium text-foreground">{dash(p.full_name)}</td>
                    <td>
                      <CareStatusBadge status={p.care_status} />
                    </td>
                    <td>
                      {p.is_deceased ? (
                        <span className="badge bg-danger-100 text-danger-800">
                          Deceased
                          {p.date_of_death ? ` · ${formatDate(p.date_of_death)}` : ''}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">No</span>
                      )}
                    </td>
                    <td className="text-muted-foreground">{formatDateTime(p.last_update)}</td>
                    <td>
                      {p.origin_type ? (
                        <span className="badge-gray">
                          {ORIGIN_TYPE_LABELS[p.origin_type] || p.origin_type}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && !error && patients.length > 0 && (
        <Pagination
          page={data.page}
          totalPages={data.total_pages}
          total={data.total}
          perPage={data.per_page}
          onChange={onPageChange}
        />
      )}
    </div>
  )
}
