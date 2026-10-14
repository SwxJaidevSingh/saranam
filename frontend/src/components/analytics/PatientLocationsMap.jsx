import React, { useEffect, useState } from 'react';
import analyticsApi from '@/api/analytics';
import AnalyticsGeospatialMap from './AnalyticsGoogleMap';
import { Skeleton } from '@/components/ui/skeleton';

function getAge(dobString) {
  if (!dobString) return null;
  const dob = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

function formatGender(gender) {
  if (!gender) return "Unknown";
  const canonical = gender.trim().toLowerCase();
  if (canonical === 'female') return "Female";
  if (canonical === 'male') return "Male";
  return gender;
}

export default function PatientLocationsMap() {
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState([]);
  const [hospitals, setHospitals] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        setLoading(true);
        const [patientsRes, hospitalsRes] = await Promise.all([
          analyticsApi.getPatientLocations(),
          analyticsApi.getHospitals()
        ]);
        if (!cancelled) {
          if (patientsRes.success) setPatients(patientsRes.data || []);
          if (hospitalsRes.success) setHospitals(hospitalsRes.data || []);
        }
      } catch (err) {
        console.error('Error fetching patient and hospital locations:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <Skeleton className="w-full h-[300px] rounded-lg" />;
  }

  // Filter out invalid coordinates
  const validPatients = patients.filter(
    (p) => p.latitude !== null && p.longitude !== null && !isNaN(p.latitude) && !isNaN(p.longitude)
  );
  
  const validHospitals = hospitals.filter(
    (h) => h.latitude !== null && h.longitude !== null && !isNaN(h.latitude) && !isNaN(h.longitude)
  );

  const patientPoints = validPatients.map((p) => {
    const age = getAge(p.date_of_birth);
    return {
      id: `patient-${p.patient_id}`,
      latitude: p.latitude,
      longitude: p.longitude,
      color: p.is_deceased ? '#EF4444' : '#14b8a6', // Teal (brand-500) for Alive, Red for Deceased
      radius: 8,
      popupTitle: p.patient_name,
      popupSubtitle: p.address || p.district,
      popupDetails: [
        { label: 'Type', value: 'Patient Residence' },
        { label: 'Age', value: age !== null ? `${age} years` : 'Unknown' },
        { label: 'Gender', value: formatGender(p.gender) },
        { label: 'PPS Score', value: p.pps_score !== null && p.pps_score !== undefined ? String(p.pps_score) : 'Not Recorded' },
        { label: 'Zone', value: p.zone || 'Central' },
        { label: 'Linked Hospital', value: p.linked_hospital || 'None' },
        { label: 'BSC Status', value: p.bsc_status === true ? 'BSC' : p.bsc_status === false ? 'Non-BSC' : 'Not Yet Determined' },
        { label: 'Status', value: p.is_deceased ? 'Deceased' : 'Alive' }
      ]
    };
  });

  const hospitalPoints = validHospitals.map((h) => ({
    id: `hospital-${h.hospital_id}`,
    latitude: h.latitude,
    longitude: h.longitude,
    isHospital: true,
    popupTitle: h.name,
    popupSubtitle: h.address,
    popupDetails: [
      { label: 'Type', value: h.hospital_type || 'Referral Hospital' }
    ]
  }));

  const points = [...patientPoints, ...hospitalPoints];

  return (
    <div className="space-y-4">
      <AnalyticsGeospatialMap
        points={points}
        showZones={true}
        height="300px"
      />
      
      {/* Locations Legend */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center text-xs border-t border-border pt-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#14b8a6] border border-card shadow-md" />
          <span className="text-muted-foreground">Alive Patient Residence</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#EF4444] border border-card shadow-md" />
          <span className="text-muted-foreground">Deceased Patient Residence</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-indigo-600 border border-card shadow-md flex items-center justify-center">
            <span className="h-1 w-1 rounded-full bg-white" />
          </span>
          <span className="text-muted-foreground">Referral Hospital</span>
        </div>
      </div>
    </div>
  );
}
