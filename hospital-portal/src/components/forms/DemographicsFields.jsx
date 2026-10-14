/**
 * Demographic intake fields — a curated subset of PatientCreateSchema that
 * hospital staff fill at intake. (The full schema has many clinical/zone fields
 * that are out of scope for portal intake; those default server-side.)
 */
import { BLOOD_GROUPS, GENDERS } from '../../constants/origin'
import { SelectField, TextArea, TextField } from './Field'

export default function DemographicsFields({ register, errors }) {
  return (
    <div className="space-y-6">
      <fieldset className="card space-y-1">
        <legend className="px-1 text-base font-semibold text-foreground">Patient details</legend>

        <TextField
          label="Full name"
          name="full_name"
          register={register}
          error={errors.full_name}
          required
          placeholder="Patient's full name"
          autoComplete="off"
        />

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
          <TextField
            label="Date of birth"
            name="date_of_birth"
            type="date"
            register={register}
            error={errors.date_of_birth}
          />
          <SelectField
            label="Gender"
            name="gender"
            register={register}
            error={errors.gender}
            options={GENDERS}
          />
          <SelectField
            label="Blood group"
            name="blood_group"
            register={register}
            error={errors.blood_group}
            options={BLOOD_GROUPS}
          />
        </div>

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <TextField
            label="Phone number"
            name="phone_number"
            register={register}
            error={errors.phone_number}
            placeholder="+91…"
            inputMode="tel"
          />
          <TextField
            label="Email"
            name="email"
            type="email"
            register={register}
            error={errors.email}
            placeholder="patient@example.com"
          />
        </div>

        <TextField
          label="Hospital UHID"
          name="hospital_uhid"
          register={register}
          error={errors.hospital_uhid}
          placeholder="Hospital-issued ID (optional)"
          maxLength={30}
        />
      </fieldset>

      <fieldset className="card space-y-1">
        <legend className="px-1 text-base font-semibold text-foreground">Address</legend>

        <TextField label="Address line 1" name="address_line1" register={register} error={errors.address_line1} />
        <TextField label="Address line 2" name="address_line2" register={register} error={errors.address_line2} />

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
          <TextField label="City" name="city" register={register} error={errors.city} />
          <TextField label="State" name="state" register={register} error={errors.state} />
          <TextField label="Postal code" name="postal_code" register={register} error={errors.postal_code} />
        </div>
        <TextField label="Country" name="country" register={register} error={errors.country} />
      </fieldset>

      <fieldset className="card space-y-1">
        <legend className="px-1 text-base font-semibold text-foreground">Clinical & contacts</legend>

        <TextField
          label="Primary diagnosis"
          name="diagnosis"
          register={register}
          error={errors.diagnosis}
          maxLength={100}
        />

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <TextField
            label="Emergency contact name"
            name="emergency_contact_name"
            register={register}
            error={errors.emergency_contact_name}
          />
          <TextField
            label="Emergency contact phone"
            name="emergency_contact_phone"
            register={register}
            error={errors.emergency_contact_phone}
            inputMode="tel"
          />
        </div>

        <TextField
          label="Preferred language"
          name="preferred_language"
          register={register}
          error={errors.preferred_language}
        />

        <TextArea label="Notes" name="notes" register={register} error={errors.notes} />
      </fieldset>
    </div>
  )
}
