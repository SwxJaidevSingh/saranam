/**
 * DraftRouteMap — straight-line preview of one vehicle's draft run on OpenStreetMap:
 * depot, zone polygons, numbered patient pills, and dashed legs with their distance.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import patientsApi from '../../api/patients';
import { haversineKm } from './draft';

const ZONE_LOOKUP = {
  central: '#3B82F6', east: '#EC4899', west: '#F97316', north: '#8B5CF6', south: '#14B8A6',
};
const ZONE_PALETTE = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#EF4444', '#06B6D4', '#F97316', '#14B8A6', '#6366F1'];

function zoneColor(name) {
  if (!name) return '#6B7280';
  const key = name.trim().toLowerCase().replace(/[\s\-_]/g, '');
  if (ZONE_LOOKUP[key]) return ZONE_LOOKUP[key];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return ZONE_PALETTE[Math.abs(hash) % ZONE_PALETTE.length];
}

const escapeHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const depotIcon = L.divIcon({
  html: '<div style="background:#3B82F6;width:28px;height:28px;border-radius:4px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 5px rgba(0,0,0,.3);font-size:15px;">🏥</div>',
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function stopIcon(order, name) {
  const raw = name || 'Patient';
  const display = raw.length > 20 ? `${raw.substring(0, 18)}…` : raw;
  return L.divIcon({
    html: `<div style="display:inline-flex;align-items:center;background:#111827;border:2px solid #F59E0B;border-radius:14px;padding:1px 8px 1px 2px;box-shadow:0 3px 8px rgba(0,0,0,.35);white-space:nowrap;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="background:#F59E0B;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:10px;color:white;margin-right:5px;">${order}</div>
      <div style="color:#f9fafb;font-weight:600;font-size:11px;">${escapeHtml(display)}</div></div>`,
    className: '',
    iconSize: [150, 26],
    iconAnchor: [11, 13],
  });
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [30, 30] });
    else if (points.length === 1) map.setView(points[0], 12);
  }, [map, points]);
  return null;
}

let zonesCache = null;

export default function DraftRouteMap({ vehicle, stops = [], height = 460 }) {
  const [zones, setZones] = useState(zonesCache);

  useEffect(() => {
    if (zonesCache) return;
    patientsApi.getZoneBoundaries()
      .then(res => { zonesCache = res?.boundaries || null; setZones(zonesCache); })
      .catch(() => {});
  }, []);

  const depotLat = vehicle ? Number(vehicle.depot_lat) : null;
  const depotLon = vehicle ? Number(vehicle.depot_lon) : null;
  const points = useMemo(() => {
    const pts = stops.filter(s => s.lat != null && s.lon != null).map(s => [Number(s.lat), Number(s.lon)]);
    return depotLat != null ? [[depotLat, depotLon], ...pts] : pts;
  }, [stops, depotLat, depotLon]);

  if (depotLat == null) return null;
  const depot = [depotLat, depotLon];
  const mapped = stops.filter(s => s.lat != null && s.lon != null);

  return (
    <div style={{ height, borderRadius: 8, overflow: 'hidden' }}>
      <MapContainer center={depot} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        {zones && (
          <GeoJSON
            data={zones}
            style={(f) => {
              const c = zoneColor(f?.properties?.zone || f?.properties?.name);
              return { color: c, weight: 2, fillColor: c, fillOpacity: 0.15 };
            }}
            onEachFeature={(f, layer) => {
              const n = f?.properties?.zone || f?.properties?.name;
              if (n) layer.bindTooltip(n, { sticky: true });
            }}
          />
        )}
        <Marker position={depot} icon={depotIcon}>
          <Popup><b>🚛 Depot: {vehicle.name}</b><br />Base Hospital: {vehicle.base_hospital || 'Depot'}</Popup>
        </Marker>
        {mapped.map((s, idx) => {
          const prev = idx === 0 ? depot : [Number(mapped[idx - 1].lat), Number(mapped[idx - 1].lon)];
          const here = [Number(s.lat), Number(s.lon)];
          const km = haversineKm(prev[0], prev[1], here[0], here[1]).toFixed(2);
          return (
            <React.Fragment key={s.patient_id}>
              <Polyline positions={[prev, here]} pathOptions={{ color: '#D97706', weight: 3, opacity: 0.8, dashArray: '6, 8' }}>
                <Tooltip sticky>Leg {idx + 1}: {km} km (Straight Line)</Tooltip>
              </Polyline>
              <Marker position={here} icon={stopIcon(idx + 1, s.patient_name)}>
                <Popup>
                  <strong>Stop #{idx + 1}: {s.patient_name}</strong><br />
                  <strong>UHID:</strong> {s.uhid || 'N/A'}<br />
                  <strong>Phone:</strong> {s.phone || 'N/A'}
                  {s.visit_type === 'bereavement' && <div>🕊️ Bereavement Visit</div>}
                  {s.visit_type === 'initial' && <div>🆕 Initial Visit</div>}
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}
        <FitBounds points={points} />
      </MapContainer>
    </div>
  );
}
