/**
 * MapPicker — interactive Google Maps location picker with center pin and
 * Places Autocomplete search bar. The user can search for any place or drag the
 * map; a fixed pin captures the location.
 *
 * COPIED from frontend/src/components/common/MapPicker.jsx. The only adaptation
 * is that the small geo helpers it used (KIDWAI_BASE / DEFAULT_SERVICE_RADIUS_KM
 * / distanceFromKidwai, originally from frontend/src/constants/geo.js) are
 * inlined here so the portal does not import across apps.
 *
 * Requires the Google Maps JS API key in VITE_GOOGLE_MAPS_KEY.
 */
import { useRef, useEffect, useCallback, useState } from 'react'

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || ''

// ── Inlined geo helpers (from frontend/src/constants/geo.js) ──
const DEFAULT_SERVICE_RADIUS_KM = 15

const KIDWAI_BASE = {
  lat: 12.9337,
  lng: 77.5713,
  name: 'Kidwai Memorial Institute of Oncology',
  shortName: 'Kidwai Hospital',
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371 // Earth's radius in km
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function distanceFromKidwai(lat, lng, radiusKm = DEFAULT_SERVICE_RADIUS_KM) {
  const km = haversineDistance(KIDWAI_BASE.lat, KIDWAI_BASE.lng, lat, lng)
  return {
    km: Math.round(km * 10) / 10,
    isWithinRadius: km <= radiusKm,
    hospitalShortName: KIDWAI_BASE.shortName,
    label: `${km.toFixed(1)} km from ${KIDWAI_BASE.shortName}`,
  }
}

let googleMapsLoaded = false
let googleMapsLoadingPromise = null

// Inject global CSS to fix Google Autocomplete dropdown z-index inside MUI Dialogs
let pacStyleInjected = false
function injectPacStyles() {
  if (pacStyleInjected) return
  pacStyleInjected = true
  const style = document.createElement('style')
  style.textContent = `
    .pac-container {
      z-index: 9999 !important;
      border-radius: 0 0 8px 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      border: 1px solid #e0e0e0;
      border-top: none;
      margin-top: -1px;
    }
    .pac-item {
      padding: 8px 12px;
      cursor: pointer;
      font-size: 13px;
      line-height: 1.4;
    }
    .pac-item:hover {
      background: #f0f7ff;
    }
    .pac-icon { margin-right: 8px; }
    .pac-item-query { font-weight: 600; font-size: 13px; }
  `
  document.head.appendChild(style)
}

function loadGoogleMaps() {
  if (googleMapsLoaded && window.google?.maps) return Promise.resolve()
  if (googleMapsLoadingPromise) return googleMapsLoadingPromise

  googleMapsLoadingPromise = new Promise((resolve, reject) => {
    if (window.google?.maps) {
      googleMapsLoaded = true
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => {
      googleMapsLoaded = true
      resolve()
    }
    script.onerror = () => reject(new Error('Failed to load Google Maps'))
    document.head.appendChild(script)
  })
  return googleMapsLoadingPromise
}

export default function MapPicker({
  latitude,
  longitude,
  onChange,
  onAddressResolved,
  onDistanceChange,
  height = 350,
  showKidwai = true,
  serviceRadiusKm,
}) {
  const mapRef = useRef(null)
  const searchInputRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const autocompleteRef = useRef(null)
  const [mapReady, setMapReady] = useState(false)
  const [address, setAddress] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [distanceInfo, setDistanceInfo] = useState(null)
  const radiusKm = serviceRadiusKm || DEFAULT_SERVICE_RADIUS_KM

  const defaultLat = latitude || 12.9716
  const defaultLng = longitude || 77.5946

  const reverseGeocode = useCallback((lat, lng) => {
    if (!window.google?.maps) return
    const geocoder = new window.google.maps.Geocoder()
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const result = results[0]
        setAddress(result.formatted_address)

        if (onAddressResolved) {
          const get = (type) => {
            const comp = result.address_components.find((c) => c.types.includes(type))
            return comp ? comp.long_name : ''
          }
          const streetNumber = get('street_number')
          const route = get('route')
          const sublocality = get('sublocality_level_1') || get('sublocality')
          const locality = get('locality')
          const state = get('administrative_area_level_1')
          const postalCode = get('postal_code')
          const country = get('country')

          const line1 = [streetNumber, route].filter(Boolean).join(' ') || sublocality || ''
          const line2 = sublocality && route ? sublocality : ''

          onAddressResolved({
            address_line1: line1,
            address_line2: line2,
            city: locality,
            state: state,
            postal_code: postalCode,
            country: country || 'India',
            formatted_address: result.formatted_address,
          })
        }
      }
    })
  }, [onAddressResolved])

  useEffect(() => {
    let cancelled = false
    injectPacStyles()

    loadGoogleMaps().then(() => {
      if (cancelled || !mapRef.current) return

      const center = { lat: parseFloat(defaultLat), lng: parseFloat(defaultLng) }

      const map = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: latitude ? 16 : 12,
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
        gestureHandling: 'greedy',
      })

      mapInstanceRef.current = map
      setMapReady(true)

      // Add Kidwai base marker + service radius circle
      if (showKidwai) {
        new window.google.maps.Marker({
          position: { lat: KIDWAI_BASE.lat, lng: KIDWAI_BASE.lng },
          map,
          title: KIDWAI_BASE.name,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#1976d2',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 3,
          },
          label: {
            text: 'K',
            color: '#fff',
            fontSize: '11px',
            fontWeight: '700',
          },
        })

        new window.google.maps.Circle({
          map,
          center: { lat: KIDWAI_BASE.lat, lng: KIDWAI_BASE.lng },
          radius: radiusKm * 1000,
          fillColor: '#1976d2',
          fillOpacity: 0.06,
          strokeColor: '#1976d2',
          strokeOpacity: 0.3,
          strokeWeight: 2,
        })
      }

      // Setup Places Autocomplete
      if (searchInputRef.current && window.google.maps.places) {
        const autocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current, {
          componentRestrictions: { country: 'in' },
          fields: ['geometry', 'formatted_address', 'address_components', 'name'],
        })
        autocomplete.bindTo('bounds', map)
        autocompleteRef.current = autocomplete

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace()
          if (!place.geometry?.location) return
          const loc = place.geometry.location
          map.panTo(loc)
          map.setZoom(16)
        })
      }

      // On drag/zoom end, capture center coordinates + distance
      map.addListener('idle', () => {
        const c = map.getCenter()
        const lat = parseFloat(c.lat().toFixed(6))
        const lng = parseFloat(c.lng().toFixed(6))
        if (onChange) onChange(lat, lng)
        reverseGeocode(lat, lng)
        if (showKidwai) {
          const info = distanceFromKidwai(lat, lng, radiusKm)
          setDistanceInfo(info)
          if (onDistanceChange) onDistanceChange(info)
        }
      })

      // Initial reverse geocode
      if (latitude && longitude) {
        reverseGeocode(center.lat, center.lng)
      }
    })

    return () => {
      cancelled = true
    }
  }, []) // Only init once

  // Update map center when lat/lng props change externally
  useEffect(() => {
    if (mapInstanceRef.current && latitude && longitude) {
      const newCenter = { lat: parseFloat(latitude), lng: parseFloat(longitude) }
      const currentCenter = mapInstanceRef.current.getCenter()
      if (
        Math.abs(currentCenter.lat() - newCenter.lat) > 0.0001 ||
        Math.abs(currentCenter.lng() - newCenter.lng) > 0.0001
      ) {
        mapInstanceRef.current.panTo(newCenter)
        mapInstanceRef.current.setZoom(16)
      }
    }
  }, [latitude, longitude])

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Search bar with icon + button */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <svg
          style={{
            position: 'absolute',
            left: 12,
            width: 18,
            height: 18,
            color: searchFocused ? '#1976d2' : '#999',
            pointerEvents: 'none',
            transition: 'color 0.2s',
            zIndex: 1,
          }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search for a place, hospital, area..."
          style={{
            flex: 1,
            padding: '12px 12px 12px 38px',
            fontSize: '14px',
            border: `2px solid ${searchFocused ? '#1976d2' : '#e0e0e0'}`,
            borderRadius: '8px 0 0 0',
            borderRight: 'none',
            outline: 'none',
            boxSizing: 'border-box',
            background: '#fff',
            transition: 'border-color 0.2s',
          }}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              const query = searchInputRef.current?.value?.trim()
              if (!query || !window.google?.maps) return
              const geocoder = new window.google.maps.Geocoder()
              geocoder.geocode(
                { address: query, componentRestrictions: { country: 'in' } },
                (results, status) => {
                  if (status === 'OK' && results[0]?.geometry?.location) {
                    const loc = results[0].geometry.location
                    mapInstanceRef.current?.panTo(loc)
                    mapInstanceRef.current?.setZoom(16)
                  }
                },
              )
            }
          }}
        />
        <button
          type="button"
          onClick={() => {
            const query = searchInputRef.current?.value?.trim()
            if (!query || !window.google?.maps) return
            const geocoder = new window.google.maps.Geocoder()
            geocoder.geocode(
              { address: query, componentRestrictions: { country: 'in' } },
              (results, status) => {
                if (status === 'OK' && results[0]?.geometry?.location) {
                  const loc = results[0].geometry.location
                  mapInstanceRef.current?.panTo(loc)
                  mapInstanceRef.current?.setZoom(16)
                }
              },
            )
          }}
          style={{
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: 600,
            background: '#1976d2',
            color: '#fff',
            border: '2px solid #1976d2',
            borderRadius: '0 8px 0 0',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => {
            e.target.style.background = '#1565c0'
          }}
          onMouseLeave={(e) => {
            e.target.style.background = '#1976d2'
          }}
        >
          Search
        </button>
      </div>

      {/* Map container */}
      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: `${height}px`,
          borderRadius: '0 0 8px 8px',
          border: '1px solid #e0e0e0',
          borderTop: 'none',
          background: '#f5f5f5',
        }}
      />

      {/* Fixed center pin */}
      <div
        style={{
          position: 'absolute',
          top: `calc(50% + 22px)`,
          left: '50%',
          transform: 'translate(-50%, -100%)',
          pointerEvents: 'none',
          zIndex: 10,
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
        }}
      >
        <svg width="40" height="52" viewBox="0 0 40 52" fill="none">
          <path
            d="M20 0C8.954 0 0 8.954 0 20c0 14 20 32 20 32s20-18 20-32C40 8.954 31.046 0 20 0z"
            fill="#E53935"
          />
          <circle cx="20" cy="20" r="8" fill="white" />
          <circle cx="20" cy="20" r="4" fill="#E53935" />
        </svg>
      </div>

      {/* Crosshair shadow */}
      <div
        style={{
          position: 'absolute',
          top: `calc(50% + 22px)`,
          left: '50%',
          transform: 'translate(-50%, 2px)',
          width: '6px',
          height: '3px',
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      />

      {/* Distance from Kidwai bar */}
      {showKidwai && distanceInfo && (
        <div
          style={{
            position: 'absolute',
            top: 54,
            left: 8,
            right: 8,
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(4px)',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#334155',
            zIndex: 10,
            boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: distanceInfo.isWithinRadius ? '#3B82F6' : '#F59E0B',
            }}
          />
          <span>{distanceInfo.label}</span>
          <span
            style={{
              fontWeight: 500,
              fontSize: '11px',
              padding: '1px 6px',
              borderRadius: 4,
              background: distanceInfo.isWithinRadius ? '#EFF6FF' : '#FFFBEB',
              color: distanceInfo.isWithinRadius ? '#1D4ED8' : '#B45309',
            }}
          >
            {distanceInfo.isWithinRadius ? `within ${radiusKm} km` : `outside ${radiusKm} km`}
          </span>
        </div>
      )}

      {/* Address bar at bottom */}
      {address && (
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            right: 8,
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(4px)',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '12px',
            color: '#333',
            zIndex: 10,
            boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          📍 {address}
        </div>
      )}

      {/* Loading overlay */}
      {!mapReady && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f5f5f5',
            borderRadius: '8px',
            color: '#999',
            fontSize: '14px',
          }}
        >
          Loading map...
        </div>
      )}
    </div>
  )
}
