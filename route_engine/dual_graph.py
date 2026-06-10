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

# Off-road / unpaved ways ("שטח") multiply the per-meter cost so dirt/field
# trails are avoided WITHOUT removing them (removal fragments the graph and
# forces extra turns). A segment is "off-road" if its surface is unpaved, OR
# it's a track/bridleway, OR it's a `path` that isn't explicitly paved (most
# dirt trails are untagged `highway=path`). Paved promenades/footways stay cheap.
_UNPAVED_SURFACES = {
    "unpaved", "ground", "dirt", "earth", "grass", "sand", "gravel",
    "fine_gravel", "compacted", "pebblestone", "mud", "woodchips", "rock",
}
_PAVED_SURFACES = {
    "asphalt", "paved", "concrete", "concrete:plates", "concrete:lanes",
    "paving_stones", "sett", "chipseal", "metal", "wood", "tartan",
}
_UNPAVED_FACTOR = 5.0


def is_offroad(highway, surface) -> bool:
    """True if running this segment means going off paved streets (dirt/field)."""
    hw = highway[0] if isinstance(highway, list) else highway
    s = surface[0] if isinstance(surface, list) else surface
    if s in _UNPAVED_SURFACES:
        return True
    if hw in ("track", "bridleway"):
        return True
    # An untagged or non-paved `path` is almost always a dirt trail.
    if hw == "path" and s not in _PAVED_SURFACES:
        return True
    return False

# Classes that are pleasant to run on (quiet / car-free). Used by the router's
# scorer to prefer nicer routes among those that meet the turn cap.
PLEASANT_CLASSES = {
    "footway", "path", "pedestrian", "cycleway",
    "living_street", "residential",
}
# Busy roads — pleasant only as a last resort.
BUSY_CLASSES = {"primary", "primary_link", "trunk", "trunk_link",
                "secondary", "secondary_link"}

# Cost (meters-equivalent) for cutting ACROSS a busy road at a junction —
# i.e. neither the incoming nor outgoing segment runs along the busy road
# itself. Kept well below a 90° turn (alpha=500) so avoiding a crossing never
# justifies a turny detour; it just tips the balance between otherwise-similar
# routes toward the one with fewer big-road crossings.
CROSSING_PENALTY = 120.0


def is_busy(highway) -> bool:
    """True if this segment runs along a busy (primary/secondary/trunk) road."""
    return _hw(highway) in BUSY_CLASSES


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
        offroad = is_offroad(data.get("highway"), data.get("surface"))
        # Per-meter cost: road class × off-road penalty. Dirt/field ways become
        # expensive so the loop prefers paved streets (but stays available).
        cost = length * class_factor(data.get("highway")) * (
            _UNPAVED_FACTOR if offroad else 1.0
        )
        info[(u, v, key)] = {
            "u": u,
            "v": v,
            "coords": coords,
            "length": length,
            # Class/off-road-weighted length used for routing cost.
            "cost_len": cost,
            # Whether this segment is off-road/unpaved (dirt/field trail).
            "offroad": offroad,
            # Whether this segment runs ALONG a busy road (used for crossings).
            "busy": is_busy(data.get("highway")),
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

    # Junctions that touch a busy road: passing THROUGH one of these on
    # non-busy segments means cutting across the big road (a "crossing").
    busy_nodes = set()
    for meta in info.values():
        if meta["busy"]:
            busy_nodes.add(meta["u"])
            busy_nodes.add(meta["v"])

    for nid, meta in info.items():
        b = meta["v"]  # we arrive at intersection b along this segment
        for out_nid in out_by_node[b]:
            out = info[out_nid]
            # Skip immediate reversals (going back to where we came from).
            if out["v"] == meta["u"]:
                continue
            delta = abs(wrap180(out["start_heading"] - meta["end_heading"]))
            weight = out["cost_len"] + turn_penalty(delta, alpha, k)
            # Crossing a busy road: the junction touches one, but we neither
            # arrive nor leave along it. Turning onto/off the road is free.
            crossing = b in busy_nodes and not meta["busy"] and not out["busy"]
            if crossing:
                weight += CROSSING_PENALTY
            DG.add_edge(nid, out_nid, weight=weight, turn_deg=delta,
                        crossing=crossing)

    return DG, info


def _polyline_length(coords) -> float:
    return sum(haversine(coords[i - 1], coords[i]) for i in range(1, len(coords)))
