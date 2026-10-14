import React from 'react';
import AnalyticsGeospatialMap from './AnalyticsGoogleMap';

const PRESET_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6'];
const OTHERS_COLOR = '#64748b';

export default function PatientDiseaseMap({ data, type, stats }) {
  // Standardize top items from stats
  const topItems = (stats || []).filter(s => s.name !== 'Others').map(s => s.name);

  const getColor = (item) => {
    const idx = topItems.indexOf(item);
    if (idx >= 0 && idx < PRESET_COLORS.length) {
      return PRESET_COLORS[idx];
    }
    return OTHERS_COLOR;
  };

  const validPoints = data.filter(
    (p) => p.latitude !== null && p.longitude !== null && !isNaN(p.latitude) && !isNaN(p.longitude)
  );

  const points = validPoints.map((p) => {
    const itemValue = type === 'diagnoses' ? p.diagnosis : p.chief_complaint;
    const color = getColor(itemValue);

    return {
      id: p.patient_id,
      latitude: p.latitude,
      longitude: p.longitude,
      color,
      radius: 8,
      popupTitle: p.patient_name,
      popupSubtitle: p.district,
      popupDetails: [
        { label: type === 'diagnoses' ? 'Diagnosis' : 'Chief Complaint', value: itemValue },
        { label: 'BSC Status', value: p.bsc_status === true ? 'BSC' : p.bsc_status === false ? 'Non-BSC' : 'Not Yet Determined' }
      ]
    };
  });

  return (
    <div className="space-y-4">
      <AnalyticsGeospatialMap
        points={points}
        showZones={true}
        height="300px"
      />
      
      {/* Map Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 justify-center text-[11px] border-t border-border pt-3">
        {topItems.map((item, idx) => (
          <div key={item} className="flex items-center gap-1.5">
            <span 
              className="h-3 w-3 rounded-full border border-card shadow-sm"
              style={{ backgroundColor: PRESET_COLORS[idx % PRESET_COLORS.length] }}
            />
            <span className="text-muted-foreground">{item}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span 
            className="h-3 w-3 rounded-full border border-card shadow-sm" 
            style={{ backgroundColor: OTHERS_COLOR }}
          />
          <span className="text-muted-foreground">Others</span>
        </div>
      </div>
    </div>
  );
}
