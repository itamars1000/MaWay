"""
Elevation gain/loss for generated routes, via the free Open-Meteo Elevation API
(no key). Best-effort: on any network/parse error the route is returned without
elevation props (the UI shows "—"). Adds ~0.3–0.6 s (one request per route,
run in parallel).
"""
from __future__ import annotations

import json
import urllib.parse
import urllib.request

from .geo import haversine

_URL = "https://api.open-meteo.com/v1/elevation"
_MAX_POINTS = 100          # Open-Meteo caps coordinates per request
_NOISE_M = 1.5             # ignore sub-noise jitters from the 90 m DEM


def _resample(coords, max_points=_MAX_POINTS):
    """Evenly-spaced (by distance) sample of a [lng,lat] polyline → [(lat,lng)].
    Always includes the first and last point; ≤ max_points."""
    pts = [(lat, lng) for lng, lat in coords]
    if len(pts) <= max_points:
        return pts
    # Cumulative distance, then pick points at even spacing.
    cum = [0.0]
    for i in range(1, len(pts)):
        cum.append(cum[-1] + haversine(pts[i - 1], pts[i]))
    total = cum[-1] or 1.0
    step = total / (max_points - 1)
    out, target, j = [pts[0]], step, 1
    for k in range(1, max_points - 1):
        while j < len(pts) - 1 and cum[j] < target:
            j += 1
        out.append(pts[j])
        target += step
    out.append(pts[-1])
    return out


def _fetch_elevations(latlngs, timeout):
    qs = urllib.parse.urlencode({
        "latitude": ",".join(f"{la:.5f}" for la, _ in latlngs),
        "longitude": ",".join(f"{lo:.5f}" for _, lo in latlngs),
    })
    with urllib.request.urlopen(f"{_URL}?{qs}", timeout=timeout) as resp:
        data = json.load(resp)
    return data.get("elevation") or []


def _ascent_descent(elevs):
    """Sum of positive / negative consecutive deltas, after a noise threshold."""
    ascent = descent = 0.0
    prev = None
    for e in elevs:
        if e is None:
            continue
        if prev is not None:
            d = e - prev
            if d >= _NOISE_M:
                ascent += d
            elif d <= -_NOISE_M:
                descent += -d
        prev = e
    return round(ascent), round(descent)


def add_elevation(features, timeout: float = 4.0):
    """Attach ascent_m/descent_m to every feature in ONE Open-Meteo request:
    resample each route, concatenate the points (≤100 total), fetch once, then
    split the elevations back per route. Best-effort — leave props unset on any
    failure (the UI shows "—")."""
    if not features:
        return features
    per = max(2, _MAX_POINTS // len(features))
    samples = [_resample(f["geometry"]["coordinates"], per) for f in features]
    flat = [pt for s in samples for pt in s]
    if not flat:
        return features
    try:
        elevs = _fetch_elevations(flat, timeout)
    except Exception:  # noqa: BLE001
        return features

    idx = 0
    for feat, s in zip(features, samples):
        seg = elevs[idx:idx + len(s)]
        idx += len(s)
        if len(seg) >= 2:
            up, down = _ascent_descent(seg)
            feat["properties"]["ascent_m"] = up
            feat["properties"]["descent_m"] = down
    return features
