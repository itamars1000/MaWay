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

import os
import time

from . import graph_store, ondemand

_BUILD_JOB = os.getenv("BUILD_JOB", "").strip()
_PROJECT_ENV = os.getenv("GCP_PROJECT", "").strip()
_REGION = os.getenv("BUILD_JOB_REGION", os.getenv("GCP_REGION", "")).strip()
_BUILD_TIMEOUT_S = float(os.getenv("BUILD_TIMEOUT_S", "1200"))
_ERROR_COOLDOWN_S = float(os.getenv("BUILD_ERROR_COOLDOWN_S", "300"))

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


def enabled() -> bool:
    """True only when the cloud build pipeline is fully wired (else local path)."""
    return bool(graph_store._BUCKET and _BUILD_JOB and _REGION and _project())


def get_or_trigger(lat, lng, distance_m, span_m=None):
    """Return a ready on-demand Region for (lat,lng), or trigger a build and
    raise Building. Re-raises RuntimeError if a recent build failed."""
    key, _radius, _cl, _cn = ondemand.tile_key(lat, lng, distance_m, span_m=span_m)

    region = graph_store.load_ondemand(key)  # cached or already-built pkl
    if region is not None:
        return region

    marker = graph_store.read_marker(key)
    if marker:
        status = marker.get("status")
        age = time.time() - float(marker.get("updated_at", 0) or 0)
        if status == "ready":
            region = graph_store.load_ondemand(key)  # marker ahead of pkl? retry load
            if region is not None:
                return region
        elif status == "building" and age < _BUILD_TIMEOUT_S:
            raise Building(key)  # a build is already in flight — just keep polling
        elif status == "error" and age < _ERROR_COOLDOWN_S:
            raise RuntimeError(marker.get("error", "tile build failed"))
        # else: stale building / old error → fall through and (re)trigger

    # Claim the build immediately (dedupes concurrent first-requests in the gap
    # before the Job starts and writes its own marker), then launch the Job.
    graph_store.write_marker(key, {"status": "building",
                                   "name": f"area {lat:.3f},{lng:.3f}",
                                   "updated_at": time.time()})
    try:
        _run_job(key, lat, lng, distance_m, span_m)
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
