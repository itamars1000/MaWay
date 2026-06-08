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

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import elevation, graph_store, learning, ondemand
from .router import find_loop_candidates, RouteError


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
    }


class Feedback(BaseModel):
    turns_per_km: float
    distance_m: float
    target_m: float
    pleasant_frac: float = 0.0
    scenic_frac: float = 0.0
    label: int  # 1 = good (👍), 0 or -1 = bad (👎)


@app.post("/feedback")
def feedback(fb: Feedback):
    """Record a 👍/👎 on a route; the scorer's weights learn from it."""
    feats = {
        "turns": min(fb.turns_per_km / 8.0, 2.0),
        "dist": abs(fb.distance_m - fb.target_m) / max(fb.target_m, 1.0),
        "pleasant": 1.0 - fb.pleasant_frac,
        "scenic": 1.0 - fb.scenic_frac,
    }
    learning.record(feats, 1 if fb.label > 0 else 0)
    return {"ok": True, "feedback_count": learning.count(), "weights": learning.get_weights()}


@app.get("/regions")
def regions():
    return [{"name": r.name, "bbox": r.bbox} for r in graph_store.regions()]


@app.get("/loop")
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
                region = ondemand.get_or_build(mid[0], mid[1], distance, span_m=span)
            except Exception as exc:  # noqa: BLE001
                raise HTTPException(
                    status_code=422,
                    detail=f"end_uncovered: could not build a tile for A→B: {exc}",
                )
    elif region is None:
        try:
            region = ondemand.get_or_build(lat, lng, distance)
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

    # Best-effort elevation gain/loss (never fails the route).
    try:
        elevation.add_elevation(candidates)
    except Exception:  # noqa: BLE001
        pass

    return {"type": "FeatureCollection", "features": candidates}
