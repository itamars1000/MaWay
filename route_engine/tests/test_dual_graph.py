"""Lightweight unit tests for the kinematic turn penalty (no osmnx needed)."""
import math

from route_engine.dual_graph import turn_penalty
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
