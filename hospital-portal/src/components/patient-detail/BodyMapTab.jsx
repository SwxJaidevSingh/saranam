/**
 * BodyMapTab — Hospital Portal patient-detail body map (view + edit).
 *
 * Loads the patient's body map from the portal API and renders the shared
 * BodyMapView. Persistence is handled here:
 *   - `annotations`     → user free-click markers (red)
 *   - `body_locations`  → AI-suggested highlights (blue)
 *
 * Both layers are saved with a single PUT /portal/patients/:id/body-map call
 * (the backend stores them on the same record). When `editable` is false the
 * map is read-only and no change handlers are wired.
 *
 * Props: { patientId, editable }
 */
import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import clinicalApi from '../../api/clinical';
import BodyMapView from './BodyMapView';

export default function BodyMapTab({ patientId, editable = false }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [annotations, setAnnotations] = useState([]);     // user free-click markers
  const [bodyLocations, setBodyLocations] = useState([]); // AI highlights
  const [summaryText, setSummaryText] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!patientId) return undefined;

    setLoading(true);
    setError('');
    clinicalApi.getBodyMap(patientId)
      .then((res) => {
        if (cancelled) return;
        setAnnotations(Array.isArray(res?.annotations) ? res.annotations : []);
        setBodyLocations(Array.isArray(res?.body_locations) ? res.body_locations : []);
        setSummaryText(res?.summary_text || '');
      })
      .catch((err) => {
        if (cancelled) return;
        // A missing body map is not an error — start with an empty map.
        if (err?.response?.status && err.response.status !== 404) {
          setError(err?.response?.data?.error || 'Failed to load body map.');
        }
        setAnnotations([]);
        setBodyLocations([]);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [patientId]);

  // Persist user free-click markers. Optimistically updates local state so the
  // canvas re-renders immediately, then writes through to the API.
  const handleMarkersChange = useCallback(async (nextMarkers) => {
    const prev = annotations;
    setAnnotations(nextMarkers);
    try {
      await clinicalApi.saveBodyMap(patientId, {
        annotations: nextMarkers,
        body_locations: bodyLocations,
        summary_text: summaryText,
      });
    } catch (err) {
      setAnnotations(prev); // rollback
      throw err;            // BodyMapView surfaces an alert
    }
  }, [patientId, annotations, bodyLocations, summaryText]);

  // Persist AI highlights (edits / clears).
  const handleAiHighlightsChange = useCallback(async (next) => {
    const prev = bodyLocations;
    setBodyLocations(next);
    try {
      await clinicalApi.saveBodyMap(patientId, {
        annotations,
        body_locations: next,
        summary_text: summaryText,
      });
    } catch (err) {
      setBodyLocations(prev); // rollback
      throw err;
    }
  }, [patientId, annotations, bodyLocations, summaryText]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <BodyMapView
        readOnly={!editable}
        freeClickMarkers={annotations}
        onMarkersChange={editable ? handleMarkersChange : undefined}
        aiHighlights={bodyLocations}
        onAiHighlightsChange={editable ? handleAiHighlightsChange : undefined}
      />
    </div>
  );
}
