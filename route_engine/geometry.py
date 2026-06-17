"""Step 4: resolve a dual-node path back to coordinates → GeoJSON Feature."""
from __future__ import annotations

from .geo import bearing, haversine, wrap180

_RESAMPLE_M = 20.0   # resample spacing in meters
_SHARP_DEG = 45.0    # >=45° is a real running turn (tighter than a gentle curve)
_TURN_WINDOW_M = 30.0   # heading baseline before/after a vertex (rate-normalized)


def sharp_turns_in_coords(coords, threshold_deg: float = _SHARP_DEG) -> int:
    """
    Count sharp turns from a (lat, lng) polyline, matched to how a runner
    perceives them. Resamples to ~20 m, then at each vertex compares the heading
    over a fixed ~30 m baseline *before* vs *after* it (rather than the two raw
    adjacent steps). Each contiguous run of above-threshold vertices is one turn:

      - a gentle sweeping curve stays below threshold (no false turns),
      - a corner *rounded* across 2–3 close vertices is caught as one turn (the
        old per-step test missed these — each sub-step was < threshold),
      - clustered points at a single corner aren't double-counted (the whole
        corner is one contiguous run → one turn).

    Used by the router, which scores from geometry rather than the dual graph.
    """
    pts = [coords[0]]
    cum = [0.0]
    for p in coords[1:]:
        d = haversine(pts[-1], p)
        if d >= _RESAMPLE_M:
            pts.append(p)
            cum.append(cum[-1] + d)
    if len(pts) < 3:
        return 0

    last = len(pts) - 1

    def before(i):
        j = i
        while j > 0 and cum[i] - cum[j] < _TURN_WINDOW_M:
            j -= 1
        return j

    def after(i):
        k = i
        while k < last and cum[k] - cum[i] < _TURN_WINDOW_M:
            k += 1
        return k

    n = 0
    in_turn = False
    for i in range(1, last):
        j, k = before(i), after(i)
        if j == i or k == i:
            in_turn = False
            continue
        delta = abs(wrap180(bearing(pts[i], pts[k]) - bearing(pts[j], pts[i])))
        if delta >= threshold_deg:
            if not in_turn:       # rising edge of a turn → count once
                n += 1
                in_turn = True
        else:
            in_turn = False
    return n


def feature_from_coords(coords):
    """Build a GeoJSON LineString Feature from a (lat, lng) polyline."""
    lnglat = [[lng, lat] for (lat, lng) in coords]
    distance_m = sum(haversine(coords[i - 1], coords[i]) for i in range(1, len(coords)))
    sharp = sharp_turns_in_coords(coords)
    return {
        "type": "Feature",
        "geometry": {"type": "LineString", "coordinates": lnglat},
        "properties": {
            "distance_m": round(distance_m, 1),
            "sharp_turns": sharp,
            "sharp_turns_per_km": round(sharp / max(distance_m / 1000.0, 0.1), 2),
            "closed_loop_gap_m": round(haversine(coords[0], coords[-1]), 1),
        },
    }


def path_to_coords(info, dual_path):
    """Stitch segment polylines into one (lat, lng) list, de-duping shared joins."""
    coords = []
    for nid in dual_path:
        seg = info[nid]["coords"]
        if coords and coords[-1] == seg[0]:
            coords.extend(seg[1:])
        else:
            coords.extend(seg)
    return coords


def count_sharp_turns(DG, dual_path, threshold_deg: float = 70.0) -> int:
    """Sharp turns along the path, read straight from the dual-edge `turn_deg`."""
    n = 0
    for a, b in zip(dual_path, dual_path[1:]):
        if DG.has_edge(a, b) and DG[a][b]["turn_deg"] >= threshold_deg:
            n += 1
    return n


def to_geojson_feature(info, DG, dual_path):
    """Build a GeoJSON LineString Feature with distance/turn properties."""
    latlng = path_to_coords(info, dual_path)
    lnglat = [[lng, lat] for (lat, lng) in latlng]  # GeoJSON is [lng, lat]
    distance_m = sum(haversine(latlng[i - 1], latlng[i]) for i in range(1, len(latlng)))
    sharp = count_sharp_turns(DG, dual_path)

    return {
        "type": "Feature",
        "geometry": {"type": "LineString", "coordinates": lnglat},
        "properties": {
            "distance_m": round(distance_m, 1),
            "sharp_turns": sharp,
            "sharp_turns_per_km": round(sharp / max(distance_m / 1000.0, 0.1), 2),
            "closed_loop_gap_m": round(haversine(latlng[0], latlng[-1]), 1),
        },
    }
