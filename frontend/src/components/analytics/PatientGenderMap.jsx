import React, { useEffect, useState } from 'react';
import analyticsApi from '@/api/analytics';
import AnalyticsGeospatialMap from './AnalyticsGoogleMap';
import { Skeleton } from '@/components/ui/skeleton';

const GENDER_COLORS = {
  "Female": "#ec4899",
  "Male": "#0ea5e9",
  "Other / Unknown": "#64748b"
};

function getGenderColor(gender) {
  if (!gender) return GENDER_COLORS["Other / Unknown"];
  const canonical = gender.trim().toLowerCase();
  if (canonical === 'female') return GENDER_COLORS["Female"];
  if (canonical === 'male') return GENDER_COLORS["Male"];
  return GENDER_COLORS["Other / Unknown"];
}

function formatGender(gender) {
  if (!gender) return "Unknown";
  const canonical = gender.trim().toLowerCase();
  if (canonical === 'female') return "Female";
  if (canonical === 'male') return "Male";
  return gender;
}

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

export default function PatientGenderMap() {
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function loadPatients() {
      try {
        setLoading(true);
        const res = await analyticsApi.getPatientLocations();
        if (!cancelled && res.success) {
          setPatients(res.data || []);
        }
      } catch (err) {
        console.error('Error fetching patient locations for gender distribution:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadPatients();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <Skeleton className="w-full h-[300px] rounded-lg" />;
  }

  // Filter out patients without valid coordinates
  const validPatients = patients.filter(
    (p) => p.latitude !== null && p.longitude !== null && !isNaN(p.latitude) && !isNaN(p.longitude)
  );

  const points = validPatients.map((p) => {
    const color = getGenderColor(p.gender);
    const age = getAge(p.date_of_birth);
    
    return {
      id: p.patient_id,
      latitude: p.latitude,
      longitude: p.longitude,
      color: color,
      radius: 8,
      popupTitle: p.patient_name,
      popupSubtitle: p.address || p.district,
      popupDetails: [
        { label: 'Age', value: age !== null ? `${age} years` : 'Unknown' },
        { label: 'Gender', value: formatGender(p.gender) },
        { label: 'PPS Score', value: p.pps_score !== null && p.pps_score !== undefined ? String(p.pps_score) : 'Not Recorded' },
        { label: 'Zone', value: p.zone || 'Central' },
        { label: 'Linked Hospital', value: p.linked_hospital || 'None' },
        { label: 'BSC Status', value: p.bsc_status === true ? 'BSC' : p.bsc_status === false ? 'Non-BSC' : 'Not Yet Determined' }
      ],
    };
  });

  return (
    <div className="space-y-4">
      <AnalyticsGeospatialMap
        points={points}
        showZones={true}
        height="300px"
      />
      
      {/* Gender Legend */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center text-xs border-t border-border pt-3">
        <span className="text-muted-foreground font-semibold mr-1">Gender Legend:</span>
        {Object.entries(GENDER_COLORS).map(([gender, color]) => (
          <div key={gender} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border border-card shadow-sm" style={{ backgroundColor: color }} />
            <span className="text-muted-foreground">{gender}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
