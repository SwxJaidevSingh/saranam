import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { MapPin, Locate, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import apiClient from '../../api/client';

export default function ShareLocation() {
  const { token } = useParams();
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [address, setAddress] = useState('');
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [hasLocation, setHasLocation] = useState(false);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }
    setGettingLocation(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toString());
        setLongitude(position.coords.longitude.toString());
        setHasLocation(true);
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

  const handleSave = async () => {
    if (!latitude || !longitude) {
      setSaveError('Please get your location first or enter coordinates manually.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await apiClient.post(`/homecare/public/share-location/${token}`, {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address: address || undefined,
      });
      setSaved(true);
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Failed to save location. The link may have expired.');
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Location Saved!</h1>
          <p className="text-gray-600">
            Your care taker will use this to find you. You can close this page now.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MapPin className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Share Your Location</h1>
          <p className="text-gray-600 mt-2">
            Your care team needs your location to visit you at home.
          </p>
        </div>

        {/* Get Location Button */}
        <button
          onClick={handleGetLocation}
          disabled={gettingLocation}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-lg font-semibold disabled:opacity-50 shadow-md transition-colors"
        >
          {gettingLocation ? (
            <RefreshCw className="h-5 w-5 animate-spin" />
          ) : (
            <Locate className="h-5 w-5" />
          )}
          {gettingLocation ? 'Getting Location...' : 'Use My Current Location'}
        </button>

        {locationError && (
          <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-200 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{locationError}</span>
          </div>
        )}

        {/* Show coordinates if available */}
        {hasLocation && (
          <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-sm text-green-700">
            <p className="font-medium">Location detected!</p>
            <p className="text-xs mt-0.5 font-mono">{Number(latitude).toFixed(6)}, {Number(longitude).toFixed(6)}</p>
          </div>
        )}

        {/* Manual input fallback */}
        <div className="border-t border-gray-200 pt-4">
          <p className="text-xs text-gray-500 mb-3 text-center">
            Or enter coordinates manually:
          </p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Latitude</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 12.9716"
                value={latitude}
                onChange={e => { setLatitude(e.target.value); setHasLocation(!!e.target.value && !!longitude); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Longitude</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 77.5946"
                value={longitude}
                onChange={e => { setLongitude(e.target.value); setHasLocation(!!latitude && !!e.target.value); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Address (optional) */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">Address (optional)</label>
            <textarea
              rows={2}
              placeholder="House/flat no., street, landmark..."
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {/* Map preview */}
        {hasLocation && latitude && longitude && (
          <div className="rounded-xl overflow-hidden border border-gray-200">
            <iframe
              width="100%"
              height="200"
              style={{ border: 0 }}
              loading="lazy"
              src={`https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_KEY || ''}&q=${latitude},${longitude}&zoom=16`}
              allowFullScreen
            />
          </div>
        )}

        {saveError && (
          <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-200 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{saveError}</span>
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving || !hasLocation}
          className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold shadow-md transition-colors
            ${hasLocation
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            } disabled:opacity-50`}
        >
          {saving ? <RefreshCw className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
          {saving ? 'Saving...' : 'Save My Location'}
        </button>
      </div>
    </div>
  );
}
