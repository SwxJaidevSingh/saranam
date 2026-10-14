import React from 'react';
import AnalyticsGeospatialMap from './AnalyticsGoogleMap';

const ZONE_COLORS = {
  'North': '#3B82F6',   // Blue
  'South': '#10B981',   // Emerald
  'East': '#F59E0B',    // Amber
  'West': '#8B5CF6',    // Purple
  'Central': '#EF4444',  // Red
};

const GENDER_COLORS = {
  'Female': '#ec4899', // Pink
  'Male': '#0ea5e9',   // Sky Blue
  'Other': '#64748b',  // Slate
  'Unknown': '#64748b',
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

export default function DeceasedPatientsMap({ deceasedPatients }) {
  const validPatients = (deceasedPatients || []).filter(
    (p) => p.latitude !== null && p.longitude !== null && !isNaN(p.latitude) && !isNaN(p.longitude)
  );

  const points = validPatients.map((p) => {
    const genderColor = GENDER_COLORS[p.gender] || GENDER_COLORS.Unknown;
    const age = getAge(p.date_of_birth);

    const details = [];
    if (age !== null && age !== undefined && !isNaN(age)) {
      details.push({ label: 'Age', value: `${age} years` });
    } else {
      details.push({ label: 'DOB', value: p.date_of_birth ? formatDate(p.date_of_birth) : 'Unknown' });
    }

    details.push({ label: 'Gender', value: p.gender });
    details.push({ label: 'Zone', value: p.zone || 'Unknown' });
    details.push({ label: 'BSC Status', value: p.bsc_status === true ? 'BSC' : p.bsc_status === false ? 'Non-BSC' : 'Not Yet Determined' });
    details.push({ label: 'Date of Death', value: p.date_of_death ? formatDate(p.date_of_death) : 'Unknown' });
    details.push({ label: 'Visits Completed', value: String(p.visit_count || 0) });

    return {
      id: p.patient_id,
      latitude: p.latitude,
      longitude: p.longitude,
      color: genderColor,
      radius: 8,
      popupTitle: p.name,
      popupSubtitle: p.address,
      popupDetails: details,
    };
  });

  return (
    <div className="flex h-full flex-col justify-between">
      <div className="flex-1 min-h-[180px] w-full">
        <AnalyticsGeospatialMap
          points={points}
          showZones={true}
          height="100%"
        />
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 justify-between text-xs pt-3 border-t border-border">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-muted-foreground font-semibold">Gender:</span>
          {Object.entries(GENDER_COLORS).map(([gender, color]) => (
            <div key={gender} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-muted-foreground text-[11px]">{gender}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-muted-foreground font-semibold">Zones:</span>
          {Object.entries(ZONE_COLORS).map(([zone, color]) => (
            <div key={zone} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-muted-foreground text-[11px]">{zone}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
