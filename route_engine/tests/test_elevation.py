"""Tests for the Open-Meteo retry logic in elevation.add_elevation.

No real network: _fetch_elevations and time.sleep are monkeypatched. Verifies
that a transient failure is retried and the elevations still land on the
features, and that after the retry budget the route is returned gracefully
without elevation props (never raises).
"""
import pytest

from route_engine import elevation


@pytest.fixture
def no_wait(monkeypatch):
    """Make backoff sleeps instant."""
    monkeypatch.setattr(elevation.time, "sleep", lambda _s: None)


def _feature():
    return {
        "geometry": {"coordinates": [[34.780, 32.080], [34.790, 32.090]]},
        "properties": {},
    }


def test_attaches_rounded_profile(no_wait, monkeypatch):
    # The sampled series is what the client charts; it must survive on the
    # feature, rounded, alongside the totals.
    monkeypatch.setattr(elevation, "_fetch_elevations",
                        lambda latlngs, timeout: [10.4, 30.6])

    feats = elevation.add_elevation([_feature()])

    assert feats[0]["properties"]["elevation"] == [10, 31]


def test_profile_drops_nulls(no_wait, monkeypatch):
    # Open-Meteo can return null for a point; the client expects plain numbers.
    # Needs a 3-point route — the response is sliced per feature by sample count.
    three_pt = {
        "geometry": {"coordinates": [[34.78, 32.08], [34.79, 32.09], [34.80, 32.10]]},
        "properties": {},
    }
    monkeypatch.setattr(elevation, "_fetch_elevations",
                        lambda latlngs, timeout: [10.0, None, 25.0])

    feats = elevation.add_elevation([three_pt])

    assert feats[0]["properties"]["elevation"] == [10, 25]


def test_transient_failure_retries_then_succeeds(no_wait, monkeypatch):
    calls = {"n": 0}

    def flaky(latlngs, timeout):
        calls["n"] += 1
        if calls["n"] == 1:
            raise OSError("transient 5xx")
        return [10.0, 30.0]

    monkeypatch.setattr(elevation, "_fetch_elevations", flaky)

    feats = elevation.add_elevation([_feature()])

    assert calls["n"] == 2  # one failure, then a success
    assert feats[0]["properties"]["ascent_m"] == 20
    assert feats[0]["properties"]["descent_m"] == 0


def test_persistent_failure_is_graceful(no_wait, monkeypatch):
    calls = {"n": 0}

    def down(latlngs, timeout):
        calls["n"] += 1
        raise OSError("api down")

    monkeypatch.setattr(elevation, "_fetch_elevations", down)

    feats = elevation.add_elevation([_feature()])  # must not raise

    assert calls["n"] == elevation._ATTEMPTS  # every attempt was used
    assert "ascent_m" not in feats[0]["properties"]  # props left unset ("—")
