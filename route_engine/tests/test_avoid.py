"""Tests for avoid-zone edge removal (campus/rail/industrial/farmland).

Offline — synthetic networkx graph + shapely geometries, no osmnx/network. Only
the core logic (_avoid_edges_from_geoms, _remove_dead_ends) is exercised; the OSM
feature fetch + PBF tag plumbing are covered end-to-end.
"""
import networkx as nx
from shapely.geometry import LineString, Polygon

from route_engine.builder import _avoid_edges_from_geoms, _remove_dead_ends


def _edge_graph(highway, v_lng, v_lat):
    """One directed edge 0→1; the 2-point edge midpoint is node 1 (v). Place v to
    land inside/outside a zone. (No `geometry` → _edge_latlng uses node x/y.)"""
    G = nx.MultiDiGraph()
    G.add_node(0, x=34.700, y=32.000)
    G.add_node(1, x=v_lng, y=v_lat)
    G.add_edge(0, 1, highway=highway, length=100.0)
    return G


# Shapely coords are (lng, lat). A campus square covering lng 34.80–34.81, lat 32.10–32.11.
_UNI = Polygon([(34.80, 32.10), (34.81, 32.10), (34.81, 32.11), (34.80, 32.11)])
# A horizontal railway line at lat 32.20.
_RAIL = LineString([(34.70, 32.20), (34.90, 32.20)])


def test_footway_inside_zone_is_avoided():
    G = _edge_graph("footway", v_lng=34.805, v_lat=32.105)  # midpoint inside _UNI
    assert (0, 1, 0) in _avoid_edges_from_geoms(G, [_UNI], [])


def test_through_road_inside_zone_is_kept():
    # A real street crossing the campus is NOT removed (connectivity).
    G = _edge_graph("residential", v_lng=34.805, v_lat=32.105)
    assert _avoid_edges_from_geoms(G, [_UNI], []) == set()


def test_service_alley_in_industrial_zone_is_avoided():
    G = _edge_graph("service", v_lng=34.805, v_lat=32.105)
    assert (0, 1, 0) in _avoid_edges_from_geoms(G, [_UNI], [])


def test_path_hugging_rail_is_avoided():
    # ~11 m off the line (0.0001°) → within the ~25 m buffer.
    G = _edge_graph("path", v_lng=34.80, v_lat=32.2001)
    assert (0, 1, 0) in _avoid_edges_from_geoms(G, [], [_RAIL])


def test_path_far_from_rail_is_kept():
    # ~550 m off the line → outside the buffer.
    G = _edge_graph("path", v_lng=34.80, v_lat=32.205)
    assert _avoid_edges_from_geoms(G, [], [_RAIL]) == set()


def test_edge_outside_all_zones_is_kept():
    G = _edge_graph("footway", v_lng=34.60, v_lat=31.90)
    assert _avoid_edges_from_geoms(G, [_UNI], [_RAIL]) == set()


def test_remove_dead_ends_drops_orphaned_spur():
    # Square loop 0-1-2-3-0 (all degree 2) + a spur node 4 hanging off 0.
    G = nx.MultiDiGraph()
    for i, (x, y) in enumerate([(0, 0), (0, 1), (1, 1), (1, 0)]):
        G.add_node(i, x=x, y=y)
    G.add_node(4, x=-1, y=0)
    for a, b in [(0, 1), (1, 2), (2, 3), (3, 0)]:
        G.add_edge(a, b, highway="residential", length=100.0)
        G.add_edge(b, a, highway="residential", length=100.0)
    G.add_edge(0, 4, highway="footway", length=100.0)
    G.add_edge(4, 0, highway="footway", length=100.0)
    _remove_dead_ends(G)
    assert 4 not in G.nodes
    assert {0, 1, 2, 3} <= set(G.nodes)
