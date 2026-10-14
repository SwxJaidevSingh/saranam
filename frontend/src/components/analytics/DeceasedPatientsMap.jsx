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

export default function DeceasedPatientsMap({ deceasedPatients }) {
  const validPatients = (deceasedPatients || []).filter(
    (p) => p.latitude !== null && p.longitude !== null && !isNaN(p.latitude) && !isNaN(p.longitude)
  );

  const points = validPatients.map((p) => {
    const genderColor = GENDER_COLORS[p.gender] || GENDER_COLORS.Unknown;
    return {
      id: p.patient_id,
      latitude: p.latitude,
      longitude: p.longitude,
      color: genderColor,
      radius: 8,
      popupTitle: p.name,
      popupSubtitle: p.address,
      popupDetails: [
        { label: 'Gender', value: p.gender },
        { label: 'Zone', value: p.zone },
        { label: 'BSC Status', value: p.bsc_status === true ? 'BSC' : p.bsc_status === false ? 'Non-BSC' : 'Not Yet Determined' },
        { label: 'Linked Hospital', value: p.linked_hospital || 'None' },
        { label: 'Date of Death', value: p.date_of_death },
        { label: 'Visits Completed', value: String(p.visit_count || 0) }
      ],
    };
  });

  return (
    <div className="space-y-4">
      <AnalyticsGeospatialMap
        points={points}
        showZones={true}
        height="280px"
      />

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 justify-between text-xs pt-1 border-t border-border">
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
