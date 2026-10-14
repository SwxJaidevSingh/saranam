import React, { useEffect, useState } from 'react'
import analyticsApi from '../../api/analytics'
import AnalyticsGoogleMap from './AnalyticsGoogleMap'
import { RefreshCw } from 'lucide-react'

const GENDER_COLORS = {
  'Female': '#ec4899',
  'Male': '#0ea5e9',
  'Other / Unknown': '#64748b',
}

function getGenderColor(gender) {
  if (!gender) return GENDER_COLORS['Other / Unknown']
  const canonical = gender.trim().toLowerCase()
  if (canonical === 'female') return GENDER_COLORS['Female']
  if (canonical === 'male') return GENDER_COLORS['Male']
  return GENDER_COLORS['Other / Unknown']
}

function formatGender(gender) {
  if (!gender) return 'Unknown'
  const canonical = gender.trim().toLowerCase()
  if (canonical === 'female') return 'Female'
  if (canonical === 'male') return 'Male'
  return gender
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

export default function PatientGenderMap() {
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
      console.error('Error fetching patient locations for gender distribution:', err)
      setError(err.response?.data?.message || 'Failed to load patient locations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPatients()
  }, [])

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

  // Filter out patients without valid coordinates
  const validPatients = patients.filter(
    (p) => p.latitude !== null && p.longitude !== null && !isNaN(p.latitude) && !isNaN(p.longitude)
  )

  const points = validPatients.map((p) => {
    const color = getGenderColor(p.gender)
    const age = getAge(p.date_of_birth)
    
    const details = []
    if (age !== null && age !== undefined && !isNaN(age)) {
      details.push({ label: 'Age', value: `${age} years` })
    } else {
      details.push({ label: 'DOB', value: p.date_of_birth ? formatDate(p.date_of_birth) : 'Unknown' })
    }

    details.push({ label: 'Gender', value: formatGender(p.gender) })
    details.push({ label: 'BSC Status', value: p.bsc_status === true ? 'BSC' : p.bsc_status === false ? 'Non-BSC' : 'Not Yet Determined' })
    details.push({ label: 'Zone', value: p.zone || 'Unknown' })
    details.push({ label: 'PPS Score', value: p.pps_score !== null && p.pps_score !== undefined ? String(p.pps_score) : 'Not Recorded' })

    return {
      id: p.patient_id,
      latitude: p.latitude,
      longitude: p.longitude,
      color: color,
      radius: 8,
      popupTitle: p.patient_name,
      popupSubtitle: p.address || p.district || 'Unknown Address',
      popupDetails: details,
    }
  })

  return (
    <div className="flex h-full flex-col justify-between">
      <div className="flex-1 min-h-[180px] w-full">
        <AnalyticsGoogleMap points={points} showZones={true} height="100%" />
      </div>

      {/* Gender Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 justify-center text-xs border-t border-border pt-3">
        <span className="text-muted-foreground font-semibold mr-1">Gender Legend:</span>
        {Object.entries(GENDER_COLORS).map(([gender, color]) => (
          <div key={gender} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full border border-card shadow-sm"
              style={{ backgroundColor: color }}
            />
            <span className="text-muted-foreground text-[11px]">{gender}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
