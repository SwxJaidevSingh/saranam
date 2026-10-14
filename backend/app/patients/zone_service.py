"""
GBA zone detection — maps a patient's lat/long to one of the 5 Greater
Bengaluru Authority corporations (North, South, East, West, Central).

Source of truth: ``app/patients/data/gba_zones.geojson`` — the official GBA
corporation boundaries (layer ``gba_boundary:gba_corporation_boundary`` from
the GBA GIS viewer / GeoServer), reprojected to WGS84 (lng/lat). Each feature
has ``properties.zone`` ∈ {North, South, East, West, Central}.

Detection is point-in-polygon (ray casting, supports MultiPolygon + holes).
``detect_zone`` is the PRIMARY zone assignment path; PIN-code lookup is only a
fallback (handled in the frontend / on import when lat-long is missing).
"""
import json
import os
from functools import lru_cache
from typing import Optional

_GEOJSON_PATH = os.path.join(os.path.dirname(__file__), 'data', 'gba_zones.geojson')

# Same palette the frontend uses for zone chips/markers.
ZONE_COLORS = {
    'North':   '#2563EB',
    'South':   '#059669',
    'East':    '#D97706',
    'West':    '#7C3AED',
    'Central': '#DC2626',
}


@lru_cache(maxsize=1)
def _load():
    """Load and cache the GBA zone FeatureCollection."""
    with open(_GEOJSON_PATH) as fh:
        return json.load(fh)


def get_boundaries() -> dict:
    """Return the raw GBA zone GeoJSON (for the map overlay)."""
    return _load()


def _point_in_ring(lng: float, lat: float, ring: list) -> bool:
    """Even-odd ray-casting test for a single linear ring."""
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if ((yi > lat) != (yj > lat)) and (
            lng < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi
        ):
            inside = not inside
        j = i
    return inside


def _polygon_contains(polygon: list, lng: float, lat: float) -> bool:
    """polygon = [outer_ring, hole1, hole2, ...]. Inside outer, outside all holes."""
    if not polygon:
        return False
    if not _point_in_ring(lng, lat, polygon[0]):
        return False
    return not any(_point_in_ring(lng, lat, hole) for hole in polygon[1:])


def _geometry_contains(geom: dict, lng: float, lat: float) -> bool:
    if not geom:
        return False
    if geom['type'] == 'Polygon':
        return _polygon_contains(geom['coordinates'], lng, lat)
    if geom['type'] == 'MultiPolygon':
        return any(_polygon_contains(poly, lng, lat) for poly in geom['coordinates'])
    return False


def detect_zone(lat: float, lng: float) -> Optional[str]:
    """Return the GBA zone name containing (lat, lng), or None if outside all
    5 corporations (e.g. peri-urban / outside GBA limits)."""
    try:
        lat = float(lat)
        lng = float(lng)
    except (TypeError, ValueError):
        return None
    for feature in _load().get('features', []):
        if _geometry_contains(feature.get('geometry'), lng, lat):
            return (feature.get('properties') or {}).get('zone')
    return None
