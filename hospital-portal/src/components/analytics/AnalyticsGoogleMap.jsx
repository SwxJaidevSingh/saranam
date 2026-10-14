import React, { useEffect, useRef, useState } from 'react';

const ZONE_COLORS = {
  'North': '#3B82F6',
  'South': '#10B981',
  'East': '#F59E0B',
  'West': '#8B5CF6',
  'Central': '#EF4444',
};

// Global script load promise cache to avoid loading script multiple times
let googleMapsLoadingPromise = null;

function loadGoogleMapsScript(apiKey) {
  if (googleMapsLoadingPromise) return googleMapsLoadingPromise;

  googleMapsLoadingPromise = new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve(window.google.maps);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = (err) => {
      googleMapsLoadingPromise = null; // Allow retry on failure
      reject(err);
    };
    document.head.appendChild(script);
  });

  return googleMapsLoadingPromise;
}

export default function AnalyticsGoogleMap({
  points = [],
  showZones = false,
  center: propCenter,
  zoom = 11,
  height = '350px',
  apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_KEY,
  // New props for routing/traffic simulation
  selectedPointId = null,
  routeOrigin = null,
  routeDestination = null,
  showTraffic = false,
  onPointClick = null,
  onRouteCalculated = null,
  radiusCenter = null,
}) {
  const mapRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [mapsApi, setMapsApi] = useState(null);
  const [error, setError] = useState(null);

  // Keep references for cleanup on data updates
  const markersRef = useRef([]);
  const circlesRef = useRef([]);
  const radiusRingsRef = useRef([]);
  const infoWindowRef = useRef(null);
  const polylinesRef = useRef([]);
  const trafficLayerRef = useRef(null);
  const directionsRendererRef = useRef(null);

  // Compute center
  const center = React.useMemo(() => {
    if (propCenter) {
      if (Array.isArray(propCenter)) {
        const lat = Number(propCenter[0]);
        const lng = Number(propCenter[1]);
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng };
        }
      } else if (propCenter && typeof propCenter === 'object') {
        const lat = Number(propCenter.lat ?? propCenter.latitude);
        const lng = Number(propCenter.lng ?? propCenter.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng };
        }
      }
    }

    // Default to Bangalore
    return { lat: 12.9716, lng: 77.5946 };
  }, [propCenter]);

  // Load API script
  useEffect(() => {
    loadGoogleMapsScript(apiKey)
      .then((api) => {
        setMapsApi(api);
      })
      .catch((err) => {
        console.error('Error loading Google Maps SDK:', err);
        setError('Failed to load Google Maps SDK.');
      });
  }, [apiKey]);

  // Initialize Map Instance
  useEffect(() => {
    if (!mapsApi || !mapRef.current || mapInstance) return;

    const map = new mapsApi.Map(mapRef.current, {
      center: center,
      zoom: zoom,
      mapTypeId: mapsApi.MapTypeId.ROADMAP,
      mapTypeControl: true, // Google Maps built-in switcher
      mapTypeControlOptions: {
        style: mapsApi.MapTypeControlStyle.HORIZONTAL_BAR,
        position: mapsApi.ControlPosition.TOP_LEFT
      },
      streetViewControl: true, // Native Pegman (Street view guy) enabled
      fullscreenControl: true,
      zoomControl: true
    });

    setMapInstance(map);
  }, [mapsApi]);

  // Draw GeoJSON Zones
  useEffect(() => {
    if (!mapInstance || !showZones) return;

    mapInstance.data.loadGeoJson('/gba_zones.geojson');
    mapInstance.data.setStyle((feature) => {
      const zoneName = feature.getProperty('zone');
      const color = ZONE_COLORS[zoneName] || '#ef4444';
      return {
        fillColor: color,
        strokeColor: color,
        strokeWeight: 1.5,
        strokeOpacity: 0.5,
        fillOpacity: 0.25,
        clickable: false
      };
    });

    // Cleanup GeoJSON features
    return () => {
      if (mapInstance && mapInstance.data) {
        mapInstance.data.forEach((feature) => {
          mapInstance.data.remove(feature);
        });
      }
    };
  }, [mapInstance, showZones]);

  // Render Point Markers & CircleMarkers
  useEffect(() => {
    if (!mapInstance || !mapsApi) return;

    // Clear old markers/overlays
    markersRef.current.forEach(m => m.setMap(null));
    circlesRef.current.forEach(c => c.setMap(null));
    markersRef.current = [];
    circlesRef.current = [];

    if (!infoWindowRef.current) {
      infoWindowRef.current = new mapsApi.InfoWindow();
    }

    const bounds = new mapsApi.LatLngBounds();
    const validPoints = (points || []).filter(
      p => p &&
        p.latitude !== null && p.longitude !== null &&
        !isNaN(Number(p.latitude)) && !isNaN(Number(p.longitude)) &&
        Number(p.latitude) > 12.0 && Number(p.latitude) < 14.0 &&
        Number(p.longitude) > 76.5 && Number(p.longitude) < 78.5
    );

    validPoints.forEach((p) => {
      const position = { lat: Number(p.latitude), lng: Number(p.longitude) };
      bounds.extend(position);

      const popupContent = `
        <div style="font-family: sans-serif; color: #1e293b; padding: 4px; min-width: 180px; font-size: 12px; line-height: 1.4;">
          <h4 style="margin: 0 0 4px; font-weight: 600; font-size: 13px; color: #0f172a;">${p.popupTitle || ''}</h4>
          <p style="margin: 0 0 6px; color: #64748b; font-size: 11px;">${p.popupSubtitle || ''}</p>
          ${p.popupDetails ? `
            <div style="border-top: 1px solid #e2e8f0; padding-top: 4px; margin-top: 4px;">
              ${p.popupDetails.map(d => `
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                  <span style="color: #64748b; margin-right: 8px;">${d.label}:</span>
                  <span style="font-weight: 500; color: #1e293b;">${d.value}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;

      if (p.isHospital) {
        // Draw native Google Marker with Hospital symbol svg path
        const marker = new mapsApi.Marker({
          position: position,
          map: mapInstance,
          title: p.popupTitle,
          icon: {
            path: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z',
            fillColor: '#4f46e5',
            fillOpacity: 1.0,
            strokeColor: '#ffffff',
            strokeWeight: 1.5,
            scale: 1,
            anchor: new mapsApi.Point(12, 12)
          }
        });

        marker.addListener('click', () => {
          infoWindowRef.current.setContent(popupContent);
          infoWindowRef.current.open(mapInstance, marker);
          if (onPointClick) {
            onPointClick(p);
          }
        });

        markersRef.current.push(marker);
      } else {
        // Draw Google Circle matching CircleMarker aesthetics
        // If this circle is the selected patient, highlight it!
        const isSelected = selectedPointId && (p.id === selectedPointId || p.patient_id === selectedPointId);
        const circle = new mapsApi.Circle({
          map: mapInstance,
          center: position,
          radius: (p.radius || 8) * (isSelected ? 25 : 15),
          fillColor: isSelected ? '#4f46e5' : (p.color || '#ef4444'),
          fillOpacity: isSelected ? 1.0 : 0.9,
          strokeColor: isSelected ? '#ffffff' : '#1d2939',
          strokeOpacity: 0.9,
          strokeWeight: isSelected ? 3 : 2,
          clickable: true
        });

        circle.addListener('click', () => {
          infoWindowRef.current.setContent(popupContent);
          infoWindowRef.current.setPosition(position);
          infoWindowRef.current.open(mapInstance);
          if (onPointClick) {
            onPointClick(p);
          }
        });

        circlesRef.current.push(circle);
      }
    });

    // Default view: always center and zoom over selected hospital (if present) or Bangalore if there is no active route destination
    if (!routeDestination) {
      if (radiusCenter) {
        mapInstance.setCenter(radiusCenter);
        mapInstance.setZoom(10);
      } else {
        mapInstance.setCenter(center);
        mapInstance.setZoom(zoom);
      }
    }

  }, [mapInstance, points, mapsApi, selectedPointId, routeDestination, radiusCenter]);

  // Manage Radius Circles/Rings
  useEffect(() => {
    if (!mapInstance || !mapsApi) return;

    // Clear old rings
    radiusRingsRef.current.forEach(r => r.setMap(null));
    radiusRingsRef.current = [];

    if (!radiusCenter) return;

    const ringDistances = [5, 10, 20, 30, 40, 50]; // In kilometers
    const ringColors = ['#10B981', '#3B82F6', '#F59E0B', '#F97316', '#EF4444', '#7C3AED'];

    ringDistances.forEach((distKm, idx) => {
      const circle = new mapsApi.Circle({
        map: mapInstance,
        center: radiusCenter,
        radius: distKm * 1000, // Google Maps radius is in meters
        fillColor: ringColors[idx % ringColors.length],
        fillOpacity: 0.03, // Very light translucent fill
        strokeColor: ringColors[idx % ringColors.length],
        strokeOpacity: 0.35,
        strokeWeight: 1.5,
        clickable: false
      });
      radiusRingsRef.current.push(circle);
    });

    return () => {
      radiusRingsRef.current.forEach(r => r.setMap(null));
      radiusRingsRef.current = [];
    };
  }, [mapInstance, mapsApi, radiusCenter]);

  // Manage Traffic Layer
  useEffect(() => {
    if (!mapInstance || !mapsApi) return;

    if (!trafficLayerRef.current) {
      trafficLayerRef.current = new mapsApi.TrafficLayer();
    }

    if (showTraffic) {
      trafficLayerRef.current.setMap(mapInstance);
    } else {
      trafficLayerRef.current.setMap(null);
    }
  }, [mapInstance, mapsApi, showTraffic]);

  // Manage Route Polylines
  useEffect(() => {
    if (!mapInstance || !mapsApi) return;

    // Clear old polylines and directions renderer
    polylinesRef.current.forEach(pl => pl.setMap(null));
    polylinesRef.current = [];
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
      directionsRendererRef.current = null;
    }

    if (!routeOrigin || !routeDestination) return;

    // Try live DirectionsService first
    const directionsService = new mapsApi.DirectionsService();
    const directionsRenderer = new mapsApi.DirectionsRenderer({
      map: mapInstance,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#6366f1', // Indigo route line
        strokeOpacity: 0.85,
        strokeWeight: 6
      }
    });
    directionsRendererRef.current = directionsRenderer;

    directionsService.route({
      origin: routeOrigin,
      destination: routeDestination,
      travelMode: mapsApi.TravelMode.DRIVING,
      drivingOptions: {
        departureTime: new Date(), // required for live traffic info
        trafficModel: mapsApi.TrafficModel.BEST_GUESS
      }
    }, (result, status) => {
      if (status === 'OK') {
        directionsRenderer.setDirections(result);

        const leg = result.routes[0].legs[0];
        const distanceText = leg.distance.text;
        const durationText = leg.duration.text;
        const durationTrafficText = leg.duration_in_traffic ? leg.duration_in_traffic.text : leg.duration.text;

        let delayText = 'No delay';
        if (leg.duration_in_traffic && leg.duration_in_traffic.value > leg.duration.value) {
          const diffMin = Math.round((leg.duration_in_traffic.value - leg.duration.value) / 60);
          if (diffMin > 0) {
            delayText = `${diffMin} mins`;
          }
        }

        if (onRouteCalculated) {
          onRouteCalculated({
            distance: distanceText,
            duration: durationText,
            durationWithTraffic: durationTrafficText,
            delay: delayText,
            isMock: false
          });
        }
      } else {
        // Fallback to Mock simulation
        console.warn('Google Maps Directions Service failed:', status, '. Falling back to simulated route.');
        directionsRenderer.setMap(null);
        directionsRendererRef.current = null;

        // Create a zig-zag street-like path
        const pointA = {
          lat: routeOrigin.lat + (routeDestination.lat - routeOrigin.lat) * 0.4,
          lng: routeOrigin.lng
        };
        const pointB = {
          lat: pointA.lat,
          lng: routeOrigin.lng + (routeDestination.lng - routeOrigin.lng) * 0.7
        };

        const path1 = [routeOrigin, pointA];
        const path2 = [pointA, pointB];
        const path3 = [pointB, routeDestination];

        const segment1 = new mapsApi.Polyline({
          path: path1,
          geodesic: true,
          strokeColor: '#10B981', // Green (Clear)
          strokeOpacity: 0.9,
          strokeWeight: 6,
          map: mapInstance
        });

        const segment2 = new mapsApi.Polyline({
          path: path2,
          geodesic: true,
          strokeColor: '#F59E0B', // Orange (Moderate)
          strokeOpacity: 0.9,
          strokeWeight: 6,
          map: mapInstance
        });

        const segment3 = new mapsApi.Polyline({
          path: path3,
          geodesic: true,
          strokeColor: '#EF4444', // Red (Heavy)
          strokeOpacity: 0.9,
          strokeWeight: 6,
          map: mapInstance
        });

        polylinesRef.current = [segment1, segment2, segment3];

        // Compute mock route distance using standard math
        const lat1 = routeOrigin.lat;
        const lon1 = routeOrigin.lng;
        const lat2 = routeDestination.lat;
        const lon2 = routeDestination.lng;

        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distanceKm = R * c;

        const distanceText = `${distanceKm.toFixed(1)} km`;
        const durationMin = Math.round(distanceKm * 1.5);
        const durationText = `${durationMin} mins`;
        const trafficDelayMin = Math.round(distanceKm * 0.4) + 2;
        const durationTrafficText = `${durationMin + trafficDelayMin} mins`;

        if (onRouteCalculated) {
          onRouteCalculated({
            distance: distanceText,
            duration: durationText,
            durationWithTraffic: durationTrafficText,
            delay: `${trafficDelayMin} mins`,
            isMock: true,
            apiError: status
          });
        }

        // Adjust zoom / bounds to show both origin and destination
        const bounds = new mapsApi.LatLngBounds();
        bounds.extend(routeOrigin);
        bounds.extend(routeDestination);
        mapInstance.fitBounds(bounds);
      }
    });

  }, [mapInstance, mapsApi, routeOrigin, routeDestination]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      polylinesRef.current.forEach(pl => pl.setMap(null));
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
      }
      if (trafficLayerRef.current) {
        trafficLayerRef.current.setMap(null);
      }
    };
  }, []);

  if (error) {
    return (
      <div className="w-full flex items-center justify-center border border-border bg-destructive/10 text-destructive rounded-lg text-sm" style={{ height }}>
        {error}
      </div>
    );
  }

  return (
    <div
      className="w-full rounded-lg overflow-hidden border border-border bg-muted/20"
      style={{ height }}
    >
      {!mapsApi && (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs animate-pulse">
          Loading Google Maps SDK...
        </div>
      )}
      <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
}
