import { useState, useEffect } from 'react';
import { MapPin, Navigation, Globe, Edit2, Check, X } from 'lucide-react';

export default function GeoLocationField({ field, value, onChange, error }) {
  const config = field.config || {};
  const captureGPS = config.captureGPS !== false; // Default true
  const captureIP = config.captureIP !== false; // Default true
  const allowManualAddress = config.allowManualAddress !== false; // Default true

  const [locationData, setLocationData] = useState(value || {});
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureError, setCaptureError] = useState('');
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [manualAddress, setManualAddress] = useState(value?.address || '');

  // Auto-capture on mount if enabled and no existing data
  useEffect(() => {
    if (!value && (captureGPS || captureIP)) {
      handleAutoCapture();
    }
  }, []);

  // Update parent when locationData changes
  useEffect(() => {
    if (Object.keys(locationData).length > 0) {
      onChange(locationData);
    }
  }, [locationData]);

  const handleAutoCapture = async () => {
    setIsCapturing(true);
    setCaptureError('');
    const newData = { ...locationData };

    try {
      // Capture GPS coordinates
      if (captureGPS) {
        try {
          const position = await new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
              reject(new Error('Geolocation not supported'));
              return;
            }
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            });
          });

          newData.lat = position.coords.latitude;
          newData.lng = position.coords.longitude;
          newData.accuracy = position.coords.accuracy;
        } catch (gpsError) {
          console.error('GPS capture error:', gpsError);
          setCaptureError(`GPS: ${gpsError.message || 'Location access denied'}`);
        }
      }

      // Capture IP address
      if (captureIP) {
        try {
          // Use a public IP API service
          const ipResponse = await fetch('https://api.ipify.org?format=json');
          const ipData = await ipResponse.json();
          newData.ip = ipData.ip;
        } catch (ipError) {
          console.error('IP capture error:', ipError);
          // Don't show error for IP - it's less critical
        }
      }

      // Add timestamp
      newData.timestamp = new Date().toISOString();
      newData.address = manualAddress || newData.address || '';

      setLocationData(newData);
    } catch (err) {
      console.error('Location capture error:', err);
      setCaptureError('Failed to capture location data');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleManualAddressSave = () => {
    setLocationData({
      ...locationData,
      address: manualAddress,
      timestamp: new Date().toISOString()
    });
    setIsEditingAddress(false);
  };

  const handleManualAddressCancel = () => {
    setManualAddress(locationData.address || '');
    setIsEditingAddress(false);
  };

  return (
    <div className="space-y-3">
      {/* Capture Button */}
      {(captureGPS || captureIP) && (
        <div>
          <button
            type="button"
            onClick={handleAutoCapture}
            disabled={isCapturing}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            {isCapturing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600" />
                <span>Capturing...</span>
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4" />
                <span>Capture Location</span>
              </>
            )}
          </button>

          {captureError && (
            <p className="text-sm text-danger-600 dark:text-danger-400 mt-1">{captureError}</p>
          )}
        </div>
      )}

      {/* Display Captured Data */}
      {locationData && Object.keys(locationData).length > 0 && (
        <div className="bg-secondary border border-border rounded-lg p-4 space-y-2">
          {/* GPS Coordinates */}
          {locationData.lat && locationData.lng && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="w-4 h-4 text-primary-600 dark:text-primary-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-medium text-foreground">GPS Coordinates</div>
                <div className="text-muted-foreground font-mono text-xs">
                  {locationData.lat.toFixed(6)}, {locationData.lng.toFixed(6)}
                </div>
                {locationData.accuracy && (
                  <div className="text-muted-foreground text-xs">
                    Accuracy: ±{Math.round(locationData.accuracy)}m
                  </div>
                )}
              </div>
            </div>
          )}

          {/* IP Address */}
          {locationData.ip && (
            <div className="flex items-start gap-2 text-sm">
              <Globe className="w-4 h-4 text-primary-600 dark:text-primary-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-medium text-foreground">IP Address</div>
                <div className="text-muted-foreground font-mono text-xs">{locationData.ip}</div>
              </div>
            </div>
          )}

          {/* Manual Address */}
          {allowManualAddress && (
            <div className="flex items-start gap-2 text-sm">
              <Edit2 className="w-4 h-4 text-primary-600 dark:text-primary-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-medium text-foreground mb-1">Address</div>
                {isEditingAddress ? (
                  <div className="space-y-2">
                    <textarea
                      value={manualAddress}
                      onChange={(e) => setManualAddress(e.target.value)}
                      className="input text-sm"
                      rows={2}
                      placeholder="Enter address..."
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleManualAddressSave}
                        className="btn-primary text-xs flex items-center gap-1 px-2 py-1"
                      >
                        <Check className="w-3 h-3" />
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={handleManualAddressCancel}
                        className="btn-secondary text-xs flex items-center gap-1 px-2 py-1"
                      >
                        <X className="w-3 h-3" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {locationData.address ? (
                      <div className="text-muted-foreground text-xs">{locationData.address}</div>
                    ) : (
                      <div className="text-muted-foreground/70 text-xs italic">No address entered</div>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsEditingAddress(true)}
                      className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 text-xs mt-1 underline"
                    >
                      {locationData.address ? 'Edit' : 'Add address'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timestamp */}
          {locationData.timestamp && (
            <div className="text-xs text-muted-foreground pt-2 border-t border-border">
              Captured: {new Date(locationData.timestamp).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-sm text-danger-600 dark:text-danger-400">{error}</p>
      )}

      {/* Help Text */}
      <div className="text-xs text-muted-foreground space-y-1">
        {captureGPS && <p>• GPS coordinates will be captured from your device</p>}
        {captureIP && <p>• IP address will be automatically detected</p>}
        {allowManualAddress && <p>• You can manually enter an address</p>}
      </div>
    </div>
  );
}
