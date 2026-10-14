/**
 * Patients list — GET /portal/patients with search (q) + pagination.
 * Columns: name, UHID, origin, created date. Row -> detail.
 *
 * Search is debounced and requires >= 2 chars (matches the backend behaviour:
 * shorter queries are ignored server-side).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, UserPlus, Users } from 'lucide-react'
import { patientsApi } from '../api/patients'
import { ORIGIN_TYPE_LABELS } from '../constants/origin'
import { formatDate, dash } from '../utils/format'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States'
import Pagination from '../components/ui/Pagination'
import AddPatient from './AddPatient'

const PER_PAGE = 20

export default function PatientsList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const debounceRef = useRef(null)
  const [showAdd, setShowAdd] = useState(false)

  const fetchPage = useCallback(async (q, p) => {
    setLoading(true)
    setError(null)
    try {
      const res = await patientsApi.list({ q, page: p, perPage: PER_PAGE })
      setData(res)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load patients')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPage('', 1)
  }, [fetchPage])

  const onSearchChange = (e) => {
    const value = e.target.value
    setSearch(value)
    setPage(1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchPage(value.trim(), 1)
    }, 350)
  }

  const onPageChange = (p) => {
    setPage(p)
    fetchPage(search.trim(), p)
  }

  const patients = data?.patients || []

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Patients</h1>
          <p className="text-sm text-muted-foreground">
            Patients within your active organization.
          </p>
        </div>
        <button type="button" className="btn-brand" onClick={() => setShowAdd(true)}>
          <UserPlus className="h-4 w-4" />
          Add patient
        </button>
      </div>

      <div className="relative max-w-md">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="h-4 w-4 text-muted-foreground/70" />
        </span>
        <input
          type="search"
          className="input pl-10"
          placeholder="Search by name, ABHA address or UHID…"
          value={search}
          onChange={onSearchChange}
          aria-label="Search patients"
        />
      </div>

      <div className="card overflow-hidden p-0">
        {loading ? (
          <LoadingState label="Loading patients…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => fetchPage(search.trim(), page)} />
        ) : patients.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search ? 'No matching patients' : 'No patients yet'}
            message={
              search
                ? 'Try a different name, ABHA address, or UHID.'
                : 'Add your first patient to get started.'
            }
            action={
              !search && (
                <button type="button" className="btn-brand" onClick={() => setShowAdd(true)}>
                  <UserPlus className="h-4 w-4" />
                  Add patient
                </button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>UHID</th>
                  <th>Origin</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/patients/${p.id}`)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') navigate(`/patients/${p.id}`)
                    }}
                  >
                    <td>
                      <div className="font-medium text-foreground">{p.full_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[p.gender, p.age != null ? `${p.age} yrs` : null, p.city]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </div>
                    </td>
                    <td className="font-mono text-xs">
                      {dash(p.uhid || p.hospital_uhid || p.homecare_code)}
                    </td>
                    <td>
                      {p.origin_type ? (
                        <span className="badge-gray">
                          {ORIGIN_TYPE_LABELS[p.origin_type] || p.origin_type}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="text-muted-foreground">{formatDate(p.created_at)}</td>
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

      <AddPatient
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => {
          setShowAdd(false)
          fetchPage(search.trim(), page)
        }}
      />
    </div>
  )
}
