"""
On-demand tiles: build (and disk-cache) a small region around any point in the
country the first time it's requested, then serve it instantly thereafter.

This makes the engine work *everywhere* without precomputing the whole country.
Precomputed cities (regions/*.pkl) are served by graph_store; anything else
falls through to here. Tiles use the same dual-graph + polygon router, so route
quality is consistent (they skip the slow whole-city consolidation/park steps to
keep the first-build fast).
"""
from __future__ import annotations

import math
import os
import pickle
import threading
from collections import OrderedDict

import osmnx as ox

from . import builder
from .dual_graph import build_dual_graph
from .graph_store import Region

ox.settings.use_cache = True

_CACHE_DIR = os.path.join(os.path.dirname(__file__), "regions", "_cache")
_MEM_MAX = 6
_MEM: "OrderedDict[str, Region]" = OrderedDict()
_LOCK = threading.Lock()


# Bump when the tile build changes shape (e.g. scenic added, off-road dropped,
# or the keying scheme changes) so stale cached tiles are rebuilt, not served.
# v7: loop tiles are distance-INDEPENDENT (one generous tile per cell serves
# every loop length) so changing the requested distance never rebuilds the area.
# v8: rough-paved + sidewalked arrays added; foot=no/private edges pruned at build.
# v9: minor paths inside campus/hospital/industrial/farmland or hugging rail removed.
_TILE_VERSION = "v9"

# Radius of a loop tile. One generous, distance-independent tile per ~1 km cell:
# big enough that loops up to the API max (~21 km, reach ≈ distance/π) stay inside
# it, so any distance reuses the same tile. Heavier than a per-distance tile but
# built once per area; tune REGIONS_LRU_MAX if memory gets tight.
_LOOP_TILE_RADIUS = 7000.0


def tile_key(lat, lng, distance_m, span_m=None):
    """The cache key + build radius for an on-demand tile at (lat,lng).

    Shared by the local builder here AND the cloud build Job (route_engine/
    build_job.py) + the GCS on-demand store (world_store.py), so a tile built in
    the cloud is keyed identically to one built locally. Returns
    (key, radius_m, cell_lat, cell_lng).

    Loop tiles key on the ~1 km cell ONLY (no distance) and use a fixed generous
    radius, so 5 km and 10 km in the same spot hit the same tile — no rebuild.
    A→B tiles still key on the span (they must cover two specific endpoints)."""
    cell_lat = round(lat, 2)
    cell_lng = round(lng, 2)
    if span_m is not None:
        # Cover both endpoints (the far one sits ~span/2 from the midpoint).
        radius = max(2500.0, min(12000.0, 0.5 * span_m + 2500.0))
        key = f"{cell_lat}_{cell_lng}_r{int(math.ceil(radius / 1000.0))}_{_TILE_VERSION}"
    else:
        radius = _LOOP_TILE_RADIUS
        key = f"{cell_lat}_{cell_lng}_{_TILE_VERSION}"
    return key, radius, cell_lat, cell_lng


def get_or_build(lat, lng, distance_m, span_m=None):
    """Return a Region covering (lat,lng), building if needed.

    For loops the tile is sized to the loop (~0.32·distance). For A→B, pass
    `span_m = |A B|` and `(lat,lng) = midpoint(A,B)` so the tile is sized/centred
    to cover BOTH endpoints (radius ≈ span/2 + margin)."""
    key, radius, cell_lat, cell_lng = tile_key(lat, lng, distance_m, span_m=span_m)

    with _LOCK:
        if key in _MEM:                      # hot in memory
            _MEM.move_to_end(key)
            return _MEM[key]

        os.makedirs(_CACHE_DIR, exist_ok=True)
        path = os.path.join(_CACHE_DIR, f"{key}.pkl")
        if os.path.exists(path):             # on disk → load
            with open(path, "rb") as f:
                region = Region(pickle.load(f))
            _remember(key, region)
            return region
        G = ox.graph_from_point(
            (cell_lat, cell_lng), dist=radius,
            network_type="walk", simplify=True,
        )
        G = builder.prune(G)
        # Remove minor paths inside campus/hospital/industrial/farmland zones or
        # hugging a railway (then re-clean dead-ends). Best-effort: a feature-query
        # failure must not block the tile build.
        try:
            avoid = builder.avoid_edges_point(G, (cell_lat, cell_lng), radius)
            if avoid:
                G.remove_edges_from(avoid)
                builder._remove_dead_ends(G)
        except Exception as exc:  # noqa: BLE001
            print(f"      (tile avoid-zones unavailable: {exc})")
        # Scenic (sea/river/park) for this tile so the sea/park preference and
        # landmark-seeking work everywhere — not just precomputed cities. One
        # extra feature query on the first build only (then cached).
        try:
            scenic = builder.scenic_edges_point(G, (cell_lat, cell_lng), radius)
        except Exception as exc:  # noqa: BLE001
            print(f"      (tile scenic unavailable: {exc})")
            scenic = None
        DG, info = build_dual_graph(G, scenic_keys=scenic)  # no consolidation → fast
        data = builder.serialize(G, DG, info, f"tile:{cell_lat},{cell_lng}")
        with open(path, "wb") as f:
            pickle.dump(data, f, protocol=pickle.HIGHEST_PROTOCOL)
        region = Region(data)
        _remember(key, region)
        return region


def _remember(key, region):
    _MEM[key] = region
    _MEM.move_to_end(key)
    while len(_MEM) > _MEM_MAX:
        _MEM.popitem(last=False)
