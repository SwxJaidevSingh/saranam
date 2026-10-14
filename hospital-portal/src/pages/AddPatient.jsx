/**
 * AddPatient — the portal's "Register New Patient" modal.
 *
 * COPIED from the main app's modal (frontend/src/components/patients/PatientQuickAdd.jsx)
 * and adapted for the hospital portal:
 *
 *   - Exposed as a MODAL with props { open, onClose, onCreated } (default export).
 *   - All data calls go through the portal client (../api/client) via the
 *     add-patient data layer, which auto-attaches Authorization + X-Org-Id:
 *       • global config/zone/duplicate endpoints reused as-is from the main app
 *       • CREATE posts to POST /api/portal/patients (org forced server-side)
 *   - The field formerly labeled "Linked Hospital" is RENAMED to
 *     "Patient origin hospital" and AUTO-SELECTED from the logged-in user's
 *     organization (GET /api/portal/orgs/me -> active_org.linked_hospital_code,
 *     falling back to active_org.code/name). It is shown LOCKED (read-only,
 *     no dropdown, no edit) and sent as `linked_hospital` in the payload.
 *   - `organization_id` is forced server-side and is NEVER sent.
 *
 * The rest of the modal behavior (name/DOB/approx-age/gender, diagnosis +
 * referred-from with inline add, phone/caregiver, hospital UHID, location with
 * map, Bangalore zone clustering, ABHA, patient category & priority) matches the
 * main app.
 */

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Alert,
  Box,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  InputAdornment,
  IconButton,
  Chip,
  FormControlLabel,
  Switch,
  Tooltip,
} from '@mui/material'
import {
  ExpandMore,
  MyLocation,
  Map as MapIcon,
  Add as AddIcon,
  Close as CloseIcon,
  Lock as LockIcon,
  Warning as WarningIcon,
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import addPatientApi from '../components/add-patient/addPatientApi'
import useOriginHospital from '../components/add-patient/useOriginHospital'
import MapPicker from '../components/add-patient/MapPicker'

// Bangalore PIN code to zone mapping (auto-suggestion only, user can override)
const BANGALORE_PIN_ZONES = {
  // North
  '560064': 'North', '560092': 'North', '560094': 'North', '560097': 'North',
  '560057': 'North', '560058': 'North', '560073': 'North', '560077': 'North',
  '560013': 'North', '560024': 'North', '560032': 'North', '560045': 'North',
  '560054': 'North', '560090': 'North',
  // South
  '560004': 'South', '560011': 'South', '560019': 'South', '560041': 'South',
  '560050': 'South', '560062': 'South', '560068': 'South', '560076': 'South',
  '560078': 'South', '560083': 'South', '560085': 'South', '560070': 'South',
  '560026': 'South',
  // East
  '560005': 'East', '560008': 'East', '560016': 'East', '560017': 'East',
  '560033': 'East', '560036': 'East', '560037': 'East', '560038': 'East',
  '560043': 'East', '560048': 'East', '560066': 'East', '560075': 'East',
  '560087': 'East', '560093': 'East', '560103': 'East', '560067': 'East',
  // West
  '560010': 'West', '560015': 'West', '560021': 'West', '560023': 'West',
  '560039': 'West', '560040': 'West', '560044': 'West', '560055': 'West',
  '560056': 'West', '560060': 'West', '560079': 'West', '560086': 'West',
  '560098': 'West',
  // Central
  '560001': 'Central', '560002': 'Central', '560003': 'Central', '560009': 'Central',
  '560012': 'Central', '560018': 'Central', '560020': 'Central', '560025': 'Central',
  '560027': 'Central', '560029': 'Central', '560042': 'Central', '560046': 'Central',
  '560051': 'Central', '560053': 'Central',
}

const ZONE_OPTIONS = ['North', 'South', 'East', 'West', 'Central']
const COMPLEXITY_OPTIONS = [
  { value: 'not_yet_determined', label: 'Not Yet Determined' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]
const PATIENT_CATEGORY_OPTIONS = [
  { value: '', label: 'Not Yet Determined', bsc: null, onco: null },
  { value: 'bsc_onco', label: 'BSC Onco', bsc: true, onco: true },
  { value: 'non_bsc_onco', label: 'Non-BSC Onco', bsc: false, onco: true },
  { value: 'bsc_non_onco', label: 'BSC Non-Onco', bsc: true, onco: false },
  { value: 'non_bsc_non_onco', label: 'Non-BSC Non-Onco', bsc: false, onco: false },
]

// Map the free-text "Referred From" choice onto a structured origin_type that
// the portal create endpoint requires (PatientOriginSchema). Defaults to 'self'
// when nothing useful is given so the required field is always valid.
const deriveOriginType = (referredFrom) => {
  const v = (referredFrom || '').toLowerCase()
  if (!v) return 'self'
  if (v.includes('self')) return 'self'
  if (v.includes('doctor')) return 'doctor'
  if (v.includes('camp')) return 'camp'
  if (v.includes('ngo')) return 'ngo'
  if (v.includes('scheme') || v.includes('govt') || v.includes('government')) return 'govt_scheme'
  if (v.includes('online')) return 'online'
  if (v.includes('hospital') || v.includes('institute') || v.includes('memorial')) return 'hospital'
  return 'other'
}

const isBangaloreCity = (city) => {
  if (!city) return false
  const normalized = city.toLowerCase().trim()
  return normalized.includes('bengaluru') || normalized.includes('bangalore')
}

const suggestZoneFromPin = (postalCode) => {
  if (!postalCode) return ''
  return BANGALORE_PIN_ZONES[postalCode.trim()] || ''
}

const FALLBACK_DIAGNOSIS_OPTIONS = [
  'Breast cancer', 'Oral cancer', 'Cervical cancer', 'Lung cancer',
  'Colorectal cancers', 'Stomach cancer', 'GEJ carcinoma', 'ALL',
  'Neuroblastoma', 'Ewings sarcoma', 'Renal Cell Carcinoma',
  'Prostate cancer', 'Melanoma', 'Liver cancer', 'Gallbladder cancer',
  'Bladder cancer', 'Penile cancer', 'Pancreatic cancer', 'Other',
]

const FALLBACK_REFERRAL_OPTIONS = [
  'Kidwai Memorial Institute of Oncology',
  'KC General Hospital',
  'Doctor Outside',
  'Self-Referral',
  'Other',
]

const EMPTY_FORM = {
  first_name: '',
  middle_name: '',
  last_name: '',
  date_of_birth: '',
  gender: '',
  phone_number: '',
  alternative_phone: '',
  alternative_phone_name: '',
  email: '',
  abha_id: '',
  abha_address: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'India',
  latitude: '',
  longitude: '',
  diagnosis: '',
  diagnosis_other: '',
  referred_from: '',
  referred_from_other: '',
  is_approximate_dob: false,
  approximate_age: '',
  is_bangalore_resident: false,
  geographic_cluster: '',
  hospital_uhid: '',
  patient_category: '',
  clinical_complexity: 'not_yet_determined',
}

export default function AddPatient({ open, onClose, onCreated }) {
  // Locked "Patient origin hospital" from the active org.
  const { hospital: originHospital, loading: originLoading } = useOriginHospital(open)

  // Hospital master list — used only to confirm the org code is a valid
  // catalog code before sending it as `linked_hospital`.
  const [hospitalOptions, setHospitalOptions] = useState([])

  // Dynamic options loaded from backend.
  const [diagnosisOptions, setDiagnosisOptions] = useState(FALLBACK_DIAGNOSIS_OPTIONS)
  const [referralOptions, setReferralOptions] = useState(FALLBACK_REFERRAL_OPTIONS)
  const [newDiagnosis, setNewDiagnosis] = useState('')
  const [showAddDiagnosis, setShowAddDiagnosis] = useState(false)
  const [newReferral, setNewReferral] = useState('')
  const [showAddReferral, setShowAddReferral] = useState(false)

  const [formData, setFormData] = useState({ ...EMPTY_FORM })
  const [errors, setErrors] = useState({})
  const [duplicateWarning, setDuplicateWarning] = useState(null)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [duplicatePatientDetails, setDuplicatePatientDetails] = useState(null)
  const [locLoading, setLocLoading] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [createdPatient, setCreatedPatient] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const genderOptions = ['Male', 'Female', 'Other']

  useEffect(() => {
    if (open) {
      addPatientApi
        .getDiagnosisOptions()
        .then((res) => {
          if (res.options?.length) setDiagnosisOptions(res.options)
        })
        .catch(() => {})
      addPatientApi
        .getReferralPartners()
        .then((res) => {
          if (res.options?.length) setReferralOptions(res.options)
        })
        .catch(() => {})
      addPatientApi
        .getHospitalOptions()
        .then((res) => setHospitalOptions(res.options || []))
        .catch(() => {})
    }
  }, [open])

  // True when the org's resolved hospital code is a valid catalog code (only
  // then may we safely send it as linked_hospital).
  const originCode = originHospital?.code || null
  const originCodeIsValid = !!originCode && hospitalOptions.some((h) => h.code === originCode)

  const handleAddDiagnosis = async () => {
    const trimmed = newDiagnosis.trim()
    if (!trimmed) return
    try {
      const res = await addPatientApi.addDiagnosisOption(trimmed)
      setDiagnosisOptions(res.options)
      setFormData((prev) => ({ ...prev, diagnosis: trimmed }))
      setNewDiagnosis('')
      setShowAddDiagnosis(false)
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to add diagnosis option')
    }
  }

  const handleAddReferral = async () => {
    const trimmed = newReferral.trim()
    if (!trimmed) return
    try {
      const res = await addPatientApi.addReferralPartner(trimmed)
      setReferralOptions(res.options)
      setFormData((prev) => ({ ...prev, referred_from: trimmed }))
      setNewReferral('')
      setShowAddReferral(false)
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to add referral partner')
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target

    // Auto-capitalize first letter of first/last name.
    if (name === 'first_name' || name === 'last_name') {
      const capitalized = value.charAt(0).toUpperCase() + value.slice(1)
      setFormData((prev) => ({ ...prev, [name]: capitalized }))
      if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }))
      return
    }

    // Phone: only digits, max 10 + live duplicate check.
    if (name === 'phone_number' || name === 'alternative_phone') {
      const digits = value.replace(/\D/g, '').slice(0, 10)
      setFormData((prev) => {
        const updated = { ...prev, [name]: digits }
        if (updated.alternative_phone && updated.phone_number && updated.alternative_phone === updated.phone_number) {
          setErrors((er) => ({ ...er, alternative_phone: 'Alternative phone must be different from primary phone' }))
        } else {
          setErrors((er) => ({ ...er, alternative_phone: null }))
        }
        return updated
      })
      return
    }

    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }))

    // Auto-detect Bangalore when city changes.
    if (name === 'city') {
      const isBlr = isBangaloreCity(value)
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        is_bangalore_resident: isBlr,
        geographic_cluster: isBlr ? suggestZoneFromPin(prev.postal_code) : '',
      }))
      return
    }

    // Auto-suggest zone when postal code changes (if Bangalore resident).
    if (name === 'postal_code') {
      setFormData((prev) => {
        const suggestedZone = prev.is_bangalore_resident ? suggestZoneFromPin(value) : ''
        return { ...prev, [name]: value, geographic_cluster: suggestedZone || prev.geographic_cluster }
      })
      return
    }
  }

  const handleSwitchChange = (name) => (e) => {
    const checked = e.target.checked
    setFormData((prev) => {
      const next = { ...prev, [name]: checked }
      if (name === 'is_bangalore_resident' && !checked) {
        next.geographic_cluster = ''
      }
      return next
    })
  }

  const runDuplicateCheck = async () => {
    const fullName = [formData.first_name, formData.middle_name, formData.last_name]
      .filter(Boolean)
      .join(' ')
      .trim()

    let calculatedDob = formData.date_of_birth
    if (formData.is_approximate_dob && formData.approximate_age) {
      const currentYear = new Date().getFullYear()
      const estimatedYear = currentYear - parseInt(formData.approximate_age, 10)
      calculatedDob = `${estimatedYear}-01-01`
    }

    const checkParams = {}
    if (formData.abha_address) {
      checkParams.abha_address = formData.abha_address
    }

    const hasName = fullName && fullName.length >= 2
    const hasDob = !!calculatedDob
    const hasPhone = formData.phone_number && formData.phone_number.length === 10

    if (hasName) checkParams.full_name = fullName
    if (hasDob) checkParams.date_of_birth = calculatedDob
    if (hasPhone) checkParams.phone_number = formData.phone_number

    const demoCount = [hasName, hasDob, hasPhone].filter(Boolean).length

    if (checkParams.abha_address || demoCount >= 2) {
      try {
        const result = await addPatientApi.checkDuplicate(checkParams)
        if (result.duplicate_found) {
          setDuplicatePatientDetails(result.patient)
          const detailStr = `(Hospital UHID: ${result.patient?.hospital_uhid || 'N/A'}, UHID: ${result.patient?.uhid || 'N/A'})`
          if (checkParams.abha_address && result.patient?.abha_address === checkParams.abha_address) {
            setDuplicateWarning(`A patient with ABHA address "${formData.abha_address}" already exists: ${result.patient?.full_name || ''} ${detailStr}.`)
          } else {
            setDuplicateWarning(`A duplicate patient with these details already exists: ${result.patient?.full_name || ''} ${detailStr}.`)
          }
        } else {
          setDuplicateWarning(null)
          setDuplicatePatientDetails(null)
        }
      } catch {
        // ignore — server also re-checks on create
      }
    } else {
      setDuplicateWarning(null)
      setDuplicatePatientDetails(null)
    }
  }

  // Zone detection (lat/long primary; PIN suggestion is the fallback).
  const applyZoneFromLatLng = async (lat, lng) => {
    try {
      const zone = await addPatientApi.detectZone(lat, lng)
      if (zone) {
        setFormData((prev) => ({ ...prev, geographic_cluster: zone, is_bangalore_resident: true }))
      }
    } catch {
      // leave PIN-suggested / manual zone in place
    }
  }

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser')
      return
    }
    setLocLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((prev) => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }))
        applyZoneFromLatLng(pos.coords.latitude, pos.coords.longitude)
        setLocLoading(false)
      },
      (err) => {
        toast.error('Failed to get location: ' + err.message)
        setLocLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const handleAddressResolved = (addr) => {
    const city = addr.city || ''
    const postalCode = addr.postal_code || ''
    const isBlr = isBangaloreCity(city)
    const suggestedZone = isBlr ? suggestZoneFromPin(postalCode) : ''

    setFormData((prev) => ({
      ...prev,
      address_line1: addr.address_line1 || prev.address_line1,
      address_line2: addr.address_line2 || prev.address_line2,
      city: city || prev.city,
      state: addr.state || prev.state,
      postal_code: postalCode || prev.postal_code,
      is_bangalore_resident: isBlr,
      geographic_cluster: suggestedZone || (isBlr ? prev.geographic_cluster : ''),
    }))
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.first_name || formData.first_name.trim().length < 2) {
      newErrors.first_name = 'First name is required (minimum 2 characters)'
    }
    if (!formData.is_approximate_dob) {
      if (!formData.date_of_birth) {
        newErrors.date_of_birth = 'Date of birth is required'
      } else {
        const dob = new Date(formData.date_of_birth)
        if (dob > new Date()) newErrors.date_of_birth = 'Date of birth cannot be in the future'
      }
    }
    if (!formData.gender) newErrors.gender = 'Gender is required'
    if (formData.phone_number && formData.phone_number.length !== 10) {
      newErrors.phone_number = 'Phone number must be exactly 10 digits'
    }
    if (formData.alternative_phone && formData.alternative_phone.length !== 10) {
      newErrors.alternative_phone = 'Alternative phone must be exactly 10 digits'
    }
    if (formData.alternative_phone && formData.phone_number && formData.alternative_phone === formData.phone_number) {
      newErrors.alternative_phone = 'Alternative phone must be different from primary phone'
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format'
    }
    if (formData.abha_id && !/^\d{14}$/.test(formData.abha_id.replace(/[\s-]/g, ''))) {
      newErrors.abha_id = 'ABHA ID must be 14 digits'
    }
    if (!formData.diagnosis) newErrors.diagnosis = 'Diagnosis is required'
    if (formData.diagnosis === 'Other' && !formData.diagnosis_other?.trim()) {
      newErrors.diagnosis_other = 'Please specify the diagnosis'
    }
    if (formData.is_approximate_dob && !formData.approximate_age) {
      newErrors.approximate_age = 'Please enter approximate age'
    }
    if (formData.is_bangalore_resident && !formData.geographic_cluster) {
      newErrors.geographic_cluster = 'Please select a Bangalore zone'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (ignoreDuplicate = false) => {
    const shouldIgnore = ignoreDuplicate === true
    if (!validateForm()) return

    if (!shouldIgnore && duplicateWarning) {
      setDuplicateDialogOpen(true)
      return
    }

    const cleanedData = { ...formData, ignore_duplicate: shouldIgnore }
    Object.keys(cleanedData).forEach((key) => {
      if (typeof cleanedData[key] === 'string') cleanedData[key] = cleanedData[key].trim()
    })

    // Combine name parts into full_name for the backend.
    cleanedData.full_name = [cleanedData.first_name, cleanedData.middle_name, cleanedData.last_name]
      .filter(Boolean)
      .join(' ')
    delete cleanedData.first_name
    delete cleanedData.middle_name
    delete cleanedData.last_name

    if (cleanedData.phone_number) {
      cleanedData.phone_number = '+91' + cleanedData.phone_number.replace(/\D/g, '')
    }
    if (cleanedData.alternative_phone) {
      cleanedData.alternative_phone = '+91' + cleanedData.alternative_phone.replace(/\D/g, '')
    }
    if (cleanedData.abha_id) {
      cleanedData.abha_id = cleanedData.abha_id.replace(/[\s-]/g, '')
    }

    // lat/lng -> external_metadata.
    if (cleanedData.latitude && cleanedData.longitude) {
      cleanedData.external_metadata = {
        latitude: parseFloat(cleanedData.latitude),
        longitude: parseFloat(cleanedData.longitude),
      }
    }
    delete cleanedData.latitude
    delete cleanedData.longitude

    // Diagnosis "Other" -> custom text.
    if (cleanedData.diagnosis === 'Other' && cleanedData.diagnosis_other) {
      cleanedData.diagnosis = cleanedData.diagnosis_other.trim()
    }
    delete cleanedData.diagnosis_other

    // Referred-from "Other" -> custom text. Keep the resolved value for origin.
    let referredFromValue = cleanedData.referred_from
    if (cleanedData.referred_from === 'Other' && cleanedData.referred_from_other) {
      referredFromValue = cleanedData.referred_from_other.trim()
      cleanedData.referred_from = referredFromValue
    }
    delete cleanedData.referred_from_other

    // Approximate DOB -> Jan 1 of estimated birth year.
    if (cleanedData.is_approximate_dob && cleanedData.approximate_age) {
      const currentYear = new Date().getFullYear()
      const estimatedYear = currentYear - parseInt(cleanedData.approximate_age, 10)
      cleanedData.date_of_birth = `${estimatedYear}-01-01`
      cleanedData.is_approximate_dob = true
    } else {
      cleanedData.is_approximate_dob = false
    }
    delete cleanedData.approximate_age

    // Derive bsc_status / is_onco from patient_category.
    if (cleanedData.patient_category) {
      const selected = PATIENT_CATEGORY_OPTIONS.find((c) => c.value === cleanedData.patient_category)
      cleanedData.bsc_status = selected?.bsc ?? null
      cleanedData.is_onco = selected?.onco ?? null
    } else {
      cleanedData.bsc_status = null
      cleanedData.is_onco = null
    }
    delete cleanedData.patient_category

    if (!cleanedData.clinical_complexity) {
      cleanedData.clinical_complexity = 'not_yet_determined'
    }

    // Zone -> null when not Bangalore / blank.
    if (!cleanedData.is_bangalore_resident) cleanedData.geographic_cluster = null
    if (!cleanedData.geographic_cluster) cleanedData.geographic_cluster = null

    // "Patient origin hospital": auto-locked from the org. Send only when it
    // resolves to a valid catalog code (the server validates it); otherwise omit.
    if (originCodeIsValid) {
      cleanedData.linked_hospital = originCode
    } else {
      delete cleanedData.linked_hospital
    }

    // hospital_uhid: trim, null when blank.
    cleanedData.hospital_uhid = (cleanedData.hospital_uhid || '').trim() || null

    // Required structured origin for the portal create endpoint. Derived from
    // the (free-text) referral source; defaults to 'self' when nothing useful.
    const originType = deriveOriginType(referredFromValue)
    const origin = { origin_type: originType }
    if (originType === 'hospital' && originCodeIsValid) {
      origin.source_code = originCode
    }
    if (referredFromValue) origin.source_name = referredFromValue.slice(0, 150)
    cleanedData.origin = origin

    setSubmitting(true)
    try {
      const res = await addPatientApi.createPatient(cleanedData)
      const patient = res?.patient || res
      setCreatedPatient(patient)
      toast.success('Patient registered')
      if (onCreated) onCreated(patient)
      // Auto-close shortly after so the user sees the success note.
      setTimeout(() => {
        handleClose()
      }, 2000)
    } catch (error) {
      if (error?.response?.status === 409 && error?.response?.data?.duplicate) {
        setDuplicatePatientDetails(error.response.data.duplicate)
        setDuplicateDialogOpen(true)
      } else {
        const data = error?.response?.data
        // Surface field-level validation errors from the portal endpoint.
        if (Array.isArray(data?.details)) {
          const fe = {}
          data.details.forEach((d) => {
            if (d.field) fe[d.field] = d.message || 'Invalid value'
          })
          setErrors((prev) => ({ ...prev, ...fe }))
        }
        const msg = data?.message || data?.error || error?.message || 'Failed to create patient'
        setErrors((prev) => ({ ...prev, submit: msg }))
        toast.error(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleForceSubmit = () => {
    setDuplicateDialogOpen(false)
    handleSubmit(true)
  }

  const handleClose = () => {
    setFormData({ ...EMPTY_FORM })
    setErrors({})
    setDuplicateWarning(null)
    setDuplicateDialogOpen(false)
    setDuplicatePatientDetails(null)
    setShowMap(false)
    setCreatedPatient(null)
    setSubmitting(false)
    if (onClose) onClose()
  }

  const hasLocation = formData.latitude && formData.longitude
  const originLabel = originLoading ? 'Loading…' : originHospital?.label || 'No organization selected'

  return (
    <>
      <Dialog open={!!open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1, fontWeight: 700 }}>Register New Patient</DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        {errors.submit && <Alert severity="error" sx={{ mb: 1.5 }}>{errors.submit}</Alert>}
        {duplicateWarning && <Alert severity="warning" sx={{ mb: 1.5 }}>{duplicateWarning}</Alert>}
        {createdPatient && (
          <Alert severity="success" sx={{ mb: 1.5 }}>
            Patient registered successfully.
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* ── Patient origin hospital (auto-selected from your organization, locked) ── */}
          <TextField
            fullWidth
            size="small"
            label="Patient origin hospital"
            value={originLabel}
            disabled
            helperText="Automatically set from your organization"
            InputProps={{
              readOnly: true,
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            }}
          />

          {/* ── Required: Name ── */}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField
              fullWidth size="small"
              label="First Name"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              onBlur={runDuplicateCheck}
              error={!!errors.first_name}
              helperText={errors.first_name}
              autoFocus
            />
            <TextField
              fullWidth size="small"
              label="Last Name"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              onBlur={runDuplicateCheck}
              error={!!errors.last_name}
              helperText={errors.last_name}
            />
          </Box>

          {/* ── DOB (exact or approximate) + Gender ── */}
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            {formData.is_approximate_dob ? (
              <TextField
                fullWidth required size="small"
                type="number"
                label="Approximate Age (years)"
                name="approximate_age"
                value={formData.approximate_age}
                onChange={handleChange}
                onBlur={runDuplicateCheck}
                error={!!errors.approximate_age}
                helperText={errors.approximate_age || 'DOB will be set to Jan 1 of estimated birth year'}
                inputProps={{ min: 0, max: 150 }}
              />
            ) : (
              <TextField
                fullWidth required size="small"
                type="date"
                label="Date of Birth"
                name="date_of_birth"
                value={formData.date_of_birth}
                onChange={handleChange}
                onBlur={runDuplicateCheck}
                error={!!errors.date_of_birth}
                helperText={errors.date_of_birth}
                InputLabelProps={{ shrink: true }}
              />
            )}
            <Tooltip title="Toggle if patient doesn't know exact date of birth" arrow>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_approximate_dob}
                    onChange={handleSwitchChange('is_approximate_dob')}
                    size="small"
                  />
                }
                label={<Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>Approx Age</Typography>}
                sx={{ minWidth: 120, mt: 0.5 }}
              />
            </Tooltip>
            <TextField
              fullWidth required size="small" select
              label="Gender"
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              error={!!errors.gender}
              helperText={errors.gender}
            >
              {genderOptions.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
            </TextField>
          </Box>

          {/* ── Diagnosis + Referred From ── */}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start' }}>
                <TextField
                  fullWidth required size="small" select
                  label="Diagnosis"
                  name="diagnosis"
                  value={formData.diagnosis}
                  onChange={handleChange}
                  error={!!errors.diagnosis}
                  helperText={errors.diagnosis}
                >
                  <MenuItem value="" disabled><em>Select diagnosis...</em></MenuItem>
                  {diagnosisOptions.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                </TextField>
                <Tooltip title="Add new diagnosis option" arrow>
                  <IconButton size="small" onClick={() => setShowAddDiagnosis(!showAddDiagnosis)} sx={{ mt: 0.5 }}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              {showAddDiagnosis && (
                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                  <TextField
                    size="small" fullWidth
                    placeholder="New diagnosis name..."
                    value={newDiagnosis}
                    onChange={(e) => setNewDiagnosis(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddDiagnosis()}
                  />
                  <Button size="small" variant="contained" onClick={handleAddDiagnosis} sx={{ textTransform: 'none', minWidth: 60 }}>Add</Button>
                  <IconButton size="small" onClick={() => { setShowAddDiagnosis(false); setNewDiagnosis('') }}><CloseIcon fontSize="small" /></IconButton>
                </Box>
              )}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start' }}>
                <TextField
                  fullWidth size="small" select
                  label="Referred From"
                  name="referred_from"
                  value={formData.referred_from}
                  onChange={handleChange}
                >
                  <MenuItem value=""><em>Not specified</em></MenuItem>
                  {referralOptions.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                </TextField>
                <Tooltip title="Add new referral partner" arrow>
                  <IconButton size="small" onClick={() => setShowAddReferral(!showAddReferral)} sx={{ mt: 0.5 }}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              {showAddReferral && (
                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                  <TextField
                    size="small" fullWidth
                    placeholder="New referral partner..."
                    value={newReferral}
                    onChange={(e) => setNewReferral(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddReferral()}
                  />
                  <Button size="small" variant="contained" onClick={handleAddReferral} sx={{ textTransform: 'none', minWidth: 60 }}>Add</Button>
                  <IconButton size="small" onClick={() => { setShowAddReferral(false); setNewReferral('') }}><CloseIcon fontSize="small" /></IconButton>
                </Box>
              )}
            </Box>
          </Box>

          {formData.diagnosis === 'Other' && (
            <TextField
              fullWidth required size="small"
              label="Specify Diagnosis"
              name="diagnosis_other"
              value={formData.diagnosis_other}
              onChange={handleChange}
              error={!!errors.diagnosis_other}
              helperText={errors.diagnosis_other}
              placeholder="Enter the diagnosis"
            />
          )}

          {formData.referred_from === 'Other' && (
            <TextField
              fullWidth size="small"
              label="Specify Referral Source"
              name="referred_from_other"
              value={formData.referred_from_other}
              onChange={handleChange}
              placeholder="Enter the referral source"
            />
          )}

          {/* ── Phone + Email ── */}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField
              fullWidth size="small"
              label="Phone Number"
              name="phone_number"
              value={formData.phone_number}
              onChange={handleChange}
              onBlur={runDuplicateCheck}
              error={!!errors.phone_number}
              helperText={errors.phone_number || '10 digits'}
              placeholder="9876543210"
              inputProps={{ maxLength: 10, inputMode: 'numeric' }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', mr: -0.5 }}>+91</Typography>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth size="small"
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              error={!!errors.email}
              helperText={errors.email}
              placeholder="patient@email.com"
            />
          </Box>

          {/* ── Caregiver phone/name ── */}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField
              fullWidth size="small"
              label="Caregiver's Phone"
              name="alternative_phone"
              value={formData.alternative_phone}
              onChange={handleChange}
              error={!!errors.alternative_phone}
              helperText={errors.alternative_phone || 'Backup number'}
              placeholder="9876543210"
              inputProps={{ maxLength: 10, inputMode: 'numeric' }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', mr: -0.5 }}>+91</Typography>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth size="small"
              label="Caregiver's Name"
              name="alternative_phone_name"
              value={formData.alternative_phone_name}
              onChange={handleChange}
            />
          </Box>

          {/* ── Hospital UHID ── */}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField
              fullWidth size="small"
              label="Hospital UHID"
              name="hospital_uhid"
              value={formData.hospital_uhid}
              onChange={handleChange}
              placeholder="e.g. 20240015098"
              helperText="From the patient's hospital file (optional)"
              inputProps={{ maxLength: 30 }}
            />
          </Box>

          {/* ── Location ── */}
          <Accordion defaultExpanded={false} sx={{ '&:before': { display: 'none' }, boxShadow: 'none', border: '1px solid', borderColor: 'divider', borderRadius: '8px !important' }}>
            <AccordionSummary expandIcon={<ExpandMore />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle2" color="primary">Location</Typography>
                {hasLocation && <Chip label="Captured" size="small" color="success" sx={{ height: 20, fontSize: 11 }} />}
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                <Button
                  variant="contained" size="small"
                  startIcon={locLoading ? <CircularProgress size={16} color="inherit" /> : <MyLocation />}
                  onClick={handleGetLocation}
                  disabled={locLoading}
                  sx={{ textTransform: 'none', flex: 1 }}
                >
                  {locLoading ? 'Getting...' : 'Use Current Location'}
                </Button>
                <Button
                  variant="outlined" size="small"
                  startIcon={<MapIcon />}
                  onClick={() => setShowMap(!showMap)}
                  sx={{ textTransform: 'none', flex: 1 }}
                >
                  {showMap ? 'Hide Map' : 'Pick on Map'}
                </Button>
              </Box>

              {hasLocation && (
                <Alert severity="success" sx={{ mb: 1.5, py: 0 }}>
                  <Typography variant="caption">{formData.latitude}, {formData.longitude}</Typography>
                </Alert>
              )}

              {showMap && (
                <Box sx={{ mb: 1.5 }}>
                  <MapPicker
                    latitude={formData.latitude ? parseFloat(formData.latitude) : null}
                    longitude={formData.longitude ? parseFloat(formData.longitude) : null}
                    height={350}
                    onChange={(lat, lng) => {
                      setFormData((prev) => ({ ...prev, latitude: String(lat), longitude: String(lng) }))
                      applyZoneFromLatLng(lat, lng)
                    }}
                    onAddressResolved={handleAddressResolved}
                  />
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.5, textAlign: 'center', color: 'text.secondary' }}>
                    Drag the map to move the pin to the patient's location
                  </Typography>
                </Box>
              )}

              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <TextField
                  fullWidth size="small"
                  label="Latitude"
                  name="latitude"
                  value={formData.latitude}
                  onChange={handleChange}
                  placeholder="12.9716"
                  type="number"
                  inputProps={{ step: 'any' }}
                />
                <TextField
                  fullWidth size="small"
                  label="Longitude"
                  name="longitude"
                  value={formData.longitude}
                  onChange={handleChange}
                  placeholder="77.5946"
                  type="number"
                  inputProps={{ step: 'any' }}
                />
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* ── Address + Bangalore Zone ── */}
          <Accordion sx={{ '&:before': { display: 'none' }, boxShadow: 'none', border: '1px solid', borderColor: 'divider', borderRadius: '8px !important' }}>
            <AccordionSummary expandIcon={<ExpandMore />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle2" color="primary">Address</Typography>
                {formData.is_bangalore_resident && formData.geographic_cluster && (
                  <Chip label={`${formData.geographic_cluster} Zone`} size="small" color="info" sx={{ height: 20, fontSize: 11 }} />
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <TextField fullWidth size="small" label="Address Line 1" name="address_line1" value={formData.address_line1} onChange={handleChange} />
                <TextField fullWidth size="small" label="Address Line 2" name="address_line2" value={formData.address_line2} onChange={handleChange} />
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <TextField fullWidth size="small" label="City" name="city" value={formData.city} onChange={handleChange} />
                  <TextField fullWidth size="small" label="State" name="state" value={formData.state} onChange={handleChange} />
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <TextField fullWidth size="small" label="Postal Code" name="postal_code" value={formData.postal_code} onChange={handleChange} />
                  <TextField fullWidth size="small" label="Country" name="country" value={formData.country} onChange={handleChange} disabled />
                </Box>

                {/* ── Bangalore Zone Clustering ── */}
                <Box sx={{ mt: 0.5, p: 1.5, bgcolor: 'action.hover', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.is_bangalore_resident}
                        onChange={handleSwitchChange('is_bangalore_resident')}
                        size="small"
                      />
                    }
                    label={<Typography variant="body2" sx={{ fontWeight: 500 }}>Patient is from Bangalore</Typography>}
                  />
                  {formData.is_bangalore_resident && (
                    <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'flex-start' }}>
                      <TextField
                        fullWidth select size="small"
                        label="Bangalore Zone"
                        name="geographic_cluster"
                        value={formData.geographic_cluster}
                        onChange={handleChange}
                        error={!!errors.geographic_cluster}
                        helperText={errors.geographic_cluster || 'You can also auto-detect from postal code.'}
                        required
                      >
                        {ZONE_OPTIONS.map((zone) => <MenuItem key={zone} value={zone}>{zone}</MenuItem>)}
                      </TextField>
                      <Button
                        variant="outlined" size="small"
                        onClick={() => {
                          const detected = suggestZoneFromPin(formData.postal_code)
                          if (detected) {
                            setFormData((prev) => ({ ...prev, geographic_cluster: detected }))
                          } else {
                            toast.info('Could not detect zone from postal code. Please select manually.')
                          }
                        }}
                        sx={{ textTransform: 'none', minWidth: 'auto', whiteSpace: 'nowrap', height: 40 }}
                      >
                        Auto Detect
                      </Button>
                    </Box>
                  )}
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* ── ABHA ── */}
          <Accordion sx={{ '&:before': { display: 'none' }, boxShadow: 'none', border: '1px solid', borderColor: 'divider', borderRadius: '8px !important' }}>
            <AccordionSummary expandIcon={<ExpandMore />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
              <Typography variant="subtitle2" color="primary">ABHA Information (Optional)</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <TextField
                  fullWidth size="small"
                  label="ABHA ID"
                  name="abha_id"
                  value={formData.abha_id}
                  onChange={handleChange}
                  error={!!errors.abha_id}
                  helperText={errors.abha_id || '14-digit ABHA ID'}
                  placeholder="12345678901234"
                />
                <TextField
                  fullWidth size="small"
                  label="ABHA Address"
                  name="abha_address"
                  value={formData.abha_address}
                  onChange={handleChange}
                  onBlur={runDuplicateCheck}
                  error={!!errors.abha_address}
                  helperText={errors.abha_address || 'username@abdm'}
                  placeholder="john.doe@abdm"
                />
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* ── Patient Category + Priority ── */}
          <Accordion defaultExpanded sx={{ '&:before': { display: 'none' }, boxShadow: 'none', border: '1px solid', borderColor: 'divider', borderRadius: '8px !important' }}>
            <AccordionSummary expandIcon={<ExpandMore />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle2" color="primary">Patient Category & Priority</Typography>
                <Chip
                  label={formData.patient_category
                    ? PATIENT_CATEGORY_OPTIONS.find((c) => c.value === formData.patient_category)?.label
                    : 'Not Yet Determined'}
                  size="small"
                  color={formData.patient_category ? 'success' : 'default'}
                  variant={formData.patient_category ? 'filled' : 'outlined'}
                  sx={{ height: 20, fontSize: 11 }}
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <TextField
                  fullWidth select size="small"
                  label="Patient Category"
                  name="patient_category"
                  value={formData.patient_category}
                  onChange={handleChange}
                >
                  {PATIENT_CATEGORY_OPTIONS.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
                </TextField>

                <TextField
                  fullWidth select size="small"
                  label="Patient Priority"
                  name="clinical_complexity"
                  value={formData.clinical_complexity}
                  onChange={handleChange}
                  helperText="Auto-updates when the PPS score is recorded; editable as a manual override."
                >
                  {COMPLEXITY_OPTIONS.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
                </TextField>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={submitting} sx={{ textTransform: 'none' }}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={submitting}
          startIcon={submitting && <CircularProgress size={18} />}
          sx={{ textTransform: 'none', px: 3 }}
        >
          {submitting ? 'Creating...' : 'Create Patient'}
        </Button>
      </DialogActions>
    </Dialog>

      <Dialog
        open={duplicateDialogOpen}
        onClose={() => setDuplicateDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { borderRadius: '12px', p: 1 }
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, color: 'warning.main' }}>
          <WarningIcon /> Duplicate Patient Found
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            A patient with similar details already exists in the system. Please review their details:
          </Typography>
          {duplicatePatientDetails && (
            <Box sx={{
              bgcolor: 'action.hover',
              p: 2,
              borderRadius: '8px',
              border: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5
            }}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>FULL NAME</Typography>
                <Typography variant="body1" sx={{ fontWeight: 700 }}>{duplicatePatientDetails.full_name}</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>DATE OF BIRTH</Typography>
                  <Typography variant="body2">{duplicatePatientDetails.date_of_birth || 'N/A'}</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>GENDER</Typography>
                  <Typography variant="body2">{duplicatePatientDetails.gender || 'N/A'}</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>PHONE</Typography>
                  <Typography variant="body2">{duplicatePatientDetails.phone_number || duplicatePatientDetails.phone || 'N/A'}</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>HOSPITAL UHID</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>{duplicatePatientDetails.hospital_uhid || 'N/A'}</Typography>
                </Box>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>HOMECARE UHID</Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{duplicatePatientDetails.uhid || 'N/A'}</Typography>
              </Box>
            </Box>
          )}
          <Typography variant="body2" sx={{ mt: 2, fontWeight: 500 }}>
            Do you still want to proceed and create a new patient record?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setDuplicateDialogOpen(false)}
            variant="outlined"
            size="small"
            sx={{ textTransform: 'none' }}
          >
            Cancel & Edit
          </Button>
          <Button
            onClick={handleForceSubmit}
            variant="contained"
            color="warning"
            size="small"
            sx={{ textTransform: 'none' }}
          >
            Yes, Proceed
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
