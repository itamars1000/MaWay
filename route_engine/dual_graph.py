"""
Step 1b + 2: convert the primal street graph into a DUAL (line) graph and
attach kinematic turn penalties.

Primal graph:  nodes = intersections, edges = street segments.
Dual graph:    nodes = directed street segments, edges = a *turn* taken at the
               intersection shared by two consecutive segments.

Turn cost (the kinematic part):

    Weight(u -> v) = length(v) + alpha * (1 - cos(theta))**k

`theta` is the change of heading between arriving along segment `u` and leaving
along segment `v`. We give each directed segment a unit direction vector built
from its compass heading beta:

    d = (sin(beta), cos(beta))          # (east, north), |d| = 1

Because both `d_in` and `d_out` are unit vectors, their dot product **is** the
cosine of the angle between them:

    cos(theta) = d_in . d_out = sin(bi)sin(bo) + cos(bi)cos(bo) = cos(bo - bi)

So `(1 - cos(theta))` is 0 for a straight-through (theta=0), 1 for a 90° turn,
and 2 for a U-turn (theta=180). Raising to k=3 with alpha=500 makes right-angle
and sharper turns very expensive while leaving gentle curves almost free.
"""
from __future__ import annotations

import math
from collections import defaultdict

import networkx as nx

from .geo import bearing, haversine, wrap180


def turn_penalty(delta_deg: float, alpha: float = 500.0, k: float = 3.0) -> float:
    """Kinematic penalty for a heading change of `delta_deg` degrees."""
    cos_theta = math.cos(math.radians(delta_deg))
    return alpha * (1.0 - cos_theta) ** k


# Per-meter cost multiplier by road class. Lower = preferred. Both quiet,
# pleasant streets (footway/residential/pedestrian) AND continuous through-roads
# are kept cheap so the search generates *both* kinds of low-turn loops; the
# candidate scorer then prefers the pleasant one among those that meet the turn
# cap. Only the genuinely bad surfaces (parking aisles, stairs) are expensive.
# Routing cost is optimised purely for *finding low-turn loops* (continuous
# through-roads cheap, alleys/stairs expensive). "Pleasantness" is NOT mixed in
# here — it would pull routes onto turny park paths and break the ≤3 turns/km
# guarantee in maze cities. Instead the candidate scorer prefers pleasant routes
# only among those that already meet the turn cap (see router._score).
_CLASS_FACTOR = {
    "primary": 0.55, "primary_link": 0.6,
    "secondary": 0.6, "secondary_link": 0.65,
    "tertiary": 0.7, "tertiary_link": 0.75,
    "trunk": 0.7, "trunk_link": 0.75,
    "residential": 1.0, "unclassified": 1.0, "living_street": 1.0,
    "road": 1.0,
    "pedestrian": 1.1, "footway": 1.2, "path": 1.2, "cycleway": 1.0,
    "service": 2.0,          # parking aisles / alleys — strongly avoid
    "corridor": 3.0,
    "track": 5.0,            # dirt/field roads — avoid (the "through the fields" ways)
    "bridleway": 5.0,        # horse/dirt trails — avoid
    "steps": 6.0,            # stairs — avoid for running
}
_DEFAULT_CLASS_FACTOR = 1.1

# Unpaved surfaces multiply the per-meter cost so dirt/gravel ways are avoided
# without removing them (which would break connectivity and force extra turns).
_UNPAVED_SURFACES = {
    "unpaved", "ground", "dirt", "earth", "grass", "sand", "gravel",
    "fine_gravel", "compacted", "pebblestone", "mud", "woodchips", "rock",
}
_UNPAVED_FACTOR = 4.0


def _surface_factor(surface) -> float:
    s = surface[0] if isinstance(surface, list) else surface
    return _UNPAVED_FACTOR if s in _UNPAVED_SURFACES else 1.0

# Classes that are pleasant to run on (quiet / car-free). Used by the router's
# scorer to prefer nicer routes among those that meet the turn cap.
PLEASANT_CLASSES = {
    "footway", "path", "pedestrian", "cycleway",
    "living_street", "residential",
}
# Busy roads — pleasant only as a last resort.
BUSY_CLASSES = {"primary", "primary_link", "trunk", "trunk_link",
                "secondary", "secondary_link"}


def _hw(highway):
    return highway[0] if isinstance(highway, list) else highway


def class_factor(highway) -> float:
    return _CLASS_FACTOR.get(_hw(highway), _DEFAULT_CLASS_FACTOR)


def is_pleasant(highway, green: bool) -> bool:
    """True if running this segment is pleasant (quiet/green)."""
    hw = _hw(highway)
    if hw in BUSY_CLASSES:
        return green  # a busy road counts as pleasant only if it's in a park
    return green or hw in PLEASANT_CLASSES


def _edge_latlng(G, u, v, data):
    """Ordered list of (lat, lng) along edge u->v (uses geometry if present)."""
    if data.get("geometry") is not None:
        xs, ys = data["geometry"].xy  # shapely stores x=lng, y=lat
        coords = list(zip(ys, xs))
    else:
        coords = [
            (G.nodes[u]["y"], G.nodes[u]["x"]),
            (G.nodes[v]["y"], G.nodes[v]["x"]),
        ]
    # Simplified geometries may be stored either direction; orient u -> v.
    u_pt = (G.nodes[u]["y"], G.nodes[u]["x"])
    if haversine(coords[0], u_pt) > haversine(coords[-1], u_pt):
        coords.reverse()
    return coords


def build_dual_graph(G, alpha: float = 500.0, k: float = 3.0,
                     green_keys=None, scenic_keys=None):
    """
    Build the dual graph.

    `green_keys` is an optional set of primal edge keys (u, v, key) that lie in
    a park/green area; those are marked pleasant. `scenic_keys` is an optional
    set of edge keys near water (sea/river/lake) or a park/beach; those are
    marked scenic. Both flags affect *scoring only* (see router._score), never
    the routing weights, so the ≤3 turns/km guarantee is unaffected.

    Returns (DG, info) where:
      - DG is a networkx.DiGraph whose nodes are (u, v, key) directed segments
        and whose edges carry `weight` (length+turn penalty) and `turn_deg`.
      - info[(u, v, key)] = dict(u, v, coords, length, cost_len, pleasant,
        scenic, start_heading, end_heading) for routing + scoring + geometry.
    """
    green_keys = green_keys or set()
    scenic_keys = scenic_keys or set()
    info: dict = {}
    for u, v, key, data in G.edges(keys=True, data=True):
        coords = _edge_latlng(G, u, v, data)
        length = float(data.get("length") or _polyline_length(coords))
        green = (u, v, key) in green_keys
        # Per-meter cost: road class × surface (paved vs dirt). Off-road/unpaved
        # ways become expensive so the loop prefers paved streets.
        cost = length * class_factor(data.get("highway")) * _surface_factor(
            data.get("surface")
        )
        info[(u, v, key)] = {
            "u": u,
            "v": v,
            "coords": coords,
            "length": length,
            # Class/green-weighted length used for routing cost.
            "cost_len": cost,
            # Whether this segment is pleasant to run (quiet / green).
            "pleasant": is_pleasant(data.get("highway"), green),
            # Whether this segment is scenic (near water / a park / the beach).
            "scenic": (u, v, key) in scenic_keys,
            # Heading just after leaving u, and just before arriving at v —
            # these are the tangents that actually meet at the intersection.
            "start_heading": bearing(coords[0], coords[1]),
            "end_heading": bearing(coords[-2], coords[-1]),
        }

    DG = nx.DiGraph()
    for nid, meta in info.items():
        DG.add_node(nid, **meta)

    # Index outgoing segments by the node they start at.
    out_by_node = defaultdict(list)
    for nid, meta in info.items():
        out_by_node[meta["u"]].append(nid)

    for nid, meta in info.items():
        b = meta["v"]  # we arrive at intersection b along this segment
        for out_nid in out_by_node[b]:
            out = info[out_nid]
            # Skip immediate reversals (going back to where we came from).
            if out["v"] == meta["u"]:
                continue
            delta = abs(wrap180(out["start_heading"] - meta["end_heading"]))
            weight = out["cost_len"] + turn_penalty(delta, alpha, k)
            DG.add_edge(nid, out_nid, weight=weight, turn_deg=delta)

    return DG, info


def _polyline_length(coords) -> float:
    return sum(haversine(coords[i - 1], coords[i]) for i in range(1, len(coords)))
