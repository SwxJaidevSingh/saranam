/**
 * Care Circle section (Agent B owns this) — adapted from the main app's
 * CareCircleCard (frontend/src/components/patients/CareCircleCard.jsx), in the
 * portal design system and repointed to the portal client.
 *
 * Primary Caregiver = family member doing hands-on daily care.
 * Decision Maker     = clinical authority (treating doctor / oncologist / ...).
 * All six fields persist directly on the patient via PUT /portal/patients/:id
 * (PatientUpdateSchema carries them). Viewers see a read-only summary.
 */
import { useEffect, useState } from 'react'
import { HeartHandshake, Loader2, Save, Stethoscope } from 'lucide-react'
import { toast } from 'react-toastify'
import { patientsApi } from '../../api/patients'
import { dash } from '../../utils/format'
import { parseApiError } from '../../utils/apiError'

const FIELD_KEYS = [
  'primary_caregiver_name',
  'primary_caregiver_relationship',
  'primary_caregiver_phone',
  'decision_maker_name',
  'decision_maker_designation',
  'decision_maker_phone',
]

function ReadRow({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
      <dt className="w-40 shrink-0 text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{dash(value)}</dd>
    </div>
  )
}

function Field({ label, placeholder, value, onChange, maxLength, type = 'text' }) {
  return (
    <div className="form-group mb-0">
      <label className="form-label">{label}</label>
      <input
        type={type}
        className="input"
        placeholder={placeholder}
        value={value || ''}
        onChange={onChange}
        maxLength={maxLength}
      />
    </div>
  )
}

export default function CareCircleSection({ patient, editable, onSaved }) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    const next = {}
    for (const k of FIELD_KEYS) next[k] = patient?.[k] || ''
    setForm(next)
    setDirty(false)
  }, [patient?.id, patient?.updated_at])

  const handleChange = (key) => (e) => {
    const v = e.target.value
    setForm((prev) => ({ ...prev, [key]: v }))
    setDirty(true)
  }

  const handleSave = async () => {
    if (!patient?.id) return
    setSaving(true)
    try {
      const payload = {}
      for (const k of FIELD_KEYS) payload[k] = (form[k] || '').trim()
      await patientsApi.update(patient.id, payload)
      setDirty(false)
      toast.success('Care circle saved')
      if (onSaved) await onSaved()
    } catch (err) {
      const { message } = parseApiError(err, 'Failed to save care circle')
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  // Read-only summary for viewers.
  if (!editable) {
    return (
      <div className="space-y-6">
        <section className="card">
          <div className="mb-2 flex items-center gap-2">
            <HeartHandshake className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Primary Caregiver</h2>
            <span className="text-xs text-muted-foreground">(family / hands-on)</span>
          </div>
          <dl className="divide-y divide-border">
            <ReadRow label="Name" value={patient.primary_caregiver_name} />
            <ReadRow label="Relationship" value={patient.primary_caregiver_relationship} />
            <ReadRow label="Phone" value={patient.primary_caregiver_phone} />
          </dl>
        </section>
        <section className="card">
          <div className="mb-2 flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Decision Maker</h2>
          </div>
          <dl className="divide-y divide-border">
            <ReadRow label="Name" value={patient.decision_maker_name} />
            <ReadRow label="Relationship" value={patient.decision_maker_designation} />
            <ReadRow label="Phone" value={patient.decision_maker_phone} />
          </dl>
        </section>
      </div>
    )
  }

  return (
    <div className="card space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Care Circle</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Captured at baseline. Primary Caregiver is the family member doing hands-on care.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Primary Caregiver */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <HeartHandshake className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Primary Caregiver</span>
            <span className="text-xs text-muted-foreground">(family / hands-on)</span>
          </div>
          <Field
            label="Name"
            value={form.primary_caregiver_name}
            onChange={handleChange('primary_caregiver_name')}
            maxLength={100}
          />
          <Field
            label="Relationship"
            placeholder="e.g. Daughter, Spouse, Paid Attendant"
            value={form.primary_caregiver_relationship}
            onChange={handleChange('primary_caregiver_relationship')}
            maxLength={50}
          />
          <Field
            label="Phone"
            type="tel"
            placeholder="9876543210"
            value={form.primary_caregiver_phone}
            onChange={handleChange('primary_caregiver_phone')}
            maxLength={20}
          />
        </div>

        {/* Decision Maker */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Decision Maker</span>
          </div>
          <Field
            label="Name"
            placeholder="e.g. Dr. Ashwini"
            value={form.decision_maker_name}
            onChange={handleChange('decision_maker_name')}
            maxLength={100}
          />
          <Field
            label="Relationship"
            placeholder="e.g. Treating physician"
            value={form.decision_maker_designation}
            onChange={handleChange('decision_maker_designation')}
            maxLength={50}
          />
          <Field
            label="Phone"
            type="tel"
            placeholder="9876543210"
            value={form.decision_maker_phone}
            onChange={handleChange('decision_maker_phone')}
            maxLength={20}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" className="btn-brand" onClick={handleSave} disabled={saving || !dirty}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {dirty ? 'Save' : 'Saved'}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
