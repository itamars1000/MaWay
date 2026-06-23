"""Tests for the distance-correction step (_next_size) — pure function, no network.

The fix guarantees the size never undershoots when the last loop came up short
(so passes aren't wasted staying under target), while still shrinking toward
target from above. See router._next_size + the per-shape rescue loop.
"""
from route_engine.router import GROW_MIN, SIZE_AIM, _next_size


def test_aims_above_target_on_target_hit():
    # prev=None, actual exactly at target → multiplicative aims at SIZE_AIM·target.
    val = 1000.0
    nxt = _next_size(None, val, actual=5000.0, target_m=5000.0)
    assert abs(nxt - val * SIZE_AIM) < 1e-6


def test_short_grows_at_least_grow_min_multiplicative():
    # Just under target: the timid multiplicative step would barely move, so the
    # floor must kick in and grow by at least GROW_MIN.
    val = 1000.0
    nxt = _next_size(None, val, actual=4990.0, target_m=5000.0)
    assert nxt >= val * GROW_MIN - 1e-9


def test_short_never_shrinks_across_range():
    # For any under-target distance, the next size must grow (never shrink).
    val = 1000.0
    for actual in (1000.0, 2500.0, 4000.0, 4900.0, 4999.0):
        nxt = _next_size(None, val, actual, target_m=5000.0)
        assert nxt >= val * GROW_MIN - 1e-9


def test_short_grow_min_with_secant_history():
    # Secant branch (prev given) must also respect the never-undershoot floor.
    val = 1000.0
    nxt = _next_size((995.0, 4980.0), val, actual=4995.0, target_m=5000.0)
    assert nxt >= val * GROW_MIN - 1e-9


def test_over_target_shrinks_toward_target():
    # Above target → step shrinks (converge down toward target), no floor applied.
    val = 1000.0
    nxt = _next_size(None, val, actual=6500.0, target_m=5000.0)
    assert nxt < val          # must come back down
    assert abs(nxt - val * (SIZE_AIM * 5000.0) / 6500.0) < 1e-6


def test_absurd_secant_falls_back_to_multiplicative():
    # A secant that would jump outside [0.3·val, 3·val] is rejected; over target,
    # the result is the multiplicative step (no never-undershoot floor here).
    val = 1000.0
    # prev nearly equal in distance but far in size → huge secant slope.
    nxt = _next_size((100.0, 6499.0), val, actual=6500.0, target_m=5000.0)
    assert abs(nxt - val * (SIZE_AIM * 5000.0) / 6500.0) < 1e-6
