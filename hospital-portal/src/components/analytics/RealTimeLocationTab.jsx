import React, { useState, useEffect, useMemo } from 'react'
import { analyticsApi } from '../../api/analytics'
import orgsApi from '../../api/orgs'
import addPatientApi from '../add-patient/addPatientApi'
import AnalyticsGoogleMap from './AnalyticsGoogleMap'
import { 
  Search, 
  MapPin, 
  Clock, 
  Navigation, 
  Activity, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Car
} from 'lucide-react'

// Read the live per-org accent so charts respect branding.
function getAccentColor() {
  if (typeof window === 'undefined') return '#0284c7'
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent-color')
    .trim()
  return v || '#0284c7'
}

// Hardcoded fallbacks for hospital coordinates
const HARDCODED_HOSPITALS = {
  KMIO: { lat: 12.9337, lng: 77.5713, name: 'Kidwai Memorial Institute of Oncology' },
  KCGH: { lat: 13.0067, lng: 77.5747, name: 'KC General Hospital' },
  KIMS: { lat: 12.9565, lng: 77.5743, name: 'Kempegowda Institute of Medical Sciences' }
};

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

export default function RealTimeLocationTab() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [patients, setPatients] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPatientId, setSelectedPatientId] = useState(null)
  const [showTraffic, setShowTraffic] = useState(true)
  const [routeDetails, setRouteDetails] = useState(null)
  const [showDispatchAlert, setShowDispatchAlert] = useState(false)
  const [hospitalData, setHospitalData] = useState(null)

  const accent = getAccentColor()

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [patientsRes, orgRes, hospitalRes] = await Promise.all([
        analyticsApi.getPatientLocations(),
        orgsApi.getMine(),
        addPatientApi.getHospitalOptions()
      ])

      if (patientsRes.success) {
        setPatients(patientsRes.data || [])
      }

      const activeOrg = orgRes.active_org || null
      const hospitalsList = hospitalRes.options || []

      if (activeOrg) {
        const hospitalCode = activeOrg.linked_hospital_code
        // Find matching hospital option with coordinates
        const matched = hospitalsList.find(
          (h) => h.code === hospitalCode && h.lat !== undefined && h.lng !== undefined && h.lat !== null && h.lng !== null
        )
        if (matched) {
          setHospitalData({
            name: matched.name,
            code: matched.code,
            lat: matched.lat,
            lng: matched.lng
          })
        } else {
          // Hardcoded fallback
          const fallback = HARDCODED_HOSPITALS[hospitalCode]
          if (fallback) {
            setHospitalData({
              name: fallback.name,
              code: hospitalCode,
              lat: fallback.lat,
              lng: fallback.lng
            })
          }
        }
      }
    } catch (err) {
      console.error('Error fetching dashboard locations data:', err)
      setError(err.response?.data?.message || 'Failed to load locations data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filter patients with valid coordinates
  const validPatients = useMemo(() => {
    return patients.filter(
      (p) => p.latitude !== null && p.longitude !== null && !isNaN(p.latitude) && !isNaN(p.longitude)
    )
  }, [patients])

  // Place hospital from DB, fallback to centroid
  const hospitalLocation = useMemo(() => {
    if (hospitalData) {
      return { lat: hospitalData.lat, lng: hospitalData.lng }
    }
    if (validPatients.length === 0) {
      return { lat: 12.9716, lng: 77.5946 } // Default Bangalore
    }
    const avgLat = validPatients.reduce((sum, p) => sum + p.latitude, 0) / validPatients.length
    const avgLng = validPatients.reduce((sum, p) => sum + p.longitude, 0) / validPatients.length
    
    // Offset slightly North-East (~1.5km) to simulate a nearby clinic/hospital base
    return { lat: avgLat + 0.012, lng: avgLng + 0.012 }
  }, [validPatients, hospitalData])

  // Haversine distance helper
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const buckets = useMemo(() => {
    const bList = [
      { label: 'Within 5 km', min: 0, max: 5, count: 0 },
      { label: '5 to 10 km', min: 5, max: 10, count: 0 },
      { label: '10 to 20 km', min: 10, max: 20, count: 0 },
      { label: '20 to 30 km', min: 20, max: 30, count: 0 },
      { label: '30 to 40 km', min: 30, max: 40, count: 0 },
      { label: '40 to 50 km', min: 40, max: 50, count: 0 },
      { label: 'Greater than 50 km', min: 50, max: Infinity, count: 0 }
    ];

    if (hospitalLocation && validPatients.length > 0) {
      validPatients.forEach(patient => {
        const dist = getDistance(
          hospitalLocation.lat,
          hospitalLocation.lng,
          Number(patient.latitude),
          Number(patient.longitude)
        );
        const bucket = bList.find(b => dist >= b.min && dist < b.max);
        if (bucket) {
          bucket.count++;
        }
      });
    }
    return bList;
  }, [hospitalLocation, validPatients]);

  // Selected patient object
  const selectedPatient = useMemo(() => {
    return validPatients.find((p) => p.patient_id === selectedPatientId || `patient-${p.patient_id}` === selectedPatientId) || null
  }, [validPatients, selectedPatientId])

  // Coordinates array passed to the Google Map
  const mapPoints = useMemo(() => {
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

      details.push({ label: 'Gender', value: p.gender || 'Unknown' })
      details.push({ label: 'BSC Status', value: p.bsc_status === true ? 'BSC' : p.bsc_status === false ? 'Non-BSC' : 'Not Yet Determined' })
      details.push({ label: 'Zone', value: p.zone || 'Unknown' })
      details.push({ label: 'Status', value: p.is_deceased ? 'Deceased' : 'Alive' })

      return {
        id: `patient-${p.patient_id}`,
        patient_id: p.patient_id,
        latitude: p.latitude,
        longitude: p.longitude,
        color: p.is_deceased ? '#EF4444' : '#6366F1',
        radius: 8,
        popupTitle: p.patient_name,
        popupSubtitle: p.address || p.district || 'Unknown Address',
        popupDetails: details,
      }
    })

    // Append the hospital base marker
    points.push({
      id: 'hospital-base',
      isHospital: true,
      latitude: hospitalLocation.lat,
      longitude: hospitalLocation.lng,
      popupTitle: hospitalData ? hospitalData.name : 'Organization Clinic Base',
      popupSubtitle: hospitalData ? `Code: ${hospitalData.code}` : 'Referral Hub',
      popupDetails: [
        { label: 'Status', value: 'Active Base' }
      ]
    })

    return points
  }, [validPatients, hospitalLocation, hospitalData])

  const routeOrigin = useMemo(() => hospitalLocation, [hospitalLocation])
  
  const routeDestination = useMemo(() => {
    if (!selectedPatient) return null
    return { lat: selectedPatient.latitude, lng: selectedPatient.longitude }
  }, [selectedPatient])

  const handleSelectPatient = (point) => {
    if (point.isHospital) return
    setSelectedPatientId(point.id || `patient-${point.patient_id}`)
    setShowDispatchAlert(false)
  }

  const handleClearRoute = () => {
    setSelectedPatientId(null)
    setRouteDetails(null)
    setShowDispatchAlert(false)
  }

  const handleSimulateDispatch = () => {
    setShowDispatchAlert(true)
    setTimeout(() => {
      setShowDispatchAlert(false)
    }, 4000)
  }

  if (loading) {
    return (
      <div className="flex h-[450px] items-center justify-center bg-muted/10 border border-border rounded-lg">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading real-time map data…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-[450px] flex-col items-center justify-center gap-2 bg-muted/10 border border-border rounded-lg">
        <p className="text-sm text-red-600">{error}</p>
        <button className="btn btn-secondary text-xs" onClick={loadPatients}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[550px] min-h-[500px]">
        {/* Main Map View */}
        <div className="lg:col-span-2 relative border border-border rounded-lg overflow-hidden h-full">
          <AnalyticsGoogleMap
            points={mapPoints}
            showZones={false}
            selectedPointId={selectedPatientId}
            routeOrigin={routeOrigin}
            routeDestination={routeDestination}
            showTraffic={showTraffic}
            onPointClick={handleSelectPatient}
            onRouteCalculated={setRouteDetails}
            radiusCenter={hospitalLocation}
            height="100%"
          />

          {/* Floating Toggle Controls */}
          <div className="absolute top-3 right-3 bg-card/90 backdrop-blur-sm border border-border rounded-lg shadow-lg p-2.5 flex flex-col gap-2 z-10 text-xs">
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium text-foreground flex items-center gap-1.5">
                <Car className="h-3.5 w-3.5 text-muted-foreground" />
                Live Traffic Layer
              </span>
              <button
                onClick={() => setShowTraffic(!showTraffic)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                  showTraffic ? 'bg-indigo-600' : 'bg-muted-foreground/30'
                }`}
                role="switch"
                aria-checked={showTraffic}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-200 ${
                    showTraffic ? 'translate-x-4' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Floating Route Info Dashboard */}
          {selectedPatient && routeDetails && (
            <div className="absolute bottom-4 left-4 right-4 md:right-auto md:w-80 bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-2xl p-4 z-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    Route Details
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                      routeDetails.isMock 
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400' 
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400'
                    }`}>
                      {routeDetails.isMock ? 'Simulated' : 'Live GPS'}
                    </span>
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {hospitalData ? hospitalData.name : 'Base Clinic'} &rarr; {selectedPatient.patient_name}
                  </p>
                </div>
                <button 
                  onClick={handleClearRoute}
                  className="text-xs text-muted-foreground hover:text-foreground font-semibold px-2 py-0.5 rounded hover:bg-muted"
                >
                  Clear
                </button>
              </div>

              {/* Live Traffic or API Error Banner */}
              <div className={`mt-3 rounded-lg p-2 flex items-center gap-2 border ${
                routeDetails.isMock 
                  ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-100/50 dark:border-amber-900/30' 
                  : 'bg-red-50 dark:bg-rose-950/20 border-rose-100/50 dark:border-rose-900/30'
              }`}>
                <AlertTriangle className={`h-4 w-4 flex-shrink-0 ${routeDetails.isMock ? 'text-amber-500' : 'text-rose-500'}`} />
                <div className={`text-[11px] ${routeDetails.isMock ? 'text-amber-700 dark:text-amber-400' : 'text-rose-700 dark:text-rose-400'}`}>
                  {routeDetails.isMock ? (
                    <>
                      <span className="font-bold">Directions API Fallback:</span> Google Maps returned status <code className="bg-amber-100/40 px-1 rounded">{routeDetails.apiError}</code>. Check billing/key restrictions.
                    </>
                  ) : (
                    <>
                      <span className="font-bold">Live Traffic Delay:</span> {routeDetails.delay} additional delay on primary routes.
                    </>
                  )}
                </div>
              </div>

              {/* Travel stats */}
              <div className="mt-3.5 grid grid-cols-3 gap-2 text-center">
                <div className="bg-muted/40 rounded-lg p-2 border border-border/50">
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Distance</div>
                  <div className="text-sm font-bold text-foreground mt-0.5 tabular-nums">{routeDetails.distance}</div>
                </div>
                <div className="bg-muted/40 rounded-lg p-2 border border-border/50">
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400">Standard</div>
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">{routeDetails.duration}</div>
                </div>
                <div className="bg-rose-50/30 dark:bg-rose-950/10 rounded-lg p-2 border border-rose-100/30 dark:border-rose-900/20">
                  <div className="text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase tracking-wider">With Traffic</div>
                  <div className="text-sm font-extrabold text-rose-600 dark:text-rose-400 mt-0.5 tabular-nums">{routeDetails.durationWithTraffic}</div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 flex gap-2">
                <button 
                  onClick={handleSimulateDispatch}
                  className="flex-1 btn btn-primary !h-8 !py-0 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Navigation className="h-3.5 w-3.5" /> Dispatch Vehicle
                </button>
              </div>
            </div>
          )}

          {/* Dispatch success alert */}
          {showDispatchAlert && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-xl flex items-center gap-2 z-20 text-xs font-semibold animate-in zoom-in duration-200">
              <CheckCircle2 className="h-4 w-4" />
              <span>Emergency vehicle mock-dispatched to patient location.</span>
            </div>
          )}
        </div>

        {/* Distance Analysis Panel */}
        <div className="lg:col-span-1">
          <div className="bg-card border border-border rounded-lg shadow-sm h-full p-4 space-y-4 overflow-y-auto">
            <div className="pb-3 border-b border-border">
              <h3 className="text-base font-semibold flex items-center gap-2 text-foreground">
                <Navigation className="h-4 w-4 text-primary" />
                Distance Analysis
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Patient distribution by distance from your clinic</p>
            </div>
            
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border pb-1 mb-2">
              Total Linked: {validPatients.length} patients
            </div>

            {buckets.map((b, idx) => {
              const totalLinked = validPatients.length;
              const percentage = totalLinked > 0 ? (b.count / totalLinked) * 100 : 0;
              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-medium">
                    <span className="text-foreground">{b.label}</span>
                    <span className="text-muted-foreground font-bold bg-muted px-2 py-0.5 rounded-full font-mono">
                      {b.count} {b.count === 1 ? 'patient' : 'patients'}
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-2 rounded-full transition-all duration-500" 
                      style={{ width: `${percentage}%`, backgroundColor: accent }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 items-center justify-center text-sm">
        <span className="text-muted-foreground font-medium mr-2">Legend:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#6366F1]"></div>
          <span>Alive Patient</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#EF4444]"></div>
          <span>Deceased Patient</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-indigo-600 font-bold text-base leading-none">✚</span>
          <span>Clinic / Hospital</span>
        </div>
        <div className="flex items-center gap-2 border-l border-border pl-4">
          <span className="text-muted-foreground">Radius Rings:</span>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">5km</span>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">10km</span>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">20km</span>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400">30km</span>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 font-bold">40km</span>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400">50km</span>
        </div>
      </div>
    </div>
  );
}
