/**
 * Demographics section of the patient detail page (Agent B owns this).
 *
 * View mode: read-only demographics + referral origin + record metadata,
 * mirroring the main app's OverviewTab demographics block. Edit mode (write
 * roles only): the same react-hook-form used at intake, prefilled, saved via
 * PUT /portal/patients/:id (demographics + nested origin).
 *
 * NOTE: UHID / hospital-UHID / homecare-code are intentionally not surfaced as
 * header chips in the portal; the hospital UHID remains an editable demographic
 * field here because it is org-provided data, not the internal homecare UHID.
 */
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Loader2, Pencil } from 'lucide-react'
import { toast } from 'react-toastify'
import { patientsApi } from '../../api/patients'
import DemographicsFields from '../forms/DemographicsFields'
import OriginFields from '../forms/OriginFields'
import { ORIGIN_TYPE_LABELS } from '../../constants/origin'
import { buildUpdatePayload, patientToFormValues } from '../../utils/patientPayload'
import { parseApiError, toFormFieldName } from '../../utils/apiError'
import { dash, formatDate, formatDateTime, extractPhone } from '../../utils/format'

function Row({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
      <dt className="w-48 shrink-0 text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  )
}

export default function DemographicsSection({ patient, editable, onSaved }) {
  const [editing, setEditing] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: patientToFormValues(patient) })

  const originType = watch('origin_type')

  const startEdit = () => {
    reset(patientToFormValues(patient))
    setEditing(true)
  }

  const cancelEdit = () => {
    reset(patientToFormValues(patient))
    setEditing(false)
  }

  const onSave = async (values) => {
    try {
      const payload = buildUpdatePayload(values)
      await patientsApi.update(patient.id, payload)
      setEditing(false)
      toast.success('Patient updated')
      if (onSaved) await onSaved()
    } catch (err) {
      const { message, fieldErrors } = parseApiError(err, 'Failed to update patient')
      if (fieldErrors) {
        Object.entries(fieldErrors).forEach(([field, msg]) => {
          setFieldError(toFormFieldName(field), { type: 'server', message: msg })
        })
      }
      toast.error(message)
    }
  }

  if (editing) {
    return (
      <form onSubmit={handleSubmit(onSave)} className="space-y-6" noValidate>
        <DemographicsFields register={register} errors={errors} />
        <OriginFields register={register} errors={errors} originType={originType} />
        <div className="flex items-center justify-end gap-3">
          <button type="button" className="btn-outline" onClick={cancelEdit}>
            Cancel
          </button>
          <button type="submit" className="btn-brand" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save changes'
            )}
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Demographics</h2>
          {editable && (
            <button type="button" className="btn-outline px-3 py-1.5 text-sm" onClick={startEdit}>
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          )}
        </div>
        <dl className="divide-y divide-border">
          <Row label="Full name" value={dash(patient.full_name)} />
          <Row label="Gender" value={dash(patient.gender)} />
          <Row label="Date of birth" value={formatDate(patient.date_of_birth)} />
          <Row label="Age" value={patient.age != null ? `${patient.age} yrs` : '—'} />
          <Row label="Phone" value={dash(extractPhone(patient.contact))} />
          <Row label="Address" value={dash(patient.address || patient.address_line1)} />
          <Row label="City" value={dash(patient.city)} />
          <Row label="Diagnosis" value={dash(patient.diagnosis)} />
          <Row label="Blood group" value={dash(patient.blood_group)} />
          <Row label="Preferred language" value={dash(patient.preferred_language)} />
          <Row label="Hospital UHID" value={dash(patient.hospital_uhid)} />
        </dl>
      </section>

      <section className="card">
        <h2 className="mb-2 text-base font-semibold text-foreground">Referral origin</h2>
        <dl className="divide-y divide-border">
          <Row
            label="Origin type"
            value={
              patient.origin_type ? (
                <span className="badge-gray">
                  {ORIGIN_TYPE_LABELS[patient.origin_type] || patient.origin_type}
                </span>
              ) : (
                '—'
              )
            }
          />
          <Row label="Referring hospital code" value={dash(patient.origin_source_code)} />
          <Row label="Source name" value={dash(patient.origin_source_name)} />
          <Row label="Referrer organization ID" value={dash(patient.origin_organization_id)} />
          <Row label="Referral date" value={formatDate(patient.origin_referral_date)} />
          <Row label="Origin notes" value={dash(patient.origin_notes)} />
        </dl>
      </section>

      <section className="card">
        <h2 className="mb-2 text-base font-semibold text-foreground">Record</h2>
        <dl className="divide-y divide-border">
          <Row label="Created" value={formatDateTime(patient.created_at)} />
          <Row label="Last updated" value={formatDateTime(patient.updated_at)} />
        </dl>
      </section>
    </div>
  )
}
