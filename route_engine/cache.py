"""
In-memory cache of (primal graph, dual graph) per area.

Building the dual graph from a freshly downloaded osmnx network is the bulk of
a request's latency. Most requests cluster in the same neighbourhood, so we
cache by a coarse grid cell + distance bucket: repeated calls there skip both
the OSM fetch and the dual-graph build, leaving only the (fast) A* search.

The center is snapped to the grid and a margin is added to the radius so any
start inside the cell stays well within the cached graph.
"""
from __future__ import annotations

import threading
from collections import OrderedDict

from .dual_graph import build_dual_graph
from .network import fetch_walk_graph

_MAX_ENTRIES = 8
_CACHE: "OrderedDict[str, tuple]" = OrderedDict()
_LOCK = threading.Lock()


def _key(lat: float, lng: float, target_m: float, alpha: float, k: float) -> str:
    # round(_, 3) ~ 111 m grid; distance bucketed to the nearest km.
    return f"{round(lat, 3)}_{round(lng, 3)}_{int(round(target_m / 1000))}_{alpha}_{k}"


def get_area(lat, lng, target_m, alpha=500.0, k=3.0):
    """Return (G, DG, info) for the area, building+caching on a miss."""
    key = _key(lat, lng, target_m, alpha, k)
    with _LOCK:
        cached = _CACHE.get(key)
        if cached is not None:
            _CACHE.move_to_end(key)
            return cached

        # Snap the center to the grid so nearby starts share one cached graph.
        G = fetch_walk_graph(round(lat, 3), round(lng, 3), target_m)
        DG, info = build_dual_graph(G, alpha=alpha, k=k)
        _CACHE[key] = (G, DG, info)
        while len(_CACHE) > _MAX_ENTRIES:
            _CACHE.popitem(last=False)
        return G, DG, info
