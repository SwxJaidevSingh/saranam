/**
 * Structured referral-origin section (shared by Add + Edit).
 *
 *  - origin_type (REQUIRED): hospital | doctor | camp | self | ngo |
 *    govt_scheme | online | other
 *  - when type === 'hospital': show origin_source_code (referring hospital
 *    catalog code) + optional origin_organization_id (referrer tenant org).
 *  - otherwise: show origin_source_name (free text).
 *  - always: origin_referral_date, origin_notes.
 *
 * The referrer-org dropdown is populated from GET /portal/org-directory, which
 * is gated by the org's directory toggle / platform-admin. If it's disabled
 * (403) we silently fall back to a free-text organization-id input.
 */
import { useEffect, useState } from 'react'
import { orgsApi } from '../../api/orgs'
import { ORIGIN_TYPES } from '../../constants/origin'
import { SelectField, TextArea, TextField } from './Field'

export default function OriginFields({ register, errors, originType }) {
  const isHospital = originType === 'hospital'
  const [directory, setDirectory] = useState(null) // null=unknown, []=empty/disabled
  const [dirError, setDirError] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (isHospital && directory === null && !dirError) {
      orgsApi
        .getDirectory()
        .then((res) => {
          if (!cancelled) setDirectory(res.organizations || [])
        })
        .catch(() => {
          if (!cancelled) setDirError(true)
        })
    }
    return () => {
      cancelled = true
    }
  }, [isHospital, directory, dirError])

  return (
    <fieldset className="card space-y-1">
      <legend className="px-1 text-base font-semibold text-foreground">Referral origin</legend>
      <p className="mb-3 text-sm text-muted-foreground">
        Where did this patient come from? Origin type is required.
      </p>

      <SelectField
        label="Origin type"
        name="origin_type"
        register={register}
        error={errors.origin_type}
        required
        options={ORIGIN_TYPES}
        placeholder="Select origin type…"
      />

      {isHospital ? (
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <TextField
            label="Referring hospital code"
            name="origin_source_code"
            register={register}
            error={errors.origin_source_code}
            placeholder="e.g. KMIO"
            maxLength={10}
          />
          {dirError ? (
            <TextField
              label="Referrer organization ID (optional)"
              name="origin_organization_id"
              register={register}
              error={errors.origin_organization_id}
              placeholder="Organization UUID"
            />
          ) : (
            <SelectField
              label="Referrer organization (optional)"
              name="origin_organization_id"
              register={register}
              error={errors.origin_organization_id}
              placeholder={directory === null ? 'Loading…' : 'None'}
              options={(directory || []).map((o) => ({
                value: o.id,
                label: `${o.display_name || o.name} (${o.code})`,
              }))}
            />
          )}
        </div>
      ) : (
        <TextField
          label="Source name"
          name="origin_source_name"
          register={register}
          error={errors.origin_source_name}
          placeholder="Doctor / camp / NGO / scheme name"
          maxLength={150}
        />
      )}

      <TextField
        label="Referral date"
        name="origin_referral_date"
        type="date"
        register={register}
        error={errors.origin_referral_date}
      />

      <TextArea
        label="Origin notes"
        name="origin_notes"
        register={register}
        error={errors.origin_notes}
        placeholder="Any additional context about the referral"
      />
    </fieldset>
  )
}
