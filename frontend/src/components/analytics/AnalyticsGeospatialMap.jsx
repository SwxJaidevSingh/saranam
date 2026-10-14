import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, GeoJSON, useMap, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from '../../context/ThemeContext';

// Fix for default marker icons in React Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const ZONE_COLORS = {
  'North': '#3B82F6',
  'South': '#10B981',
  'East': '#F59E0B',
  'West': '#8B5CF6',
  'Central': '#EF4444',
};

// Map controller to handle map resizing and auto-bounds/centering
function MapController({ center, zoom, points }) {
  const map = useMap();

  useEffect(() => {
    // Invalidate size immediately and after a delay to resolve grey tiles bug
    map.invalidateSize();
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    if (points && points.length > 0) {
      // Find bounding box for all points to fit map bounds nicely
      const lats = points.map(p => p.latitude);
      const lngs = points.map(p => p.longitude);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      
      // If coordinates are too close or single point, just pan/zoom
      if (maxLat - minLat < 0.005 && maxLng - minLng < 0.005) {
        map.setView([center[0], center[1]], zoom);
      } else {
        map.fitBounds([
          [minLat, minLng],
          [maxLat, maxLng]
        ], { padding: [20, 20] });
      }
    } else {
      map.setView(center, zoom);
    }
  }, [map, center, zoom, points]);

  return null;
}

export default function AnalyticsGeospatialMap({ 
  points = [], 
  showZones = false, 
  center: propCenter, 
  zoom = 11, 
  height = '350px' 
}) {
  const { isDark } = useTheme();
  const [geoJsonData, setGeoJsonData] = useState(null);

  // Load Bangalore GBA Zones GeoJSON
  useEffect(() => {
    if (showZones) {
      fetch('/gba_zones.geojson')
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch zones');
          return res.json();
        })
        .then((data) => setGeoJsonData(data))
        .catch((err) => console.error('Error loading GBA zones geojson:', err));
    }
  }, [showZones]);

  // Compute center if not explicitly provided
  const center = React.useMemo(() => {
    if (propCenter) return propCenter;
    if (points.length > 0) {
      const avgLat = points.reduce((sum, p) => sum + p.latitude, 0) / points.length;
      const avgLng = points.reduce((sum, p) => sum + p.longitude, 0) / points.length;
      return [avgLat, avgLng];
    }
    return [12.9716, 77.5946]; // Default to Bangalore center
  }, [propCenter, points]);

  const [mapStyle, setMapStyle] = useState('streets'); // 'streets' | 'satellite' | 'terrain'

  // Determine appropriate tile URL and attribution based on theme and style
  const getTileConfig = () => {
    switch (mapStyle) {
      case 'satellite':
        return {
          url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', // Google Hybrid (Satellite + Roads/Labels)
          attribution: '&copy; Google Maps'
        };
      case 'terrain':
        return {
          url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', // Google Terrain
          attribution: '&copy; Google Maps'
        };
      case 'streets':
      default:
        return {
          url: isDark
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png' // CartoDB Dark for dark mode compatibility
            : 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', // Google Streets
          attribution: isDark
            ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            : '&copy; Google Maps'
        };
    }
  };

  const tileConfig = getTileConfig();

  return (
    <div 
      className="w-full rounded-lg overflow-hidden border border-border bg-muted/20 relative"
      style={{ height }}
    >
      {/* Map Style Switcher Controls */}
      <div className="absolute top-3 right-3 z-[1000] flex gap-1 bg-background/90 backdrop-blur-md p-1 rounded-md border border-border shadow-sm">
        <button
          onClick={() => setMapStyle('streets')}
          className={`px-2.5 py-1 text-xs font-semibold rounded-sm transition-all duration-200 ${
            mapStyle === 'streets'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          Street
        </button>
        <button
          onClick={() => setMapStyle('satellite')}
          className={`px-2.5 py-1 text-xs font-semibold rounded-sm transition-all duration-200 ${
            mapStyle === 'satellite'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          Satellite
        </button>
        <button
          onClick={() => setMapStyle('terrain')}
          className={`px-2.5 py-1 text-xs font-semibold rounded-sm transition-all duration-200 ${
            mapStyle === 'terrain'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          Terrain
        </button>
      </div>

      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%', zIndex: 1 }}
        scrollWheelZoom={false}
      >
        <MapController center={center} zoom={zoom} points={points} />
        <TileLayer
          key={tileConfig.url}
          attribution={tileConfig.attribution}
          url={tileConfig.url}
        />

        {showZones && geoJsonData && (
          <GeoJSON
            data={geoJsonData}
            style={(feature) => {
              const zoneName = feature.properties.zone;
              const color = ZONE_COLORS[zoneName] || '#ef4444';
              return {
                fillColor: color,
                weight: 1.5,
                opacity: 0.5,
                color: color,
                fillOpacity: 0.25,
                interactive: false,
              };
            }}
          />
        )}

        {points.map((p) => {
          if (p.isHospital) {
            const hospitalIcon = L.divIcon({
              html: `<div class="bg-indigo-600 text-white p-1.5 rounded-lg border border-slate-900 flex items-center justify-center shadow-lg"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 22v-6.57c0-.42.36-.78.78-.78h2.44c.42 0 .78.36.78.78V22"></path><path d="M3 22V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v16"></path></svg></div>`,
              className: 'custom-div-icon',
              iconSize: [26, 26],
              iconAnchor: [13, 13]
            });
            return (
              <Marker
                key={p.id}
                position={[p.latitude, p.longitude]}
                icon={hospitalIcon}
              >
                <Popup>
                  <div className="p-1 min-w-[200px] text-xs space-y-1">
                    {p.popupTitle && (
                      <h4 className="font-semibold text-sm mb-0.5 text-foreground">{p.popupTitle}</h4>
                    )}
                    {p.popupSubtitle && (
                      <p className="text-muted-foreground mb-1 text-[11px]">{p.popupSubtitle}</p>
                    )}
                    
                    {p.popupDetails && p.popupDetails.length > 0 && (
                      <div className="space-y-0.5 border-t border-border pt-1 mt-1 text-[11px]">
                        {p.popupDetails.map((detail, idx) => (
                          <div key={idx} className="flex justify-between gap-2">
                            <span className="text-muted-foreground">{detail.label}:</span>
                            <span className="font-medium text-foreground">{detail.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          }

          return (
            <CircleMarker
              key={p.id}
              center={[p.latitude, p.longitude]}
              radius={p.radius || 8}
              pathOptions={{
                fillColor: p.color || '#ef4444',
                color: '#1d2939',
                weight: 2,
                fillOpacity: 0.9,
              }}
            >
              <Popup>
                <div className="p-1 min-w-[200px] text-xs space-y-1">
                  {p.popupTitle && (
                    <h4 className="font-semibold text-sm mb-0.5 text-foreground">{p.popupTitle}</h4>
                  )}
                  {p.popupSubtitle && (
                    <p className="text-muted-foreground mb-1 text-[11px]">{p.popupSubtitle}</p>
                  )}
                  
                  {p.popupDetails && p.popupDetails.length > 0 && (
                    <div className="space-y-0.5 border-t border-border pt-1 mt-1 text-[11px]">
                      {p.popupDetails.map((detail, idx) => (
                        <div key={idx} className="flex justify-between gap-2">
                          <span className="text-muted-foreground">{detail.label}:</span>
                          <span className="font-medium text-foreground">{detail.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {p.popupAction && (
                    <div className="mt-2 pt-1 border-t border-border">
                      {p.popupAction}
                    </div>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
