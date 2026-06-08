"""Step 1a: fetch the walkable street network around a point with osmnx."""
from __future__ import annotations

import osmnx as ox

from .geo import haversine

# Cache OSM downloads so repeated runs near the same point are fast.
ox.settings.use_cache = True
ox.settings.log_console = False


def fetch_walk_graph(lat: float, lng: float, target_m: float):
    """
    Download the walkable network around (lat, lng).

    The radius is sized from the target distance. A loop of perimeter `target_m`
    reaches at most ~target_m/π ≈ 0.32·target_m from the start (the far side of
    the ideal circle); 0.45·target_m (min 500 m) adds margin for street detours
    while keeping the download/graph — and thus latency — as small as possible.

    Returns an osmnx MultiDiGraph (edges carry `length` in meters, and a
    `geometry` LineString for non-straight, simplified edges).
    """
    radius = max(500.0, 0.45 * target_m)
    G = ox.graph_from_point(
        (lat, lng),
        dist=radius,
        network_type="walk",
        simplify=True,
    )
    return G


def nearest_node(G, lat: float, lng: float):
    """
    Nearest graph node id to (lat, lng).

    Computed directly with haversine to avoid osmnx's scikit-learn dependency
    (and projection requirement). The graph is small enough that a linear scan
    is instant.
    """
    return min(
        G.nodes,
        key=lambda n: haversine((lat, lng), (G.nodes[n]["y"], G.nodes[n]["x"])),
    )
