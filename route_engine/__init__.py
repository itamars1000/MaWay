"""
route_engine — generate running loops with few sharp turns.

Pipeline:
  1. fetch walk network (osmnx)            -> network.py
  2. dual graph + kinematic turn penalty   -> dual_graph.py
  3. ideal-circle vector field + 2-phase A* -> heuristic.py / search.py
  4. GeoJSON LineString                     -> geometry.py
"""
from __future__ import annotations

import random

from .geometry import to_geojson_feature
from .heuristic import VectorField, make_heuristic
from .search import two_phase_loop

__all__ = ["generate_loop"]


def generate_loop(
    lat: float,
    lng: float,
    target_distance_m: float,
    *,
    seed: int | None = None,
    alpha: float = 500.0,
    k: float = 3.0,
    beta: float = 120.0,
    primary_bearing: float | None = None,
):
    """
    Generate a closed running loop of approximately `target_distance_m` meters
    that prefers straight, continuous streets (few sharp turns).

    Returns a GeoJSON Feature (dict) with a LineString geometry and
    distance / sharp-turn properties. Distance is approximate (heuristic search).
    """
    # Imported lazily so the lightweight unit tests don't require osmnx.
    from .cache import get_area
    from .network import nearest_node

    rng = random.Random(seed)
    phi0 = primary_bearing if primary_bearing is not None else rng.uniform(0, 360)

    # Cached per area: repeated requests nearby skip the fetch + dual-graph build.
    G, DG, info = get_area(lat, lng, target_distance_m, alpha=alpha, k=k)

    start_node = nearest_node(G, lat, lng)
    start_pt = (G.nodes[start_node]["y"], G.nodes[start_node]["x"])
    field = VectorField(start_pt, target_distance_m, phi0)

    dual_path = two_phase_loop(
        DG,
        info,
        start_node,
        field,
        target_distance_m,
        h_factory=lambda goal: make_heuristic(info, field, goal, beta=beta),
    )
    return to_geojson_feature(info, DG, dual_path)
