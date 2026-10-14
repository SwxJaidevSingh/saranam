import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, RefreshCw, AlertCircle, X, Car } from 'lucide-react';
import AnalyticsGeospatialMap from './AnalyticsGoogleMap';
import { HOSPITALS } from '@/constants/geo';
import analyticsApi from '@/api/analytics';
import { TimelineSwitch } from './TimelineSwitch';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { subMonths, isWithinInterval, parseISO } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const RISK_COLORS = {
  'Low': '#10B981',      // success
  'Moderate': '#F59E0B', // warning
  'High': '#F97316',     // orange
  'Critical': '#EF4444'  // danger
};

export const GeospatialAnalysisView = () => {
  const [loading, setLoading] = useState(true);
  const [patientLocations, setPatientLocations] = useState([]);
  const [distributionData, setDistributionData] = useState({});
  const [error, setError] = useState(null);

  // Real-time routing states
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [routeOrigin, setRouteOrigin] = useState(null);
  const [routeDestination, setRouteDestination] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [showTraffic, setShowTraffic] = useState(false);
  const [hospitals, setHospitals] = useState([]);
  const [radiusHospitalCode, setRadiusHospitalCode] = useState('All');
  
  // Status filter state
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'alive' | 'deceased' | 'active' | 'inactive'

  // Date and Age filters
  const [timelineRange, setTimelineRange] = useState('1M');
  const [dateRange, setDateRange] = useState({ from: subMonths(new Date(), 1), to: new Date() });
  const [ageFilter, setAgeFilter] = useState('all');
  const [distViewTab, setDistViewTab] = useState('chart'); // 'chart' | 'list'

  useEffect(() => {
    const fetchGeoData = async () => {
      try {
        setLoading(true);
        const [locationsRes, distRes, hospitalsRes] = await Promise.all([
          analyticsApi.getPatientLocations(),
          analyticsApi.getGeoDistribution(),
          analyticsApi.getHospitalOptions()
        ]);

        if (locationsRes?.success) {
          setPatientLocations(locationsRes.data || []);
        }
        if (distRes?.success) {
          setDistributionData(distRes.data || {});
        }
        setHospitals(hospitalsRes?.options || []);

      } catch (err) {
        console.error('Error fetching geospatial data:', err);
        setError('Failed to load geospatial analytics.');
      } finally {
        setLoading(false);
      }
    };

    fetchGeoData();
  }, []);

  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient);
    
    // Find the patient's linked hospital coordinates
    const matchedHospital = hospitals.find(
      (h) => h.code === patient.linked_hospital && 
             h.lat !== null && h.lng !== null && 
             !isNaN(Number(h.lat)) && !isNaN(Number(h.lng))
    );

    if (matchedHospital) {
      setRouteOrigin({ lat: Number(matchedHospital.lat), lng: Number(matchedHospital.lng) });
    } else {
      // Try hardcoded constants fallback for the linked hospital code first
      const hardcodedHospital = HOSPITALS[patient.linked_hospital];
      if (hardcodedHospital && hardcodedHospital.lat && hardcodedHospital.lng) {
        setRouteOrigin({ lat: Number(hardcodedHospital.lat), lng: Number(hardcodedHospital.lng) });
      } else {
        // Fallback: search for any active default hospital or use Bangalore center
        const defaultHospital = hospitals.find(
          (h) => h.is_default && h.lat !== null && h.lng !== null && 
                 !isNaN(Number(h.lat)) && !isNaN(Number(h.lng))
        ) || hospitals.find(
          (h) => h.lat !== null && h.lng !== null && 
                 !isNaN(Number(h.lat)) && !isNaN(Number(h.lng))
        );

        if (defaultHospital) {
          setRouteOrigin({ lat: Number(defaultHospital.lat), lng: Number(defaultHospital.lng) });
        } else {
          // Check if default hardcoded exists
          const defaultHardcoded = HOSPITALS['KMIO'];
          if (defaultHardcoded) {
            setRouteOrigin({ lat: Number(defaultHardcoded.lat), lng: Number(defaultHardcoded.lng) });
          } else {
            setRouteOrigin({ lat: 12.9716, lng: 77.5946 }); // Default Bangalore
          }
        }
      }
    }

    setRouteDestination({ lat: Number(patient.latitude), lng: Number(patient.longitude) });
    setRouteInfo(null); // Reset route info
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6">
        <Skeleton className="h-[500px] w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return <div className="text-danger-500 font-medium">{error}</div>;
  }

  // Filter out invalid/non-numeric patient coordinates
  const validLocations = patientLocations.filter(
    (p) => p.latitude !== null && p.longitude !== null && 
           !isNaN(Number(p.latitude)) && !isNaN(Number(p.longitude))
  );

  // Parse valid hospital locations
  const hospitalPoints = hospitals
    .map((h) => {
      let lat = h.lat;
      let lng = h.lng;
      
      // Fallback to hardcoded coordinates if missing
      if (lat === null || lng === null || isNaN(Number(lat)) || isNaN(Number(lng))) {
        const fallback = HOSPITALS[h.code];
        if (fallback) {
          lat = fallback.lat;
          lng = fallback.lng;
        }
      }
      
      return {
        id: h.code,
        latitude: lat !== null ? Number(lat) : null,
        longitude: lng !== null ? Number(lng) : null,
        isHospital: true,
        popupTitle: h.name,
        popupSubtitle: `${h.code} Clinic`,
        popupDetails: [
          { label: 'State', value: h.state || 'Karnataka' },
          { label: 'Coordinates', value: lat && lng ? `${lat}, ${lng}` : 'Unconfigured' }
        ]
      };
    })
    .filter((h) => h.latitude !== null && h.longitude !== null && !isNaN(h.latitude) && !isNaN(h.longitude));

  // Get hospital coordinates helper
  const getHospitalCoords = (hospitalCode) => {
    const h = hospitals.find((item) => item.code === hospitalCode);
    if (h && h.lat !== null && h.lng !== null && !isNaN(Number(h.lat)) && !isNaN(Number(h.lng))) {
      return { lat: Number(h.lat), lng: Number(h.lng) };
    }
    const fallback = HOSPITALS[hospitalCode];
    if (fallback && fallback.lat && fallback.lng) {
      return { lat: Number(fallback.lat), lng: Number(fallback.lng) };
    }
    return null;
  };

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

  // Filter patient locations by selected clinic
  let filteredLocations = radiusHospitalCode !== 'All'
    ? validLocations.filter(p => p.linked_hospital === radiusHospitalCode)
    : validLocations;

  // Filter patient locations by selected status
  if (statusFilter === 'alive') {
    filteredLocations = filteredLocations.filter(p => !p.is_deceased);
  } else if (statusFilter === 'deceased') {
    filteredLocations = filteredLocations.filter(p => p.is_deceased);
  } else if (statusFilter === 'active') {
    filteredLocations = filteredLocations.filter(p => p.is_active);
  } else if (statusFilter === 'inactive') {
    filteredLocations = filteredLocations.filter(p => !p.is_active);
  }

  // Filter patient locations by age group
  if (ageFilter !== 'all') {
    filteredLocations = filteredLocations.filter(p => {
      const age = p.age;
      if (age === null || age === undefined) return false;
      if (ageFilter === 'child_adolescent') return age < 20;
      if (ageFilter === 'adults') return age >= 20 && age < 60;
      if (ageFilter === 'older_adults') return age >= 60;
      return true;
    });
  }

  // Filter patient locations by registration date
  if (timelineRange !== 'Max' && dateRange?.from && dateRange?.to) {
    filteredLocations = filteredLocations.filter(p => {
      if (!p.registration_date) return false;
      try {
        const pDate = parseISO(p.registration_date);
        return isWithinInterval(pDate, { start: dateRange.from, end: dateRange.to });
      } catch (err) {
        return false;
      }
    });
  }

  const filteredHospitalPoints = radiusHospitalCode !== 'All'
    ? hospitalPoints.filter(h => h.id === radiusHospitalCode)
    : hospitalPoints;

  // Selected hospital coordinates for rings
  const selectedHospitalCoords = radiusHospitalCode !== 'All' ? getHospitalCoords(radiusHospitalCode) : null;

  // Calculate radius buckets
  const buckets = [
    { label: 'Within 5 km', min: 0, max: 5, count: 0 },
    { label: '5 to 10 km', min: 5, max: 10, count: 0 },
    { label: '10 to 20 km', min: 10, max: 20, count: 0 },
    { label: '20 to 30 km', min: 20, max: 30, count: 0 },
    { label: '30 to 40 km', min: 30, max: 40, count: 0 },
    { label: '40 to 50 km', min: 40, max: 50, count: 0 },
    { label: 'Greater than 50 km', min: 50, max: Infinity, count: 0 }
  ];

  filteredLocations.forEach(patient => {
    // 1. Get pre-calculated driving distance if available
    let dist = patient.drive_distance_km !== undefined && patient.drive_distance_km !== null
      ? Number(patient.drive_distance_km)
      : (patient.external_metadata || {}).drive_distance_km !== undefined
        ? Number((patient.external_metadata || {}).drive_distance_km)
        : null;

    // 2. Fallback to Haversine straight-line distance if no driving distance recorded
    if (dist === null || isNaN(dist)) {
      const hospitalCode = radiusHospitalCode !== 'All' ? radiusHospitalCode : (patient.linked_hospital || 'KMIO');
      const coords = getHospitalCoords(hospitalCode);
      if (coords) {
        dist = getDistance(
          coords.lat,
          coords.lng,
          Number(patient.latitude),
          Number(patient.longitude)
        );
      }
    }

    if (dist !== null && !isNaN(dist)) {
      const bucket = buckets.find(b => dist >= b.min && dist < b.max);
      if (bucket) {
        bucket.count++;
      }
    }
  });

  // Calculate center of map (default or average of points)
  let center = [12.9716, 77.5946]; // Default to Bangalore
  if (selectedHospitalCoords) {
    center = [selectedHospitalCoords.lat, selectedHospitalCoords.lng];
  } else if (filteredLocations.length > 0) {
    const avgLat = filteredLocations.reduce((sum, p) => sum + Number(p.latitude), 0) / filteredLocations.length;
    const avgLng = filteredLocations.reduce((sum, p) => sum + Number(p.longitude), 0) / filteredLocations.length;
    center = [avgLat, avgLng];
  }

  const getRiskBadge = (level) => {
    const variants = {
      'Low': 'bg-success-100 text-success-800 hover:bg-success-100',
      'Moderate': 'bg-warning-100 text-warning-800 hover:bg-warning-100',
      'High': 'bg-orange-100 text-orange-800 hover:bg-orange-100',
      'Critical': 'bg-danger-100 text-danger-800 hover:bg-danger-100'
    };
    return <Badge variant="outline" className={variants[level] || 'bg-gray-100 text-gray-800 px-2 py-0.5'}>{level}</Badge>;
  };

  const mapPoints = [
    ...filteredLocations.map((patient) => ({
      id: patient.patient_id,
      latitude: Number(patient.latitude),
      longitude: Number(patient.longitude),
      color: patient.is_deceased ? '#EF4444' : '#6366F1',
      radius: 8,
      popupTitle: patient.patient_name,
      popupSubtitle: patient.district,
      popupDetails: [
        { 
          label: patient.age !== null && patient.age !== undefined ? 'Age' : 'DoB', 
          value: patient.age !== null && patient.age !== undefined ? `${patient.age} years` : (patient.date_of_birth || 'Unknown') 
        },
        { label: 'Address', value: patient.address || 'Not Recorded' },
        { label: 'Zone', value: patient.zone || 'Central' },
        { label: 'BSC Status', value: patient.bsc_status || 'Not Yet Determined' },
        { label: 'Linked Clinic', value: patient.linked_hospital || 'Not Linked' },
        { label: 'Status', value: patient.is_deceased ? 'Deceased' : 'Alive' },
        { label: 'Activity', value: patient.is_active ? 'Active' : 'Inactive' }
      ]
    })),
    ...filteredHospitalPoints
  ];

  const renderMapContainer = () => (
    <>
      <AnalyticsGeospatialMap
        points={mapPoints}
        showZones={true}
        height="500px"
        zoom={10}
        center={center}
        selectedPointId={selectedPatient ? selectedPatient.patient_id : null}
        onPointClick={(point) => {
          const patient = patientLocations.find(p => p.patient_id === point.id);
          if (patient) {
            handleSelectPatient(patient);
          }
        }}
        routeOrigin={routeOrigin}
        routeDestination={routeDestination}
        showTraffic={showTraffic}
        onRouteCalculated={(info) => setRouteInfo(info)}
        radiusCenter={selectedHospitalCoords}
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
              showTraffic ? 'bg-primary' : 'bg-muted-foreground/30'
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

      {/* Floating Routing Panel */}
      {selectedPatient && (
        <div className="absolute bottom-4 left-4 z-10 w-80 bg-background/95 backdrop-blur border border-border rounded-xl shadow-lg overflow-hidden transition-all duration-300">
          <div className="p-4 border-b border-border flex justify-between items-start">
            <div>
              <h4 className="font-semibold text-sm text-foreground">{selectedPatient.patient_name}</h4>
              <p className="text-xs text-muted-foreground">{selectedPatient.district}</p>
            </div>
            <button
              onClick={() => {
                setSelectedPatient(null);
                setRouteOrigin(null);
                setRouteDestination(null);
                setRouteInfo(null);
              }}
              className="p-1 hover:bg-muted rounded-full text-muted-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">
                {selectedPatient.age !== null && selectedPatient.age !== undefined ? 'Age:' : 'DoB:'}
              </span>
              <span className="font-semibold text-foreground">
                {selectedPatient.age !== null && selectedPatient.age !== undefined 
                  ? `${selectedPatient.age} years` 
                  : (selectedPatient.date_of_birth || 'Unknown')}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Address:</span>
              <span className="font-semibold text-foreground text-right max-w-[180px] truncate" title={selectedPatient.address}>
                {selectedPatient.address || 'Not Recorded'}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Zone:</span>
              <span className="font-semibold text-foreground">
                {selectedPatient.zone || 'Central'}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">BSC Status:</span>
              <span className="font-semibold text-foreground">
                {selectedPatient.bsc_status || 'Not Yet Determined'}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Linked Hospital:</span>
              <span className="font-semibold text-foreground">
                {selectedPatient.linked_hospital || 'None'}
              </span>
            </div>

            {routeInfo ? (
              <div className="pt-2 border-t border-border space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Distance:</span>
                  <span className="font-medium text-foreground">{routeInfo.distance}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Standard Est:</span>
                  <span className="font-medium text-foreground">{routeInfo.duration}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">With Traffic:</span>
                  <span className="font-medium text-foreground text-indigo-600 dark:text-indigo-400">
                    {routeInfo.durationWithTraffic}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Traffic Delay:</span>
                  <span className={`font-medium ${routeInfo.delay !== 'No delay' ? 'text-amber-500' : 'text-success-500'}`}>
                    {routeInfo.delay}
                  </span>
                </div>

                {routeInfo.isMock && (
                  <div className="mt-3 flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg text-[10px] leading-tight">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Simulated Fallback</span>
                      <br />
                      Directions API returned status: <code className="font-mono bg-amber-500/20 px-1 rounded">{routeInfo.apiError || 'UNKNOWN'}</code>
                    </div>
                  </div>
                )}

                {!routeInfo.isMock && (
                  <div className="mt-3 flex items-start gap-2 p-2 bg-success-500/10 border border-success-500/20 text-success-600 dark:text-success-400 rounded-lg text-[10px] leading-tight">
                    <div className="w-1.5 h-1.5 rounded-full bg-success-500 animate-ping mt-1"></div>
                    <div>
                      <span className="font-bold text-success-600 dark:text-success-400">Live GPS Routing Active</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="pt-4 border-t border-border flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>Calculating transit route...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );

  const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#6B7280'];

  const chartData = buckets
    .map((b, index) => ({
      name: b.label,
      value: b.count,
      color: COLORS[index % COLORS.length]
    }))
    .filter(item => item.value > 0);

  const renderDistViewSwitcher = () => (
    <div className="inline-flex items-center p-0.5 bg-muted rounded-lg border border-border shadow-sm">
      <button
        onClick={() => setDistViewTab('chart')}
        className={`px-2 py-1 text-[10px] font-semibold rounded-md transition-all ${
          distViewTab === 'chart'
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Pie Chart
      </button>
      <button
        onClick={() => setDistViewTab('list')}
        className={`px-2 py-1 text-[10px] font-semibold rounded-md transition-all ${
          distViewTab === 'list'
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        List
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card className="shadow-sm border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Patient Geospatial Distribution
          </CardTitle>
          <CardDescription>Hotspot detection and demographic mapping by risk level</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters Selector Panel */}
          <div className="flex flex-wrap gap-6 items-center mb-6">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="hospital-select" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Focus Clinic / Hospital
              </label>
              <select
                id="hospital-select"
                value={radiusHospitalCode}
                onChange={(e) => {
                  setRadiusHospitalCode(e.target.value);
                  setSelectedPatient(null);
                  setRouteOrigin(null);
                  setRouteDestination(null);
                  setRouteInfo(null);
                }}
                className="w-72 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all cursor-pointer font-medium"
              >
                <option value="All">All Clinics & Patients</option>
                {hospitals.map(h => (
                  <option key={h.code} value={h.code}>{h.name} ({h.code})</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Patient Status Filter
              </span>
              <div className="inline-flex p-1 bg-muted/60 backdrop-blur-sm rounded-lg border border-border shadow-sm">
                {[
                  { value: 'all', label: 'All' },
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                  { value: 'alive', label: 'Alive' },
                  { value: 'deceased', label: 'Deceased' }
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => {
                      setStatusFilter(item.value);
                      setSelectedPatient(null);
                      setRouteOrigin(null);
                      setRouteDestination(null);
                      setRouteInfo(null);
                    }}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                      statusFilter === item.value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Age Group
              </span>
              <Select value={ageFilter} onValueChange={(val) => {
                setAgeFilter(val);
                setSelectedPatient(null);
                setRouteOrigin(null);
                setRouteDestination(null);
                setRouteInfo(null);
              }}>
                <SelectTrigger className="w-[150px] h-9 text-xs font-semibold bg-background border-border">
                  <SelectValue placeholder="Age Group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Ages</SelectItem>
                  <SelectItem value="child_adolescent" className="text-xs">Child & Adolescent (&lt;20)</SelectItem>
                  <SelectItem value="adults" className="text-xs">Adults (20-59)</SelectItem>
                  <SelectItem value="older_adults" className="text-xs">Older Adults (&gt;=60)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Timeline
              </span>
              <TimelineSwitch
                value={timelineRange}
                onChange={(val, range) => {
                  setTimelineRange(val);
                  setDateRange(range);
                  setSelectedPatient(null);
                  setRouteOrigin(null);
                  setRouteDestination(null);
                  setRouteInfo(null);
                }}
                className="h-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 relative w-full rounded-lg overflow-hidden border border-border">
              {renderMapContainer()}
            </div>
            
            <div className="lg:col-span-1">
              <Card className="shadow-sm border-border bg-card h-full flex flex-col justify-between">
                <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Navigation className="h-4.5 w-4.5 text-primary" />
                      Distance Analysis
                    </CardTitle>
                    <CardDescription>
                      {radiusHospitalCode !== 'All' 
                        ? 'Patient distribution by distance from selected hospital' 
                        : 'Patient distribution by distance from their linked hospital'}
                    </CardDescription>
                  </div>
                  {renderDistViewSwitcher()}
                </CardHeader>
                <CardContent className="space-y-4 flex-1">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border pb-1 mb-2">
                    Total Linked: {filteredLocations.length} patients
                  </div>
                  
                  {distViewTab === 'chart' ? (
                    <div>
                      {chartData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-xs font-medium">
                          <span>No distance data matches active filters</span>
                        </div>
                      ) : (
                        <>
                          <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                              <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={45}
                                outerRadius={70}
                                paddingAngle={3}
                                dataKey="value"
                              >
                                {chartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(value, name) => [`${value} patients`, name]}
                                contentStyle={{
                                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                  borderRadius: '8px',
                                  border: '1px solid #e2e8f0',
                                  fontSize: '11px',
                                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            {chartData.map((entry, index) => (
                              <div key={index} className="flex items-center gap-1.5 text-[10px] font-medium text-foreground">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                                <span className="truncate">{entry.name}: <strong>{entry.value}</strong></span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    buckets.map((b, idx) => {
                      const totalLinked = filteredLocations.length;
                      const percentage = totalLinked > 0 ? (b.count / totalLinked) * 100 : 0;
                      return (
                        <div key={idx} className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs font-medium">
                            <span className="text-foreground">{b.label}</span>
                            <span className="text-muted-foreground font-bold bg-muted px-2 py-0.5 rounded-full">
                              {b.count} {b.count === 1 ? 'patient' : 'patients'}
                            </span>
                          </div>
                          <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-primary h-2 rounded-full transition-all duration-500" 
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-4 items-center justify-center text-sm">
            <span className="text-muted-foreground font-medium mr-2">Legend:</span>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-full bg-[#6366F1]"></div>
              <span>Alive Patient</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-full bg-[#EF4444]"></div>
              <span>Deceased Patient</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-indigo-600 font-bold text-base leading-none">✚</span>
              <span>Clinic / Hospital</span>
            </div>
            
            <span className="text-muted-foreground font-medium mx-2">|</span>
            <span className="text-muted-foreground font-medium mr-2">Zones:</span>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-[#3B82F6]" />
                <span>North</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]" />
                <span>South</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" />
                <span>East</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-[#8B5CF6]" />
                <span>West</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-[#EF4444]" />
                <span>Central</span>
              </div>
            </div>

            {radiusHospitalCode !== 'All' && (
              <>
                <span className="text-muted-foreground font-medium mx-2">|</span>
                <span className="text-muted-foreground font-medium mr-2">Radius Rings:</span>
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-1 border-t-2 border-[#10B981]"></div>
                    <span className="text-xs text-muted-foreground">5 km</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-1 border-t-2 border-[#3B82F6]"></div>
                    <span className="text-xs text-muted-foreground">10 km</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-1 border-t-2 border-[#F59E0B]"></div>
                    <span className="text-xs text-muted-foreground">20 km</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-1 border-t-2 border-[#F97316]"></div>
                    <span className="text-xs text-muted-foreground">30 km</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-1 border-t-2 border-[#EF4444]"></div>
                    <span className="text-xs text-muted-foreground">40 km</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-1 border-t-2 border-[#7C3AED]"></div>
                    <span className="text-xs text-muted-foreground">50 km</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
