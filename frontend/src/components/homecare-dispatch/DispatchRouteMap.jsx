/**
 * DispatchRouteMap — locked routes on Google Maps: depot per vehicle, numbered patient
 * pills coloured by visit status, and the driving route (Directions service), falling
 * back to a straight polyline. Driving paths are cached per session like Streamlit.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Alert } from '@mui/material';
import { loadGoogleMaps } from './googleMaps';

const ROUTE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#EF4444', '#06B6D4'];
const STATUS_COLORS = { pending: '#F59E0B', active: '#F59E0B', completed: '#10B981', failed: '#EF4444' };
const STATUS_LABELS = { pending: '⏳ Pending', active: '🚛 Active Run', completed: '✅ Completed', failed: '❌ Unavailable / Failed' };

const escapeHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function stopIcon(maps, stop) {
  const color = STATUS_COLORS[stop.status] || '#F59E0B';
  const raw = stop.patient_name || 'Patient';
  const name = escapeHtml(raw.length > 20 ? `${raw.substring(0, 18)}…` : raw);
  const width = Math.max(90, Math.min(220, 42 + name.length * 7.5));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="30" viewBox="0 0 ${width} 30">
    <rect x="2" y="2" width="${width - 4}" height="24" rx="12" fill="#111827" stroke="${color}" stroke-width="2"/>
    <circle cx="14" cy="14" r="9" fill="${color}"/>
    <text x="14" y="17.5" font-family="sans-serif" font-size="10" font-weight="bold" fill="#fff" text-anchor="middle">${stop.slot_order}</text>
    <text x="28" y="17.5" font-family="sans-serif" font-size="11" font-weight="600" fill="#f3f4f6">${name}</text></svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new maps.Size(width, 30),
    anchor: new maps.Point(14, 14),
  };
}

export default function DispatchRouteMap({ slots = [], vehicles = [], selectedVehicleId = 'all', height = 560 }) {
  const ref = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const overlays = [];

    loadGoogleMaps().then((maps) => {
      if (cancelled || !ref.current) return;
      const map = new maps.Map(ref.current, { zoom: 12, center: { lat: 12.9716, lng: 77.5946 }, mapTypeControl: false, streetViewControl: false });
      const bounds = new maps.LatLngBounds();
      const directions = new maps.DirectionsService();
      const info = new maps.InfoWindow();

      const byVehicle = {};
      slots.forEach(s => { (byVehicle[s.vehicle_id] = byVehicle[s.vehicle_id] || []).push(s); });
      const shown = vehicles.filter(v => (selectedVehicleId === 'all' ? byVehicle[v.id] : v.id === selectedVehicleId));

      shown.forEach((v, idx) => {
        const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
        const depot = { lat: Number(v.depot_lat), lng: Number(v.depot_lon) };
        bounds.extend(depot);
        const depotMarker = new maps.Marker({
          position: depot, map, title: `${v.name} Depot (${v.base_hospital || 'Depot'})`,
          icon: { path: 'M19 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z', fillColor: '#3B82F6', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 1.5, scale: 1.1, anchor: new maps.Point(12, 12) },
        });
        depotMarker.addListener('click', () => {
          info.setContent(`<div><strong>🚛 Depot: ${escapeHtml(v.name)}</strong><br>Base Hospital: ${escapeHtml(v.base_hospital || 'Depot')}</div>`);
          info.open(map, depotMarker);
        });
        overlays.push(depotMarker);

        const stops = (byVehicle[v.id] || [])
          .filter(s => s.lat != null && s.lon != null)
          .sort((a, b) => a.slot_order - b.slot_order)
          .map(s => ({ ...s, lat: Number(s.lat), lng: Number(s.lon) }));
        if (!stops.length) return;

        stops.forEach(stop => {
          const pt = { lat: stop.lat, lng: stop.lng };
          bounds.extend(pt);
          const marker = new maps.Marker({ position: pt, map, title: `Stop #${stop.slot_order}: ${stop.patient_name}`, icon: stopIcon(maps, stop) });
          const badge = stop.visit_type === 'bereavement' ? '<div>🕊️ Bereavement Visit</div>' : stop.visit_type === 'initial' ? '<div>🆕 Initial Visit</div>' : '';
          marker.addListener('click', () => {
            info.setContent(`<div style="color:#111827;font-size:12px;line-height:1.4">
              <strong style="font-size:13px">Stop #${stop.slot_order}: ${escapeHtml(stop.patient_name)}</strong><br>
              <strong>UHID:</strong> ${escapeHtml(stop.uhid || 'N/A')}<br>
              <strong>Phone:</strong> ${escapeHtml(stop.phone || 'N/A')}<br>
              <strong>Status:</strong> <span style="color:${STATUS_COLORS[stop.status] || '#999'};font-weight:bold">${STATUS_LABELS[stop.status] || stop.status}</span>${badge}</div>`);
            info.open(map, marker);
          });
          overlays.push(marker);
        });

        const drawPath = (path) => overlays.push(new maps.Polyline({ path, geodesic: true, strokeColor: color, strokeOpacity: 0.8, strokeWeight: 5, map }));
        const cacheKey = `hd_route_${depot.lat}_${depot.lng}_${stops.map(s => `${s.lat}_${s.lng}`).join('_')}`;
        let cached = null;
        try { cached = JSON.parse(sessionStorage.getItem(cacheKey)); } catch { cached = null; }
        if (cached) { drawPath(cached); return; }

        directions.route({
          origin: depot,
          destination: { lat: stops[stops.length - 1].lat, lng: stops[stops.length - 1].lng },
          waypoints: stops.slice(0, -1).map(s => ({ location: { lat: s.lat, lng: s.lng }, stopover: true })),
          travelMode: maps.TravelMode.DRIVING,
        }, (result, status) => {
          if (cancelled) return;
          if (status === maps.DirectionsStatus.OK) {
            const path = result.routes[0].overview_path.map(p => ({ lat: p.lat(), lng: p.lng() }));
            try { sessionStorage.setItem(cacheKey, JSON.stringify(path)); } catch { /* storage full */ }
            drawPath(path);
          } else {
            drawPath([depot, ...stops.map(s => ({ lat: s.lat, lng: s.lng }))]);
          }
        });
      });

      if (!bounds.isEmpty()) map.fitBounds(bounds, 40);
    }).catch(err => !cancelled && setError(err.message));

    return () => {
      cancelled = true;
      overlays.forEach(o => o.setMap(null));
    };
  }, [slots, vehicles, selectedVehicleId]);

  if (error) return <Alert severity="warning">{error}</Alert>;
  return (
    <div style={{ position: 'relative' }}>
      <div ref={ref} style={{ height, width: '100%', borderRadius: 8 }} />
      <div style={{ position: 'absolute', bottom: 16, left: 16, background: 'rgba(17,24,39,.92)', color: '#f3f4f6', padding: 12, borderRadius: 8, fontSize: 12 }}>
        <div style={{ fontWeight: 700, color: '#3dd6c4', marginBottom: 6 }}>📍 Dispatch Map Legend</div>
        {[['#3B82F6', 'Depot (Hospital base)'], ['#F59E0B', 'Pending / Active visit'], ['#10B981', 'Completed visit'], ['#EF4444', 'Unavailable / Failed']].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: c, border: '1px solid #fff' }} />{l}
          </div>
        ))}
      </div>
    </div>
  );
}
