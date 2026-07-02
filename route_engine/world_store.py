"""
On-demand worldwide coverage, async + zero idle cost.

When a request lands outside every precomputed base region, the serving Cloud
Run *service* asks a separate Cloud Run *Job* to build that area's tile (from a
Geofabrik extract — works from any IP, unlike Overpass). The Job uploads the
tile to GCS and the service serves it on the next request. While it builds, the
service returns the engine code `building` so the web app can poll.

This module is the service-side glue: pick the tile key, check the GCS marker,
trigger the Job, and surface the right state. It is a no-op unless the cloud env
is wired (a bucket + a Job name) — local dev keeps using the Overpass-based
route_engine/ondemand.py path untouched.

Env:
  REGIONS_BUCKET   GCS bucket holding regions + ondemand tiles (shared w/ graph_store)
  BUILD_JOB        Cloud Run Job name to run for builds
  BUILD_JOB_REGION Cloud Run region of that Job (e.g. "us-west1")
  GCP_PROJECT      project id (for the Run Admin API URL)
  BUILD_TIMEOUT_S  a 'building' marker older than this is treated as stale (default 1200)
"""
from __future__ import annotations

import json
import math
import os
import time

from . import graph_store, ondemand
from .geo import haversine

_BUILD_JOB = os.getenv("BUILD_JOB", "").strip()
_PROJECT_ENV = os.getenv("GCP_PROJECT", "").strip()
_REGION = os.getenv("BUILD_JOB_REGION", os.getenv("GCP_REGION", "")).strip()
_BUILD_TIMEOUT_S = float(os.getenv("BUILD_TIMEOUT_S", "1200"))
# Global cap on NEW on-demand builds per rolling hour — the hard ceiling on the
# most expensive operation (a Job build downloads a Geofabrik extract + builds a
# graph). Bounds cost even under a distributed flood. Tunable via env.
_MAX_BUILDS_PER_HOUR = int(os.getenv("MAX_BUILDS_PER_HOUR", "60"))
_BUILD_LEDGER_KEY = f"{graph_store._ONDEMAND_PREFIX}_builds.json"
# After a failed build we briefly refuse to re-trigger (so a genuinely broken
# area doesn't spam the Job). Kept short: most failures are transient data-source
# blips, and the web app tells the user to "try again in a moment" — a retry past
# this window re-triggers a fresh build.
_ERROR_COOLDOWN_S = float(os.getenv("BUILD_ERROR_COOLDOWN_S", "90"))

_project_cache: str | None = None


def _project() -> str:
    """The GCP project id. Prefer GCP_PROJECT, else auto-detect on Cloud Run
    (ADC / metadata server) so it needn't be set by hand. Cached after first use."""
    global _project_cache
    if _PROJECT_ENV:
        return _PROJECT_ENV
    if _project_cache is not None:
        return _project_cache
    proj = ""
    try:
        import google.auth
        _, proj = google.auth.default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        proj = proj or ""
    except Exception:  # noqa: BLE001
        proj = ""
    if not proj:  # metadata server fallback (Cloud Run / GCE)
        try:
            import requests
            proj = requests.get(
                "http://metadata.google.internal/computeMetadata/v1/project/project-id",
                headers={"Metadata-Flavor": "Google"}, timeout=2,
            ).text.strip()
        except Exception:  # noqa: BLE001
            proj = ""
    _project_cache = proj
    return proj


class Building(Exception):
    """Raised when the area's tile is being built — caller returns `building`."""

    def __init__(self, key: str):
        super().__init__(f"building tile {key}")
        self.key = key


class BuildBusy(Exception):
    """Raised when the global per-hour build budget is exhausted — caller should
    refuse to start a NEW build (returns a distinct 'busy, try later' state)."""


def _reserve_build_slot() -> None:
    """Account one NEW build against the rolling-hour budget, or raise BuildBusy.

    Uses a small GCS ledger object (a list of recent trigger epochs) so the cap
    is global across serving instances. Read-modify-write is mildly racy under
    concurrency (worst case a slight overshoot of the cap) — acceptable, since it
    still bounds builds to ~cap rather than unbounded."""
    if _MAX_BUILDS_PER_HOUR <= 0:           # 0/negative disables the cap
        return
    now = time.time()
    cutoff = now - 3600.0
    try:
        raw = graph_store._read_bytes(_BUILD_LEDGER_KEY)
        recent = [t for t in json.loads(raw) if isinstance(t, (int, float)) and t > cutoff]
    except Exception:  # noqa: BLE001 — missing/corrupt ledger → start fresh
        recent = []
    if len(recent) >= _MAX_BUILDS_PER_HOUR:
        raise BuildBusy(f"build budget exhausted ({_MAX_BUILDS_PER_HOUR}/h)")
    recent.append(now)
    try:
        graph_store._write_bytes(
            _BUILD_LEDGER_KEY,
            json.dumps(recent).encode("utf-8"),
            content_type="application/json",
        )
    except Exception:  # noqa: BLE001 — ledger write failure shouldn't block the build
        pass


def enabled() -> bool:
    """True only when the cloud build pipeline is fully wired (else local path)."""
    return bool(graph_store._BUCKET and _BUILD_JOB and _REGION and _project())


# Remember each area's resolved tile filename so repeat requests hit the
# in-memory LRU directly, without re-reading the marker every time.
_FILE_BY_KEY: dict[str, str] = {}


def _covering_neighbor(lat, lng, distance_m):
    """A ready NEIGHBOURING loop tile that already covers (lat,lng) for this
    distance → (file, Region), else None.

    Tiles are keyed per ~1 km cell but built with a generous fixed radius, so a
    request landing one cell over from a built area is fully covered by the
    existing tile — without this check it would pay a whole new build (measured
    ~18 min for a dense capital). Scanned nearest-first with a bounded number
    of marker reads; only on the would-build path, never on the hot path."""
    needed = 0.35 * distance_m + 500.0            # loop reach ≈ D/π + wiggle room
    slack = ondemand._LOOP_TILE_RADIUS - needed   # max distance to a usable centre
    if slack <= 0:
        return None                               # very long loop → own cell only
    base_lat, base_lng = round(lat, 2), round(lng, 2)
    lat_cells = min(6, int(slack // 1110.0) + 1)  # 0.01° lat ≈ 1.11 km
    lng_cell_m = 1110.0 * max(0.2, math.cos(math.radians(lat)))
    lng_cells = min(8, int(slack // lng_cell_m) + 1)
    cands = []
    for di in range(-lat_cells, lat_cells + 1):
        for dj in range(-lng_cells, lng_cells + 1):
            if di == 0 and dj == 0:
                continue                          # the exact cell was already checked
            c_lat = round(base_lat + 0.01 * di, 2)
            c_lng = round(base_lng + 0.01 * dj, 2)
            d = haversine((lat, lng), (c_lat, c_lng))
            if d <= slack:
                cands.append((d, c_lat, c_lng))
    cands.sort()
    for _d, c_lat, c_lng in cands[:16]:           # nearest first; bounded GCS reads
        nkey = f"{c_lat}_{c_lng}_{ondemand._TILE_VERSION}"
        marker = graph_store.read_marker(nkey)
        if not marker or marker.get("status") != "ready":
            continue
        file = marker.get("file") or f"{graph_store._ONDEMAND_PREFIX}{nkey}.pkl"
        region = graph_store.load_ondemand_file(file)
        if region is not None:
            return file, region
    return None


def get_or_trigger(lat, lng, distance_m, span_m=None):
    """Return a ready on-demand Region for (lat,lng), or trigger a build and
    raise Building. Re-raises RuntimeError if a recent build failed."""
    key, radius, cell_lat, cell_lng = ondemand.tile_key(lat, lng, distance_m, span_m=span_m)

    cached_file = _FILE_BY_KEY.get(key)
    if cached_file:  # known tile → straight to the LRU (no marker read)
        region = graph_store.load_ondemand_file(cached_file)
        if region is not None:
            return region

    marker = graph_store.read_marker(key)
    if marker:
        status = marker.get("status")
        age = time.time() - float(marker.get("updated_at", 0) or 0)
        if status == "ready":
            # The Job records the tile's (readable) filename in the marker; fall
            # back to the legacy coord-named path for tiles built before that.
            file = marker.get("file") or f"{graph_store._ONDEMAND_PREFIX}{key}.pkl"
            region = graph_store.load_ondemand_file(file)
            if region is not None:
                _FILE_BY_KEY[key] = file
                return region
        elif status == "building" and age < _BUILD_TIMEOUT_S:
            raise Building(key)  # a build is already in flight — just keep polling
        elif status == "error" and age < _ERROR_COOLDOWN_S:
            raise RuntimeError(marker.get("error", "tile build failed"))
        # else: stale building / old error → fall through and (re)trigger

    # Before paying for a fresh build: a neighbouring cell's generous tile may
    # already cover this point for this distance. (Loops only — A→B tiles are
    # sized to their two endpoints and rarely reusable across cells.)
    if span_m is None:
        found = _covering_neighbor(lat, lng, distance_m)
        if found is not None:
            nfile, region = found
            _FILE_BY_KEY[key] = nfile  # this cell now resolves without a scan
            return region

    # Gate NEW builds against the global per-hour budget BEFORE claiming/launching
    # (raises BuildBusy when exhausted). Only reached when an area genuinely needs
    # a fresh build — never on the cached/ready/in-flight path above.
    _reserve_build_slot()

    # Claim the build immediately (dedupes concurrent first-requests in the gap
    # before the Job starts and writes its own marker), then launch the Job.
    graph_store.write_marker(key, {"status": "building",
                                   "name": f"area {lat:.3f},{lng:.3f}",
                                   "updated_at": time.time()})
    try:
        # Build centred on the cell with the key's radius (loops are distance-
        # independent → a fixed generous radius; A→B keeps its span size). The
        # Job sizes by distance, so convert the radius back to a build distance.
        from .osm_pbf import distance_for_radius
        build_dist = distance_m if span_m is not None else distance_for_radius(radius)
        _run_job(key, cell_lat, cell_lng, build_dist, span_m)
    except Exception as exc:  # noqa: BLE001 — couldn't even start the build
        graph_store.write_marker(key, {"status": "error",
                                       "error": f"trigger failed: {exc}"[:500],
                                       "updated_at": time.time()})
        raise RuntimeError(f"could not start area build: {exc}")
    raise Building(key)


def _run_job(key, lat, lng, distance_m, span_m):
    """Execute the Cloud Run Job with per-build env overrides (Run Admin v2)."""
    import google.auth
    from google.auth.transport.requests import AuthorizedSession

    creds, _ = google.auth.default(
        scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    session = AuthorizedSession(creds)
    url = (f"https://run.googleapis.com/v2/projects/{_project()}/locations/"
           f"{_REGION}/jobs/{_BUILD_JOB}:run")
    env = [
        {"name": "TILE_KEY", "value": key},
        {"name": "TILE_LAT", "value": repr(float(lat))},
        {"name": "TILE_LNG", "value": repr(float(lng))},
        {"name": "TILE_DISTANCE", "value": repr(float(distance_m))},
    ]
    if span_m is not None:
        env.append({"name": "TILE_SPAN", "value": repr(float(span_m))})
    body = {"overrides": {"containerOverrides": [{"env": env}]}}
    resp = session.post(url, json=body, timeout=30)
    resp.raise_for_status()
