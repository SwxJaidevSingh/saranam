import React, { useEffect, useState } from 'react';
import analyticsApi from '@/api/analytics';
import AnalyticsGeospatialMap from './AnalyticsGoogleMap';
import { Skeleton } from '@/components/ui/skeleton';

const AGE_COLORS = {
  "Infant (0-1)": "#ec4899",
  "Young child (2-4)": "#c084fc",
  "Child (5-9)": "#6366f1",
  "Adolescent (10-19)": "#06b6d4",
  "Young adult (20-29)": "#10b981",
  "Adult (30-44)": "#a3e635",
  "Middle-aged (45-59)": "#f59e0b",
  "Senior (60-79)": "#f97316",
  "Super senior (80+)": "#ef4444",
  "Unknown (no DOB)": "#64748b"
};

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

function getAgeCohort(age) {
  if (age === null || age === undefined || isNaN(age)) return "Unknown (no DOB)";
  if (age <= 1) return "Infant (0-1)";
  if (age <= 4) return "Young child (2-4)";
  if (age <= 9) return "Child (5-9)";
  if (age <= 19) return "Adolescent (10-19)";
  if (age <= 29) return "Young adult (20-29)";
  if (age <= 44) return "Adult (30-44)";
  if (age <= 59) return "Middle-aged (45-59)";
  if (age <= 79) return "Senior (60-79)";
  return "Super senior (80+)";
}

export default function PatientAgeMap() {
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
        console.error('Error fetching patient locations for age distribution:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadPatients();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <Skeleton className="w-full h-[340px] rounded-lg" />;
  }

  // Filter out patients without valid coordinates
  const validPatients = patients.filter(
    (p) => p.latitude !== null && p.longitude !== null && !isNaN(p.latitude) && !isNaN(p.longitude)
  );

  const points = validPatients.map((p) => {
    const age = getAge(p.date_of_birth);
    const cohort = getAgeCohort(age);
    const color = AGE_COLORS[cohort] || AGE_COLORS["Unknown (no DOB)"];
    
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
        { label: 'Gender', value: p.gender || 'Unknown' },
        { label: 'PPS Score', value: p.pps_score !== null && p.pps_score !== undefined ? String(p.pps_score) : 'Not Recorded' },
        { label: 'Zone', value: p.zone || 'Central' },
        { label: 'Linked Hospital', value: p.linked_hospital || 'None' },
        { label: 'BSC Status', value: p.bsc_status === true ? 'BSC' : p.bsc_status === false ? 'Non-BSC' : 'Not Yet Determined' },
        { label: 'Cohort', value: cohort }
      ],
    };
  });

  return (
    <div className="space-y-4">
      <AnalyticsGeospatialMap
        points={points}
        showZones={true}
        height="340px"
      />
      
      {/* Age Cohort Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center text-[10px] border-t border-border pt-3">
        <span className="text-muted-foreground font-semibold mr-1">Cohort Legend:</span>
        {Object.entries(AGE_COLORS).map(([cohort, color]) => (
          <div key={cohort} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full border border-card shadow-sm" style={{ backgroundColor: color }} />
            <span className="text-muted-foreground">{cohort}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
