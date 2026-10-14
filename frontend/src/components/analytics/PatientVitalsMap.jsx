import React, { useEffect, useState } from 'react';
import analyticsApi from '@/api/analytics';
import AnalyticsGeospatialMap from './AnalyticsGoogleMap';
import { Skeleton } from '@/components/ui/skeleton';

const REFERENCE_RANGES = {
  bp_systolic: { min: 90, max: 140, unit: 'mmHg', name: 'BP Systolic' },
  bp_diastolic: { min: 60, max: 90, unit: 'mmHg', name: 'BP Diastolic' },
  pr: { min: 60, max: 100, unit: 'bpm', name: 'Pulse Rate' },
  spo2: { min: 95, max: 100, unit: '%', name: 'SpO2' },
  temperature: { min: 36.1, max: 37.2, unit: '°C', name: 'Temperature' },
  rr: { min: 12, max: 20, unit: '/min', name: 'Resp. Rate' },
  grbs: { min: 70, max: 140, unit: 'mg/dL', name: 'GRBS' },
};

const getVitalStatus = (vitalKey, value) => {
  if (value === null || value === undefined || isNaN(value)) {
    return { status: 'Unknown', color: '#64748b' };
  }
  const ref = REFERENCE_RANGES[vitalKey];
  if (!ref) return { status: 'Unknown', color: '#64748b' };

  let val = value;
  if (vitalKey === 'temperature' && val > 50) {
    // Convert Fahrenheit to Celsius
    val = (val - 32) * 5 / 9;
  }

  if (val < ref.min) {
    return { status: 'Low', color: '#3b82f6' }; // Blue
  } else if (val > ref.max) {
    return { status: 'High', color: '#ef4444' }; // Red
  } else {
    return { status: 'Normal', color: '#10b981' }; // Emerald
  }
};

function formatGender(gender) {
  if (!gender) return "Unknown";
  const canonical = gender.trim().toLowerCase();
  if (canonical === 'female') return "Female";
  if (canonical === 'male') return "Male";
  return gender;
}

export default function PatientVitalsMap({ selectedVital, patientStatus = 'all', ageGroup = 'all' }) {
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        setLoading(true);
        const res = await analyticsApi.getPatientVitalsLocations({
          patient_status: patientStatus,
          age_group: ageGroup
        });
        if (!cancelled && res.success) {
          setPatients(res.data || []);
        }
      } catch (err) {
        console.error('Error fetching patient vitals locations:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, [patientStatus, ageGroup]);

  if (loading) {
    return <Skeleton className="w-full h-[250px] rounded-lg" />;
  }

  // Filter patients with coordinates
  const validPatients = patients.filter(
    (p) => p.latitude !== null && p.longitude !== null && !isNaN(p.latitude) && !isNaN(p.longitude)
  );

  const ref = REFERENCE_RANGES[selectedVital] || { min: 0, max: 999, unit: '', name: selectedVital };

  const points = validPatients.map((p) => {
    const value = p.vitals?.[selectedVital];
    const { status, color } = getVitalStatus(selectedVital, value);

    const formattedValue = value !== null && value !== undefined 
      ? `${value} ${ref.unit}`
      : 'Not Recorded';

    return {
      id: p.patient_id,
      latitude: p.latitude,
      longitude: p.longitude,
      color,
      radius: 8,
      popupTitle: p.patient_name,
      popupSubtitle: p.address || p.district,
      popupDetails: [
        { label: 'Type', value: 'Patient Residence' },
        { label: 'Gender', value: formatGender(p.gender) },
        { label: 'Zone', value: p.zone || 'Central' },
        { label: 'BSC Status', value: p.bsc_status === true ? 'BSC' : p.bsc_status === false ? 'Non-BSC' : 'Not Yet Determined' },
        { label: ref.name, value: formattedValue },
        { label: 'Status', value: status }
      ]
    };
  });

  return (
    <div className="space-y-4">
      <AnalyticsGeospatialMap
        points={points}
        showZones={true}
        height="250px"
      />
      
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
  );
}
