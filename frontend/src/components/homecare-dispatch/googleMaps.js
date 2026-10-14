/** Load the Google Maps JS API once, reusing a script another component already added. */
let loadingPromise = null;

export const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export function loadGoogleMaps() {
  if (window.google?.maps?.DirectionsService) return Promise.resolve(window.google.maps);
  if (loadingPromise) return loadingPromise;
  if (!GOOGLE_MAPS_KEY) return Promise.reject(new Error('Google Maps API key is missing (VITE_GOOGLE_MAPS_KEY).'));

  loadingPromise = new Promise((resolve, reject) => {
    const done = () => (window.google?.maps ? resolve(window.google.maps) : reject(new Error('Google Maps failed to load.')));
    const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existing) {
      existing.addEventListener('load', done);
      existing.addEventListener('error', () => reject(new Error('Google Maps failed to load.')));
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=geometry`;
    script.async = true;
    script.defer = true;
    script.onload = done;
    script.onerror = () => {
      loadingPromise = null;
      reject(new Error('Google Maps failed to load.'));
    };
    document.head.appendChild(script);
  }).catch((err) => {
    loadingPromise = null;
    throw err;
  });
  return loadingPromise;
}
