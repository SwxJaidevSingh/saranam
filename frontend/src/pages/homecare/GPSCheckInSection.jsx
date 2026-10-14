import { useState } from 'react';
import {
  MapPin,
  Navigation,
  Phone,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Locate
} from 'lucide-react';
import homecareApi from '../../api/homecare';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || '';

// Haversine formula to calculate distance in meters
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function getDistanceColor(meters) {
  if (meters < 500) return { bg: 'bg-success-50 dark:bg-success-900/20', text: 'text-success-700 dark:text-success-300', border: 'border-success-200 dark:border-success-800', label: 'Within range' };
  if (meters < 1000) return { bg: 'bg-warning-50 dark:bg-warning-900/20', text: 'text-warning-700 dark:text-warning-300', border: 'border-warning-200 dark:border-warning-800', label: 'Getting close' };
  return { bg: 'bg-danger-50 dark:bg-danger-900/20', text: 'text-danger-700 dark:text-danger-300', border: 'border-danger-200 dark:border-danger-800', label: 'Too far' };
}

export default function GPSCheckInSection({ visit, onCheckInSuccess }) {
  const [providerLat, setProviderLat] = useState(null);
  const [providerLng, setProviderLng] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInResult, setCheckInResult] = useState(null);
  const [checkInError, setCheckInError] = useState(null);

  // Patient location from visit data
  const patientLat = visit.patient_latitude || visit.service_metadata?.patient_location?.latitude;
  const patientLng = visit.patient_longitude || visit.service_metadata?.patient_location?.longitude;
  const patientAddress = visit.patient_address || visit.service_metadata?.patient_location?.address || visit.notes;
  const patientPhone = visit.patient_phone;
  const hasPatientLocation = patientLat && patientLng;

  // Check if already checked in via GPS
  const gpsCheckInData = visit.service_metadata?.gps_checkin;
  const isGpsCheckedIn = !!gpsCheckInData;

  // Calculate distance if both locations available
  const distance = (hasPatientLocation && providerLat && providerLng)
    ? haversine(providerLat, providerLng, patientLat, patientLng)
    : null;

  const distanceStyle = distance !== null ? getDistanceColor(distance) : null;
  const canCheckIn = distance !== null && distance < 500;

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }
    setGettingLocation(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setProviderLat(position.coords.latitude);
        setProviderLng(position.coords.longitude);
        setGettingLocation(false);
      },
      (error) => {
        let msg = 'Failed to get location';
        if (error.code === 1) msg = 'Location permission denied. Please enable location access in your browser settings.';
        else if (error.code === 2) msg = 'Position unavailable. Please try again.';
        else if (error.code === 3) msg = 'Location request timed out. Please try again.';
        setLocationError(msg);
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleGPSCheckIn = async () => {
    if (!canCheckIn) return;
    setCheckingIn(true);
    setCheckInError(null);
    try {
      const result = await homecareApi.gpsCheckIn(visit.id, providerLat, providerLng);
      setCheckInResult({
        timestamp: new Date().toLocaleString('en-IN'),
        distance: formatDistance(distance),
        ...result
      });
      if (onCheckInSuccess) onCheckInSuccess();
    } catch (err) {
      setCheckInError(err.response?.data?.error || 'GPS check-in failed. Please try again.');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleNavigate = () => {
    if (!hasPatientLocation) return;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${patientLat},${patientLng}`, '_blank');
  };

  const handleCall = () => {
    if (!patientPhone) return;
    window.open(`tel:${patientPhone}`, '_self');
  };

  // If already checked in via GPS, show confirmation
  if (isGpsCheckedIn) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-success-50 dark:bg-success-900/20 rounded-lg border border-success-200 dark:border-success-800">
          <CheckCircle className="h-6 w-6 text-success-600 dark:text-success-400 flex-shrink-0" />
          <div>
            <p className="font-semibold text-success-800 dark:text-success-200">GPS Check-In Complete</p>
            <p className="text-sm text-success-700 dark:text-success-300 mt-0.5">
              Checked in at {gpsCheckInData.checked_in_at ? new Date(gpsCheckInData.checked_in_at).toLocaleString('en-IN') : 'recorded time'}
              {gpsCheckInData.distance && ` - Distance: ${typeof gpsCheckInData.distance === 'number' ? formatDistance(gpsCheckInData.distance) : gpsCheckInData.distance}`}
            </p>
          </div>
        </div>

        {/* Still show map and navigation for reference */}
        {hasPatientLocation && (
          <div className="flex gap-2">
            <button
              onClick={handleNavigate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              <Navigation className="h-4 w-4" />
              Navigate to Patient
            </button>
            {patientPhone && (
              <button
                onClick={handleCall}
                className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent text-sm text-foreground"
              >
                <Phone className="h-4 w-4" />
                Call Patient
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // If check-in just succeeded in this session
  if (checkInResult) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-success-50 dark:bg-success-900/20 rounded-lg border border-success-200 dark:border-success-800">
          <CheckCircle className="h-6 w-6 text-success-600 dark:text-success-400 flex-shrink-0" />
          <div>
            <p className="font-semibold text-success-800 dark:text-success-200">GPS Check-In Successful!</p>
            <p className="text-sm text-success-700 dark:text-success-300 mt-0.5">
              Checked in at {checkInResult.timestamp} - Distance: {checkInResult.distance}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Patient Location Info */}
      <div>
        <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1 mb-3">Patient Location</h4>
        {hasPatientLocation ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-sm text-foreground">
              <MapPin className="h-4 w-4 text-primary-600 flex-shrink-0 mt-0.5" />
              <div>
                {patientAddress && <p>{patientAddress}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">
                  Coordinates: {Number(patientLat).toFixed(6)}, {Number(patientLng).toFixed(6)}
                </p>
              </div>
            </div>

            {/* Embedded Google Map */}
            <iframe
              width="100%"
              height="200"
              style={{ border: 0, borderRadius: '8px' }}
              loading="lazy"
              src={`https://www.google.com/maps/embed/v1/directions?key=${GOOGLE_MAPS_API_KEY}&origin=My+Location&destination=${patientLat},${patientLng}&mode=driving`}
              allowFullScreen
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 bg-warning-50 dark:bg-warning-900/20 rounded-lg border border-warning-200 dark:border-warning-800 text-sm text-warning-700 dark:text-warning-300">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            Patient has not shared their location. You can still proceed with manual check-in.
          </div>
        )}
      </div>

      {/* Navigation & Call Buttons */}
      <div className="flex flex-wrap gap-2">
        {hasPatientLocation && (
          <button
            onClick={handleNavigate}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm"
          >
            <Navigation className="h-4 w-4" />
            Navigate to Patient
          </button>
        )}
        {patientPhone && (
          <button
            onClick={handleCall}
            className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg hover:bg-accent text-sm font-medium text-foreground"
          >
            <Phone className="h-4 w-4" />
            Call Patient ({patientPhone})
          </button>
        )}
      </div>

      {/* GPS Check-In Panel */}
      <div>
        <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1 mb-3">GPS Check-In</h4>
        <div className="space-y-3">
          {/* Get Location Button */}
          <button
            onClick={handleGetLocation}
            disabled={gettingLocation}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50"
          >
            {gettingLocation ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Locate className="h-4 w-4" />
            )}
            {gettingLocation ? 'Getting Location...' : 'Get My Location'}
          </button>

          {locationError && (
            <div className="flex items-center gap-2 p-3 bg-danger-50 dark:bg-danger-900/20 rounded-lg border border-danger-200 dark:border-danger-800 text-sm text-danger-700 dark:text-danger-300">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {locationError}
            </div>
          )}

          {/* Provider's current coordinates */}
          {providerLat && providerLng && (
            <div className="p-3 bg-muted/30 rounded-lg border border-border text-sm">
              <p className="text-muted-foreground">
                Your location: <span className="font-mono text-foreground">{providerLat.toFixed(6)}, {providerLng.toFixed(6)}</span>
              </p>
            </div>
          )}

          {/* Distance indicator */}
          {distance !== null && distanceStyle && (
            <div className={`p-4 rounded-lg border-2 ${distanceStyle.bg} ${distanceStyle.border}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-semibold ${distanceStyle.text}`}>
                    Distance to patient: {formatDistance(distance)}
                  </p>
                  <p className={`text-xs mt-0.5 ${distanceStyle.text} opacity-80`}>
                    {distanceStyle.label} {distance < 500 ? '- Ready to check in' : '- Move closer to check in (< 500m required)'}
                  </p>
                </div>
                <div className={`text-2xl font-bold ${distanceStyle.text}`}>
                  {formatDistance(distance)}
                </div>
              </div>
            </div>
          )}

          {/* Check-In Button */}
          {providerLat && providerLng && (
            <button
              onClick={handleGPSCheckIn}
              disabled={!canCheckIn || checkingIn}
              className={`w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold transition-colors
                ${canCheckIn
                  ? 'bg-success-600 text-white hover:bg-success-700 shadow-md'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
                } disabled:opacity-50`}
            >
              {checkingIn ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle className="h-5 w-5" />
              )}
              {checkingIn ? 'Checking In...' : canCheckIn ? 'GPS Check-In' : `Too far to check in (${distance ? formatDistance(distance) : '---'})`}
            </button>
          )}

          {checkInError && (
            <div className="flex items-center gap-2 p-3 bg-danger-50 dark:bg-danger-900/20 rounded-lg border border-danger-200 dark:border-danger-800 text-sm text-danger-700 dark:text-danger-300">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {checkInError}
            </div>
          )}

          {/* If no patient location, allow check-in anyway */}
          {!hasPatientLocation && providerLat && providerLng && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Since the patient has not shared their location, you can still perform a GPS check-in to record your location.
              </p>
              <button
                onClick={async () => {
                  setCheckingIn(true);
                  setCheckInError(null);
                  try {
                    const result = await homecareApi.gpsCheckIn(visit.id, providerLat, providerLng);
                    setCheckInResult({
                      timestamp: new Date().toLocaleString('en-IN'),
                      distance: 'N/A (no patient location)',
                      ...result
                    });
                    if (onCheckInSuccess) onCheckInSuccess();
                  } catch (err) {
                    setCheckInError(err.response?.data?.error || 'GPS check-in failed.');
                  } finally {
                    setCheckingIn(false);
                  }
                }}
                disabled={checkingIn}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-warning-600 text-white rounded-lg hover:bg-warning-700 text-sm font-semibold disabled:opacity-50"
              >
                {checkingIn ? <RefreshCw className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                {checkingIn ? 'Checking In...' : 'GPS Check-In (Without Distance Verification)'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
