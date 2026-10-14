# Zone System Rewrite — BBMP boundaries, lat/long detection

Status: PLAN (locked decisions below; blocked only on the BBMP 5-zone boundary file)
Updated: 2026-05-23

## Locked decisions
1. **5 zones, names unchanged:** North, South, East, West, Central — boundaries
   as the BBMP GIS shows (real polygons, not pie wedges).
2. **Detection:** lat/long → point-in-polygon is **primary**; PIN code is
   **fallback** (only when lat/long missing); manual dropdown override always wins.

## Why this is a SMALL rewrite (key insight)
Because the zone **names don't change**, almost nothing downstream changes:
- UHID `ZONE_CODES` (South=01…Central=05) — **unchanged**, no append, no migration.
- `schemas.py` validator (`VALID_ZONE_NAMES`) — **unchanged**.
- `ZONE_COLORS`, analytics zone lists, scheduling cluster names — **unchanged**.
- Existing patients' `geographic_cluster` values stay valid — **no data re-map**.

The real work is only: get boundaries → detect by lat/long → draw real polygons
instead of wedges.

---

## 1. Current state (what we're replacing)
- Zone assigned by hardcoded PIN lookup `BANGALORE_PIN_ZONES` (~76 PINs) in
  `PatientQuickAdd.jsx`; user can override. Address text unused.
- lat/long captured (MapPicker / geolocation) → stored in `PatientLocation`
  (analytics.models) but **never used for zoning**.
- Map overlay = geometric pie wedges (`geo.js` `ZONE_WEDGE_CONFIG`,
  `generateWedgePolygon`) from Kidwai center. Visual only.

## 2. Data dependency — RESOLVED (2026-05-23)
The 5 zones are the **Greater Bengaluru Authority (GBA) corporations**:
North, South, East, West, Central — names match the app exactly (NOT the old
BBMP 8-zone scheme). Authoritative source obtained:

- GIS viewer: bbmp.gov.in/gisviewer → React SPA → GeoServer WFS at
  `https://dishaanktest.bbmpgov.in/geoserver/`.
- Layer: `gba_boundary:gba_corporation_boundary` (5 MultiPolygon features,
  property `corporation`/`Corporation` = zone name; also a `gba_zone_boundary`
  sub-zone layer and `gba_boundary` outer layer exist).
- Native CRS is EPSG:32643 (UTM metres) — refetched with `srsName=EPSG:4326`,
  normalized to GeoJSON `[lng,lat]`.
- **Saved canonical file:** `backend/app/patients/data/gba_zones.geojson`
  (FeatureCollection; each Feature `properties.zone` ∈ the 5 names).

Re-fetch command (if boundaries update):
`curl -k "https://dishaanktest.bbmpgov.in/geoserver/gba_boundary/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=gba_boundary:gba_corporation_boundary&outputFormat=application/json&srsName=EPSG:4326"`

## Progress (2026-05-23)
- [x] Phase 1 — data sourced & saved (above).
- [x] Phase 2 — backend `zone_service.py` (ray-casting point-in-polygon,
  MultiPolygon+holes) + endpoints `GET /api/patients/zones/boundaries` and
  `POST /api/patients/zones/detect`. Verified: Kidwai→West, MG Road→Central,
  Yelahanka→North, Whitefield→East, Mysore→None.
- [x] Phase 4 — frontend wiring DONE:
  - `api/patients.js` — `detectZone(lat,lng)` + `getZoneBoundaries()`.
  - `PatientQuickAdd.jsx` — `applyZoneFromLatLng()` auto-fills zone on GPS +
    map-pin drop (lat/long PRIMARY); `suggestZoneFromPin` kept as fallback;
    manual dropdown override unchanged.
  - `ScheduleDayMap.jsx` — renders the real GBA polygons via Google Maps
    `map.data.addGeoJson` (replaces the removed wedges).
  - Verified: HMR clean, endpoints return 401 (registered) in running app.
- [ ] Phase 3 — (optional) server-side auto-set `geographic_cluster` on
  create/edit as a safety net (frontend already sets it).
- [ ] Phase 5 — rebuild PIN fallback table (still the old ~76-PIN map).
- [ ] Phase 6 — fix duplicate `geographic_cluster` model column (latent;
  deferred to avoid DB/migration risk this session).
- [ ] Optional cleanup — `PatientEdit.jsx` auto-detect; remove now-unused
  `ZONE_WEDGE_CONFIG`/`generateWedgePolygon` from `geo.js`.

## 3. Target assignment flow
On create/edit:
1. Staff drops map pin / uses GPS → lat/long captured.
2. Frontend calls `POST /api/zones/detect {lat,lng}` → backend point-in-polygon
   → returns zone → auto-fills the dropdown.
3. If no lat/long but PIN entered → PIN→zone fallback suggestion.
4. Manual dropdown override always wins.
5. Backend, on save: if lat/long present and no explicit override, set
   `geographic_cluster` authoritatively via the same point-in-polygon.
6. If lat/long falls outside all 5 polygons (peri-urban / outside BBMP) →
   don't force a zone; fall back to PIN/manual.

## 4. Backend changes

| File | Change |
|---|---|
| `app/patients/data/bbmp_zones.geojson` | **New** — canonical 5-zone boundary file. |
| `app/patients/zone_service.py` | **New** — load GeoJSON once; `detect_zone(lat,lng) -> str|None` via point-in-polygon; `get_boundaries()` returns the GeoJSON. Use `shapely` (handles MultiPolygon/holes) or a ray-casting helper to avoid the dep. |
| `app/patients/routes.py` | **New endpoints:** `GET /api/zones/boundaries` (GeoJSON + `ZONE_COLORS` for the map), `POST /api/zones/detect` ({lat,lng} → {zone}). |
| `app/patients/services.py` | In `create_patient`/`update_patient`: when lat/long is provided and no manual zone, call `zone_service.detect_zone` to set `geographic_cluster`. |
| `app/patients/models.py` | **Fix latent bug:** `geographic_cluster` is declared twice (L74 String(20), L122 String(100)) — keep one (String(100), indexed). |
| `requirements.txt` | Add `shapely` if used for point-in-polygon. |

No change to `uhid_service.py`, `schemas.py` validator, analytics, or scheduling
(names unchanged).

## 5. Frontend changes

| File | Change |
|---|---|
| `src/constants/geo.js` | Remove `ZONE_WEDGE_CONFIG` + `generateWedgePolygon`. Keep `ZONE_COLORS` (same 5). |
| `src/api/patients.js` (or new `src/api/zones.js`) | Add `detectZone(lat,lng)` and `getZoneBoundaries()` calls. |
| `src/components/common/MapPicker.jsx` | On pin drop / GPS, capture lat/long and trigger `detectZone`; optionally render the 5 zone polygons for context. |
| `src/components/patients/PatientQuickAdd.jsx` | Replace primary `suggestZoneFromPin` with `detectZone(lat,lng)` on pin drop; keep `BANGALORE_PIN_ZONES` as fallback only; manual override unchanged. |
| `src/pages/patients/PatientEdit.jsx` | Same lat/long-first detection on location change; reuse fallback. |
| `src/components/saranam/ScheduleDayMap.jsx` | Render real BBMP polygons from `getZoneBoundaries()` instead of wedges (wedge overlay already removed at L211). |
| `src/pages/saranam/scheduling/WeeklyPlanningBoard.jsx`, `ActiveScheduleVisits.jsx` | No logic change (still color by `geographic_cluster`); optionally drop the hardcoded `'Central'` fallback. |

## 6. PIN fallback
Keep a PIN→zone table for the no-lat/long case, but treat it as approximate
(one PIN can straddle zones). Either keep `BANGALORE_PIN_ZONES` (rebuilt to match
the new boundaries) or compute each PIN's centroid and run the same
point-in-polygon. Manual override remains the final correction.

## 7. Existing data
- Zone names unchanged → all 223 patients keep their current `geographic_cluster`.
  **No migration required.**
- Optional later backfill: re-detect zone for patients who have lat/long in
  `PatientLocation` (few do). The master-sheet zones are client-authoritative —
  do NOT auto-overwrite them.

## 8. Phases
1. Obtain the 5-zone BBMP GeoJSON (blocker).
2. Backend: add GeoJSON + `zone_service` + the two endpoints.
3. Backend: wire lat/long → `geographic_cluster` on create/edit.
4. Frontend: MapPicker detection; remove wedges; render real polygons.
5. Rebuild PIN fallback to match new boundaries.
6. Fix the duplicate model column.
7. (Optional) backfill zones for patients with stored lat/long.

## 9. Risks / notes
- **Boundary file is the gate** — nothing meaningful ships without the 5-zone
  GeoJSON that matches the client's GIS view. Confirm the grouping if we derive
  it from BBMP wards.
- Accuracy depends on staff dropping an accurate pin — make location capture a
  prominent (ideally required-for-Bangalore) step.
- `shapely` adds a GEOS dependency; a ray-casting helper avoids it but must
  handle MultiPolygons/holes correctly.
- Points outside all polygons must NOT be force-assigned a zone.
