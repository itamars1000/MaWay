"""Tests for the in-memory per-IP rate limiter (no network)."""
from types import SimpleNamespace

from route_engine.ratelimit import Limiter, _client_ip


def test_allows_up_to_max_then_blocks():
    lim = Limiter(max_per_min=3)
    t = 1000.0
    assert all(lim.check("1.1.1.1", now=t + i * 0.1) for i in range(3))  # 3 allowed
    assert lim.check("1.1.1.1", now=t + 0.4) is False                    # 4th blocked


def test_window_slides_and_resets():
    lim = Limiter(max_per_min=2)
    assert lim.check("ip", now=1000.0) is True
    assert lim.check("ip", now=1000.5) is True
    assert lim.check("ip", now=1001.0) is False     # within the 60 s window
    # Past the window → the old hits expire and new ones are allowed.
    assert lim.check("ip", now=1062.0) is True


def test_distinct_ips_are_independent():
    lim = Limiter(max_per_min=1)
    assert lim.check("a", now=1000.0) is True
    assert lim.check("b", now=1000.0) is True       # different IP, own budget
    assert lim.check("a", now=1000.1) is False


def test_zero_disables_limiting():
    lim = Limiter(max_per_min=0)
    assert all(lim.check("x", now=1000.0 + i) for i in range(100))


def test_client_ip_prefers_forwarded_for():
    req = SimpleNamespace(
        headers={"x-forwarded-for": "203.0.113.7, 10.0.0.1"},
        client=SimpleNamespace(host="10.0.0.1"),
    )
    assert _client_ip(req) == "203.0.113.7"


def test_client_ip_falls_back_to_peer():
    req = SimpleNamespace(headers={}, client=SimpleNamespace(host="198.51.100.2"))
    assert _client_ip(req) == "198.51.100.2"
