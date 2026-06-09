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


# Bump when the tile build changes shape (e.g. scenic added, off-road dropped)
# so stale cached tiles are rebuilt instead of served.
_TILE_VERSION = "v5"


def get_or_build(lat, lng, distance_m, span_m=None):
    """Return a Region covering (lat,lng), building if needed.

    For loops the tile is sized to the loop (~0.32·distance). For A→B, pass
    `span_m = |A B|` and `(lat,lng) = midpoint(A,B)` so the tile is sized/centred
    to cover BOTH endpoints (radius ≈ span/2 + margin)."""
    cell_lat = round(lat, 2)
    cell_lng = round(lng, 2)
    if span_m is not None:
        # Cover both endpoints (the far one sits ~span/2 from the midpoint).
        radius = max(2500.0, min(12000.0, 0.5 * span_m + 2500.0))
        key = f"{cell_lat}_{cell_lng}_r{int(math.ceil(radius / 1000.0))}_{_TILE_VERSION}"
    else:
        # Loop: the far polygon waypoint sits ~distance/π (~0.318·d) from start.
        radius = max(2500.0, min(9000.0, 0.32 * distance_m + 1500.0))
        dbucket = int(math.ceil(distance_m / 5000.0) * 5)
        key = f"{cell_lat}_{cell_lng}_{dbucket}_{_TILE_VERSION}"

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
