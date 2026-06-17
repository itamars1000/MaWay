"""Tests for the geometry-based sharp-turn counter (router quality metric).

Polylines are built in real meters via geo.destination so the resampling and
fixed-window logic in sharp_turns_in_coords behaves as in production.
"""
from route_engine.geo import destination
from route_engine.geometry import sharp_turns_in_coords


def _polyline(legs, start=(32.08, 34.78), step=10.0):
    """Build a (lat,lng) polyline from [(bearing_deg, length_m), ...], sampling
    each leg every `step` meters so curves are represented by many points."""
    pts = [start]
    cur = start
    for brg, length in legs:
        d = 0.0
        while d < length - 1e-6:
            adv = min(step, length - d)
            cur = destination(cur[0], cur[1], brg, adv)
            pts.append(cur)
            d += adv
    return pts


def test_straight_line_has_no_turns():
    assert sharp_turns_in_coords(_polyline([(0.0, 400.0)])) == 0


def test_single_right_angle_is_one_turn():
    # North 200 m, then east 200 m — one clean 90° corner.
    assert sharp_turns_in_coords(_polyline([(0.0, 200.0), (90.0, 200.0)])) == 1


def test_three_corners():
    # North, east, north, east — three interior 90° corners.
    line = _polyline([(0.0, 150.0), (90.0, 150.0), (0.0, 150.0), (90.0, 150.0)])
    assert sharp_turns_in_coords(line) == 3


def test_gentle_arc_is_not_counted():
    # ~90° swept over ~760 m (5° every 40 m): a road that curves, not a turn.
    legs = [(float(b), 40.0) for b in range(0, 91, 5)]
    assert sharp_turns_in_coords(_polyline(legs)) <= 1


def test_rounded_corner_counts_once():
    # A 90° corner rounded across three 20 m steps (~60 m). The old per-step
    # test missed this (each step 30° < 45°); the windowed test catches it as
    # exactly one turn (not zero, not three).
    line = _polyline([(0.0, 200.0), (30.0, 20.0), (60.0, 20.0),
                      (90.0, 20.0), (90.0, 200.0)])
    assert sharp_turns_in_coords(line) == 1


def test_dense_points_at_corner_not_double_counted():
    # Same right angle, sampled very densely — the refractory gap must keep it
    # at a single counted turn rather than several.
    line = _polyline([(0.0, 200.0), (90.0, 200.0)], step=3.0)
    assert sharp_turns_in_coords(line) == 1


def test_short_polyline_is_safe():
    assert sharp_turns_in_coords([(32.08, 34.78), (32.081, 34.781)]) == 0
