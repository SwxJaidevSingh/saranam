import React, { useEffect, useState } from 'react'
import analyticsApi from '../../api/analytics'
import AnalyticsGoogleMap from './AnalyticsGoogleMap'

const REFERENCE_RANGES = {
  bp_systolic: { min: 90, max: 140, unit: 'mmHg', name: 'BP Systolic' },
  bp_diastolic: { min: 60, max: 90, unit: 'mmHg', name: 'BP Diastolic' },
  pr: { min: 60, max: 100, unit: 'bpm', name: 'Pulse Rate' },
  spo2: { min: 95, max: 100, unit: '%', name: 'SpO2' },
  temperature: { min: 36.1, max: 37.2, unit: '°C', name: 'Temperature' },
  rr: { min: 12, max: 20, unit: '/min', name: 'Resp. Rate' },
  grbs: { min: 70, max: 140, unit: 'mg/dL', name: 'GRBS' },
}

const getVitalStatus = (vitalKey, value) => {
  if (value === null || value === undefined || isNaN(value)) {
    return { status: 'Unknown', color: '#64748b' }
  }
  const ref = REFERENCE_RANGES[vitalKey]
  if (!ref) return { status: 'Unknown', color: '#64748b' }

  let val = value
  if (vitalKey === 'temperature' && val > 50) {
    // Convert Fahrenheit to Celsius
    val = ((val - 32) * 5) / 9
  }

  if (val < ref.min) {
    return { status: 'Low', color: '#3b82f6' } // Blue
  } else if (val > ref.max) {
    return { status: 'High', color: '#ef4444' } // Red
  } else {
    return { status: 'Normal', color: '#10b981' } // Emerald
  }
}

function formatGender(gender) {
  if (!gender) return 'Unknown'
  const canonical = gender.trim().toLowerCase()
  if (canonical === 'female') return 'Female'
  if (canonical === 'male') return 'Male'
  return gender
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

export default function PatientVitalsMap({ selectedVital }) {
  const [loading, setLoading] = useState(true)
  const [patients, setPatients] = useState([])

  useEffect(() => {
    let cancelled = false
    async function loadData() {
      try {
        setLoading(true)
        const res = await analyticsApi.getPatientVitalsLocations()
        if (!cancelled && res.success) {
          setPatients(res.data || [])
        }
      } catch (err) {
        console.error('Error fetching patient vitals locations:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadData()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex h-[250px] items-center justify-center rounded-lg border border-dashed border-muted-foreground/20 bg-muted/20">
        <span className="text-xs text-muted-foreground animate-pulse">Loading map…</span>
      </div>
    )
  }

  // Filter patients with coordinates
  const validPatients = patients.filter(
    (p) => p.latitude !== null && p.longitude !== null && !isNaN(p.latitude) && !isNaN(p.longitude)
  )

  const ref = REFERENCE_RANGES[selectedVital] || { min: 0, max: 999, unit: '', name: selectedVital }

  const points = validPatients.map((p) => {
    const value = p.vitals?.[selectedVital]
    const { status, color } = getVitalStatus(selectedVital, value)
    const age = getAge(p.date_of_birth)

    const formattedValue = value !== null && value !== undefined ? `${value} ${ref.unit}` : 'Not Recorded'

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
    details.push({ label: ref.name, value: formattedValue })
    details.push({ label: 'Status', value: status })

    return {
      id: p.patient_id,
      latitude: p.latitude,
      longitude: p.longitude,
      color,
      radius: 8,
      popupTitle: p.patient_name,
      popupSubtitle: p.address || p.district,
      popupDetails: details,
    }
  })

  return (
    <div className="flex h-full flex-col justify-between">
      <div className="flex-1 min-h-[250px] w-full">
        <AnalyticsGoogleMap points={points} showZones={true} height="100%" />
      </div>

      {/* Vitals Legend */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center text-xs border-t border-border pt-3">
        <div className="text-muted-foreground font-medium">
          Normal Range: {ref.min}-{ref.max} {ref.unit}
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#3b82f6] border border-card shadow-md" />
          <span className="text-muted-foreground">Low (&lt; {ref.min})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#10b981] border border-card shadow-md" />
          <span className="text-muted-foreground">Normal</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#ef4444] border border-card shadow-md" />
          <span className="text-muted-foreground">High (&gt; {ref.max})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#64748b] border border-card shadow-md" />
          <span className="text-muted-foreground">Unknown</span>
        </div>
      </div>
    </div>
  )
}
