"""Lightweight unit tests for the kinematic turn penalty (no osmnx needed)."""
import math

import networkx as nx

from route_engine.builder import prune
from route_engine.dual_graph import (
    is_offroad, is_rough_paved, is_sidewalked, turn_penalty,
)
from route_engine.geo import bearing, destination, haversine, wrap180


def test_turn_penalty_straight_is_free():
    assert turn_penalty(0, alpha=500, k=3) == 0.0


def test_turn_penalty_right_angle_equals_alpha():
    # cos(90°) = 0 -> (1 - 0)**3 * alpha = alpha
    assert math.isclose(turn_penalty(90, alpha=500, k=3), 500.0, rel_tol=1e-9)


def test_turn_penalty_uturn_is_alpha_times_8():
    # cos(180°) = -1 -> (1 - (-1))**3 * alpha = 8 * alpha
    assert math.isclose(turn_penalty(180, alpha=500, k=3), 4000.0, rel_tol=1e-9)


def test_turn_penalty_monotonic_in_angle():
    vals = [turn_penalty(d) for d in (0, 30, 60, 90, 120, 150, 180)]
    assert all(b >= a for a, b in zip(vals, vals[1:]))


def test_geo_roundtrip_bearing_and_destination():
    start = (32.0810, 34.7800)
    east = destination(start[0], start[1], 90.0, 1000.0)
    assert math.isclose(bearing(start, east), 90.0, abs_tol=0.5)
    assert math.isclose(haversine(start, east), 1000.0, rel_tol=1e-3)


def test_wrap180():
    assert wrap180(190) == -170
    assert wrap180(-190) == 170
    assert wrap180(45) == 45


# ---------------------------------------------------------------------------
# is_rough_paved
# ---------------------------------------------------------------------------

def test_is_rough_paved_sett():
    assert is_rough_paved("residential", "sett") is True


def test_is_rough_paved_paving_stones():
    assert is_rough_paved("pedestrian", "paving_stones") is True


def test_is_rough_paved_asphalt_is_false():
    assert is_rough_paved("residential", "asphalt") is False


def test_is_rough_paved_none_surface_is_false():
    assert is_rough_paved("residential", None) is False


def test_rough_no_double_penalty_with_offroad():
    # gravel is already caught as offroad → must NOT also be rough_paved
    assert is_offroad("residential", "gravel") is True
    assert is_rough_paved("residential", "gravel") is False


# ---------------------------------------------------------------------------
# is_sidewalked
# ---------------------------------------------------------------------------

def test_is_sidewalked_both():
    assert is_sidewalked("primary", "both", None) is True


def test_is_sidewalked_right():
    assert is_sidewalked("secondary", "right", None) is True


def test_is_sidewalked_foot_designated():
    assert is_sidewalked("footway", None, "designated") is True


def test_is_sidewalked_foot_official():
    assert is_sidewalked("path", None, "official") is True


def test_is_sidewalked_negative_no_tags():
    assert is_sidewalked("residential", None, None) is False


def test_is_sidewalked_foot_permissive_is_false():
    # permissive access ≠ designated infrastructure
    assert is_sidewalked("path", None, "permissive") is False


# ---------------------------------------------------------------------------
# prune — foot access restriction
# ---------------------------------------------------------------------------

def _tiny_graph():
    """Three nodes A-B-C connected in a line (so B is not a dead-end)."""
    G = nx.MultiDiGraph()
    G.add_node(0, x=34.78, y=32.08)
    G.add_node(1, x=34.79, y=32.08)
    G.add_node(2, x=34.80, y=32.08)
    return G


def test_prune_removes_foot_no():
    G = _tiny_graph()
    G.add_edge(0, 1, 0, highway="residential", length=100, foot="no")
    G.add_edge(1, 2, 0, highway="residential", length=100)
    G.add_edge(2, 1, 0, highway="residential", length=100)
    G.add_edge(1, 0, 0, highway="residential", length=100)
    prune(G)
    assert not G.has_edge(0, 1)


def test_prune_keeps_foot_yes_on_access_no():
    # Use a square loop 0↔1↔2↔3↔0 so no node ends up a dead-end.
    # The 0→1 edge has access=no but foot=yes — must survive foot-restriction pruning.
    G = nx.MultiDiGraph()
    for i in range(4):
        G.add_node(i, x=34.78 + i * 0.01, y=32.08)
    for u, v, extra in [
        (0, 1, {"access": "no", "foot": "yes"}),
        (1, 0, {}), (1, 2, {}), (2, 1, {}),
        (2, 3, {}), (3, 2, {}), (3, 0, {}), (0, 3, {}),
    ]:
        G.add_edge(u, v, 0, highway="residential", length=100, **extra)
    prune(G)
    assert G.has_edge(0, 1)


def test_prune_removes_access_no_without_foot_override():
    G = _tiny_graph()
    G.add_edge(0, 1, 0, highway="residential", length=100, access="no")
    G.add_edge(1, 2, 0, highway="residential", length=100)
    G.add_edge(2, 1, 0, highway="residential", length=100)
    G.add_edge(1, 0, 0, highway="residential", length=100)
    prune(G)
    assert not G.has_edge(0, 1)
