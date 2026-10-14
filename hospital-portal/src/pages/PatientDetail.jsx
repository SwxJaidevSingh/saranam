/**
 * Patient detail — org-scoped, tabbed view that mirrors the main app's patient
 * detail (frontend/src/pages/patients/PatientDetail + tabs/OverviewTab) but in
 * the portal's Tailwind design system and repointed to the portal client.
 *
 * Header: avatar + name + clinical status chips (Alive & Active / Inactive /
 * Deceased, BSC / N-BSC, Zone, Priority). Per portal rules the UHID chip and the
 * KAGBAKMIO / homecare-code chip from the main app are deliberately HIDDEN.
 *
 * Tabs:
 *   - Demographics        (this file — view + inline edit via PUT /patients/:id)
 *   - Care Circle         (this file — caregiver + decision maker, same PUT)
 *   - Body Map            (Agent C: components/patient-detail/BodyMapTab)
 *   - Initial Assessment  (Agent C: components/patient-detail/InitialAssessmentTab)
 *   - AI Patient Summary  (this file — GET /portal/patients/:id/ai-summary)
 *
 * Data: GET /portal/patients/:id returns demographics + care-circle + origin +
 * clinical status in one payload. A write role (org_data_entry / org_admin /
 * platform_admin) is required to edit; viewers see read-only sections.
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, User } from 'lucide-react'
import { patientsApi } from '../api/patients'
import { useOrg } from '../context/OrgContext'
import { ErrorState, LoadingState } from '../components/ui/States'
import { parseApiError } from '../utils/apiError'

import DemographicsSection from '../components/patient-detail/DemographicsSection'
import CareCircleSection from '../components/patient-detail/CareCircleSection'
import AiSummaryTab from '../components/patient-detail/AiSummaryTab'
// Clinical tabs are owned by Agent C — imported, not stubbed.
import BodyMapTab from '../components/patient-detail/BodyMapTab'
import InitialAssessmentTab from '../components/patient-detail/InitialAssessmentTab'

const TABS = [
  { key: 'demographics', label: 'Demographics' },
  { key: 'care-circle', label: 'Care Circle' },
  { key: 'body-map', label: 'Body Map' },
  { key: 'initial-assessment', label: 'Initial Assessment (Baseline)' },
  { key: 'ai-summary', label: 'AI Patient Summary' },
]

// Roles allowed to edit patient data in the portal (mirrors WRITE_ROLES on the
// backend). Viewers get read-only sections.
const WRITE_ROLES = ['org_data_entry', 'org_admin', 'platform_admin']

function StatusChips({ patient }) {
  // Status / BSC / Zone / Priority chips. UHID + homecare-code chips are
  // intentionally omitted in the portal.
  const chips = []

  if (patient.is_deceased) {
    chips.push(
      <span key="status" className="badge bg-neutral-800 text-white">
        Deceased
        {patient.date_of_death
          ? ` · ${new Date(patient.date_of_death).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
          : ''}
      </span>,
    )
  } else if (patient.care_status === 'inactive') {
    chips.push(
      <span key="status" className="badge bg-neutral-200 text-neutral-900">
        Alive &amp; Inactive
      </span>,
    )
  } else {
    chips.push(
      <span key="status" className="badge-success">
        Alive &amp; Active
      </span>,
    )
  }

  if (patient.bsc_status != null || patient.is_onco != null) {
    chips.push(
      <span
        key="bsc"
        className={patient.bsc_status ? 'badge-success' : 'badge-gray'}
      >
        {patient.bsc_status ? 'BSC' : 'N-BSC'}
      </span>,
    )
  }

  if (patient.geographic_cluster) {
    chips.push(
      <span key="zone" className="badge bg-primary-100 text-primary-800">
        {patient.geographic_cluster}
      </span>,
    )
  }

  if (patient.clinical_complexity && patient.clinical_complexity !== 'not_yet_determined') {
    const level = patient.clinical_complexity
    const cls =
      level === 'high'
        ? 'badge bg-danger-100 text-danger-800'
        : level === 'medium'
          ? 'badge bg-warning-100 text-warning-800'
          : 'badge-gray'
    chips.push(
      <span key="priority" className={cls}>
        Priority: {level.charAt(0).toUpperCase() + level.slice(1)}
      </span>,
    )
  }

  return <div className="mt-2 flex flex-wrap gap-1.5">{chips}</div>
}

export default function PatientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { roleInOrg, isPlatformAdmin } = useOrg()

  const [patient, setPatient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('demographics')

  const editable = isPlatformAdmin || WRITE_ROLES.includes(roleInOrg)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await patientsApi.get(id)
      setPatient(data)
    } catch (err) {
      const { message, status } = parseApiError(err, 'Failed to load patient')
      setError(status === 404 ? 'Patient not found in your organization.' : message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <LoadingState label="Loading patient…" />
  if (error) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          className="btn-ghost p-2"
          onClick={() => navigate('/patients')}
          aria-label="Back to list"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <ErrorState message={error} onRetry={load} />
      </div>
    )
  }

  const age =
    patient.age ??
    (patient.date_of_birth
      ? Math.floor((Date.now() - new Date(patient.date_of_birth)) / 31557600000)
      : null)

  const subtitle = [patient.gender, age != null ? `${age} years` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <button
        type="button"
        className="btn-ghost -ml-2 px-2 py-1.5 text-sm"
        onClick={() => navigate('/patients')}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Patients
      </button>

      {/* Header card */}
      <div className="card bg-gradient-to-br from-primary-50/60 to-transparent">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white">
            <User className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold leading-tight text-foreground">
              {patient.full_name}
            </h1>
            {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
            <StatusChips patient={patient} />
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-border">
        <nav className="-mb-px flex flex-wrap gap-1" aria-label="Patient sections">
          {TABS.map((t) => {
            const active = t.key === activeTab
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={[
                  'whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
                  active
                    ? 'border-brand text-foreground'
                    : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
                ].join(' ')}
                style={active ? { borderColor: 'var(--accent-color)' } : undefined}
                aria-current={active ? 'page' : undefined}
              >
                {t.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'demographics' && (
          <DemographicsSection patient={patient} editable={editable} onSaved={load} />
        )}
        {activeTab === 'care-circle' && (
          <CareCircleSection patient={patient} editable={editable} onSaved={load} />
        )}
        {activeTab === 'body-map' && <BodyMapTab patientId={id} editable={editable} />}
        {activeTab === 'initial-assessment' && (
          <InitialAssessmentTab patientId={id} editable={editable} />
        )}
        {activeTab === 'ai-summary' && <AiSummaryTab patientId={id} patient={patient} />}
      </div>
    </div>
  )
}
