"""Pure geographic helpers (no heavy deps) shared across the engine."""
from __future__ import annotations

import math

EARTH_RADIUS_M = 6_371_000.0


def haversine(p1, p2) -> float:
    """Great-circle distance in meters between (lat, lng) points."""
    lat1, lon1 = math.radians(p1[0]), math.radians(p1[1])
    lat2, lon2 = math.radians(p2[0]), math.radians(p2[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def bearing(p1, p2) -> float:
    """Initial compass bearing (degrees, 0=N, 90=E) from p1 to p2 (lat, lng)."""
    lat1, lat2 = math.radians(p1[0]), math.radians(p2[0])
    dlon = math.radians(p2[1] - p1[1])
    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0


def destination(lat, lng, bearing_deg, distance_m):
    """Point reached from (lat, lng) heading `bearing_deg` for `distance_m` (great-circle)."""
    delta = distance_m / EARTH_RADIUS_M
    theta = math.radians(bearing_deg)
    phi1 = math.radians(lat)
    lambda1 = math.radians(lng)

    sin_phi2 = math.sin(phi1) * math.cos(delta) + math.cos(phi1) * math.sin(delta) * math.cos(theta)
    phi2 = math.asin(sin_phi2)
    y = math.sin(theta) * math.sin(delta) * math.cos(phi1)
    x = math.cos(delta) - math.sin(phi1) * sin_phi2
    lambda2 = lambda1 + math.atan2(y, x)
    return (math.degrees(phi2), (math.degrees(lambda2) + 540.0) % 360.0 - 180.0)


def wrap180(deg: float) -> float:
    """Wrap an angle difference to [-180, 180)."""
    return (deg + 180.0) % 360.0 - 180.0
