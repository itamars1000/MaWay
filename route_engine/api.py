"""
FastAPI wrapper around the route engine.

Run from the project root (the folder containing route_engine/):
    route_engine/.venv/Scripts/python -m uvicorn route_engine.api:app --port 8000

On startup it loads every precomputed region (route_engine/regions/*.pkl) into
memory, so requests inside a covered city are served instantly from the
rustworkx router. Points outside all regions fall back to the live (slow)
generator so coverage degrades gracefully.

GET /loop?lat=..&lng=..&distance=<meters>[&seed=..][&n=3]  -> GeoJSON FeatureCollection
GET /health   GET /regions
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import graph_store, learning, ondemand, ratelimit, world_store
from .router import find_loop_candidates, RouteError

# Per-IP rate limits (in-memory; see ratelimit.py). Tunable via env without code.
_limit_loop = ratelimit.limit("loop", "RATE_LIMIT_PER_MIN", 30)
_limit_feedback = ratelimit.limit("feedback", "RATE_LIMIT_FEEDBACK_PER_MIN", 10)


def _ondemand_region(lat, lng, distance, span_m=None):
    """A Region for an uncovered point. In the cloud (world_store.enabled) this
    triggers an async build Job and raises HTTP 425 `building` while it runs; the
    web app polls until ready. Locally it builds synchronously via Overpass."""
    if world_store.enabled():
        try:
            return world_store.get_or_trigger(lat, lng, distance, span_m=span_m)
        except world_store.Building:
            raise HTTPException(
                status_code=425,
                detail="building: preparing this area for the first time",
            )
        except world_store.BuildBusy:
            # Global on-demand build budget exhausted — refuse NEW builds for now
            # (protects against runaway build cost), distinct from a per-area failure.
            raise HTTPException(
                status_code=503,
                detail="build_busy: area builds are rate-limited right now, try later",
            )
        except RuntimeError as exc:
            # The async build Job failed (e.g. a transient data-source outage)
            # or couldn't be started. Surface a distinct, friendly code rather
            # than the generic "try a different distance" path — and let the web
            # app advise the user to retry shortly (the short error cooldown in
            # world_store means a retry will re-trigger a fresh build).
            raise HTTPException(status_code=422, detail=f"build_failed: {exc}")
    return ondemand.get_or_build(lat, lng, distance, span_m=span_m)


@asynccontextmanager
async def lifespan(app: FastAPI):
    regions = graph_store.load_all()
    print(f"loaded {len(regions)} region(s): {[r.name for r in regions]}")
    yield


# Allowed browser origins. In production set ALLOWED_ORIGINS to the web app's
# URL(s), comma-separated (e.g. "https://maway.vercel.app"). Unset → "*", which
# keeps local dev working out of the box.
_origins_env = os.getenv("ALLOWED_ORIGINS", "").strip()
ALLOWED_ORIGINS = (
    [o.strip() for o in _origins_env.split(",") if o.strip()] if _origins_env else ["*"]
)

app = FastAPI(title="RunRoute engine", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "ok": True,
        "regions": [r.name for r in graph_store.regions()],
        "feedback_count": learning.count(),
        # On-demand worldwide pipeline status (booleans only — no secret values).
        # `enabled` must be true for uncovered areas to build in the cloud;
        # if false, the named var(s) aren't reaching this revision.
        "ondemand": {
            "enabled": world_store.enabled(),
            "regions_bucket": bool(graph_store._BUCKET),
            "build_job": bool(world_store._BUILD_JOB),
            "build_job_region": bool(world_store._REGION),
            "gcp_project": bool(world_store._project()),
        },
    }


class Feedback(BaseModel):
    turns_per_km: float
    distance_m: float
    target_m: float
    pleasant_frac: float = 0.0
    scenic_frac: float = 0.0
    label: int  # 1 = good (👍), 0 or -1 = bad (👎)


def _feedback_features(fb: "Feedback") -> dict:
    """Badness features from a feedback payload, each CLAMPED to its sane range.
    The payload is anonymous and client-supplied, so an attacker could send wild
    values to yank the fit; clamping bounds each feature before it can move the
    learned weights (the _MAX_ALPHA cap in learning.py bounds it further)."""
    def clamp(v, lo, hi):
        return max(lo, min(hi, v))
    return {
        "turns": clamp(fb.turns_per_km, 0.0, 16.0) / 8.0,     # 0..2
        "dist": clamp(abs(fb.distance_m - fb.target_m) / max(fb.target_m, 1.0), 0.0, 3.0),
        "pleasant": clamp(1.0 - fb.pleasant_frac, 0.0, 1.0),
        "scenic": clamp(1.0 - fb.scenic_frac, 0.0, 1.0),
    }


@app.post("/feedback", dependencies=[Depends(_limit_feedback)])
def feedback(fb: Feedback):
    """Record a 👍/👎 on a route; the scorer's weights learn from it."""
    learning.record(_feedback_features(fb), 1 if fb.label > 0 else 0)
    return {"ok": True, "feedback_count": learning.count(), "weights": learning.get_weights()}


@app.get("/regions")
def regions():
    return [{"name": r.name, "bbox": r.bbox} for r in graph_store.regions()]


@app.post("/admin/reload")
def admin_reload(token: str = Query(...)):
    """Re-read the base region index from storage without a restart, so a city
    uploaded to the bucket goes live immediately. Guarded by ADMIN_TOKEN."""
    expected = os.getenv("ADMIN_TOKEN", "").strip()
    if not expected or token != expected:
        raise HTTPException(status_code=403, detail="forbidden")
    count = graph_store.reload()
    return {"ok": True, "regions": count}


@app.post("/admin/reindex")
def admin_reindex(token: str = Query(...)):
    """Self-heal index.json: drop entries whose .pkl is missing from storage,
    rewrite the index, and reload it. Use after a region pickle is deleted.
    Guarded by ADMIN_TOKEN."""
    expected = os.getenv("ADMIN_TOKEN", "").strip()
    if not expected or token != expected:
        raise HTTPException(status_code=403, detail="forbidden")
    result = graph_store.reindex()
    return {"ok": True, **result}


@app.get("/loop", dependencies=[Depends(_limit_loop)])
def loop(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    distance: float = Query(..., gt=200, le=21100, description="target meters"),
    seed: Optional[int] = None,
    n: Optional[int] = Query(
        None, ge=1, le=24,
        description="candidate rotations (default: auto-scaled to distance)",
    ),
    waypoints: Optional[int] = Query(
        None, ge=3, le=8, description="force a single polygon size (else auto)"
    ),
    via_lat: Optional[float] = Query(None, ge=-90, le=90),
    via_lng: Optional[float] = Query(None, ge=-180, le=180),
    end_lat: Optional[float] = Query(None, ge=-90, le=90),
    end_lng: Optional[float] = Query(None, ge=-180, le=180),
    # Guest-funnel measurement, set by the web client when nobody is signed in.
    # Neither value is used for routing — they are declared (rather than left as
    # ignored extras) so they are validated, documented in /docs, and bounded:
    # both land in the Cloud Run request log, which is where the count is read
    # from, and an unbounded `cid` would let anyone write arbitrary log lines.
    guest: Optional[int] = Query(None, ge=0, le=1),
    cid: Optional[str] = Query(None, max_length=64, pattern=r"^[A-Za-z0-9-]+$"),
):
    """
    Returns a GeoJSON FeatureCollection with `n` loop candidates, sorted
    best-first (lowest turns + closest distance to target).
    The frontend shows the first one and cycles through with "מסלול הבא".
    With end_lat/end_lng it's an A→B path instead of a loop.
    """
    via_pt = (via_lat, via_lng) if via_lat is not None and via_lng is not None else None
    end_pt = (end_lat, end_lng) if end_lat is not None and end_lng is not None else None

    # Pick a region that covers the start — and, for A→B, the end too. Falls back
    # to an on-demand tile (sized to span both endpoints in A→B mode).
    region = graph_store.region_for(lat, lng)
    if end_pt is not None:
        if region is not None and region.coverage_gap_m(
            end_pt[0], end_pt[1]
        ) > graph_store._MAX_COVERAGE_GAP_M:
            region = None  # precomputed region doesn't reach the end → tile
        if region is None:
            mid = ((lat + end_pt[0]) / 2.0, (lng + end_pt[1]) / 2.0)
            span = graph_store.haversine((lat, lng), end_pt)
            try:
                region = _ondemand_region(mid[0], mid[1], distance, span_m=span)
            except HTTPException:
                raise
            except Exception as exc:  # noqa: BLE001
                raise HTTPException(
                    status_code=422,
                    detail=f"end_uncovered: could not build a tile for A→B: {exc}",
                )
    elif region is None:
        try:
            region = _ondemand_region(lat, lng, distance)
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=422,
                detail=f"could not build a map tile here: {exc}",
            )

    try:
        candidates = find_loop_candidates(
            region, lat, lng, distance, n=n, seed=seed, waypoints=waypoints,
            via_pt=via_pt, end_pt=end_pt,
        )
    except RouteError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # Elevation gain/loss is fetched inside the router now (it both annotates the
    # routes for display AND lets the scorer prefer flatter loops), so there's no
    # separate elevation pass here.
    return {"type": "FeatureCollection", "features": candidates}
