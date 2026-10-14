import React, { useEffect, useState } from 'react'
import analyticsApi from '../../api/analytics'
import AnalyticsGoogleMap from './AnalyticsGoogleMap'
import { RefreshCw } from 'lucide-react'

function getAge(dobString) {
  if (!dobString) return null
  const dob = new Date(dobString)
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--
  }
  return age
}

function formatDate(dateStr) {
  if (!dateStr) return 'Unknown'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch (e) {
    return dateStr
  }
}

function formatGender(gender) {
  if (!gender) return 'Unknown'
  const canonical = gender.trim().toLowerCase()
  if (canonical === 'female') return 'Female'
  if (canonical === 'male') return 'Male'
  return gender
}

// Read the live per-org accent so charts respect branding.
function accentColor() {
  if (typeof window === 'undefined') return '#14b8a6'
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent-color')
    .trim()
  return v || '#14b8a6'
}

export default function PatientLocationsMap() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [patients, setPatients] = useState([])

  const loadPatients = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await analyticsApi.getPatientLocations()
      if (res.success) {
        setPatients(res.data || [])
      }
    } catch (err) {
      console.error('Error fetching patient locations:', err)
      setError(err.response?.data?.message || 'Failed to load patient locations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPatients()
  }, [])

  const accent = accentColor()

  if (loading) {
    return (
      <div className="flex h-[300px] items-center justify-center bg-muted/10 border border-border rounded-lg">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Loading map locations…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-[300px] flex-col items-center justify-center gap-2 bg-muted/10 border border-border rounded-lg">
        <p className="text-xs text-red-600">{error}</p>
        <button className="btn btn-secondary !h-7 !py-0 text-xs" onClick={loadPatients}>
          Retry
        </button>
      </div>
    )
  }

  // Filter out invalid coordinates
  const validPatients = patients.filter(
    (p) => p.latitude !== null && p.longitude !== null && !isNaN(p.latitude) && !isNaN(p.longitude)
  )

  const points = validPatients.map((p) => {
    const age = getAge(p.date_of_birth)
    
    const details = [
      { label: 'Type', value: 'Patient Residence' }
    ]

    if (age !== null && age !== undefined && !isNaN(age)) {
      details.push({ label: 'Age', value: `${age} years` })
    } else {
      details.push({ label: 'DOB', value: p.date_of_birth ? formatDate(p.date_of_birth) : 'Unknown' })
    }

    details.push({ label: 'Gender', value: formatGender(p.gender) })
    details.push({ label: 'BSC Status', value: p.bsc_status === true ? 'BSC' : p.bsc_status === false ? 'Non-BSC' : 'Not Yet Determined' })
    details.push({ label: 'Zone', value: p.zone || 'Unknown' })
    details.push({ label: 'PPS Score', value: p.pps_score !== null && p.pps_score !== undefined ? String(p.pps_score) : 'Not Recorded' })
    details.push({ label: 'Status', value: p.is_deceased ? 'Deceased' : 'Alive' })

    return {
      id: `patient-${p.patient_id}`,
      latitude: p.latitude,
      longitude: p.longitude,
      color: p.is_deceased ? '#EF4444' : accent,
      radius: 8,
      popupTitle: p.patient_name,
      popupSubtitle: p.address || p.district,
      popupDetails: details,
    }
  })

  return (
    <div className="flex h-full flex-col justify-between">
      <div className="flex-1 min-h-[180px] w-full">
        <AnalyticsGoogleMap points={points} showZones={true} height="100%" />
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 justify-center text-xs border-t border-border pt-3">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full border border-card shadow-sm"
            style={{ backgroundColor: accent }}
          />
          <span className="text-muted-foreground text-[11px]">Alive Patient Residence</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full border border-card shadow-sm bg-[#EF4444]"
          />
          <span className="text-muted-foreground text-[11px]">Deceased Patient Residence</span>
        </div>
      </div>
    </div>
  )
}
