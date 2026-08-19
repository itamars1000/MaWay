"""Tests for the Open-Meteo retry logic and coordinate cache in add_elevation.

No real network: _fetch_elevations and time.sleep are monkeypatched. Verifies
that a transient failure is retried and the elevations still land on the
features, that after the retry budget the route is returned gracefully without
elevation props (never raises), and that cached coordinates are not requested
again.
"""
import pytest

from route_engine import elevation


@pytest.fixture(autouse=True)
def clear_cache():
    """The coordinate cache lives at module scope and would otherwise leak
    between tests — a cached point makes the next test's fetch never happen."""
    elevation._cache.clear()
    yield
    elevation._cache.clear()


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


# --- coordinate cache -------------------------------------------------------
# Terrain height never changes, so a coordinate is fetched once and reused. The
# point of the cache is removing the Open-Meteo round-trip from the response, so
# these assert on *whether a request happened*, not just on the numbers.


def _recorder(values):
    """A _fetch_elevations stub that records every requested batch. `values` is
    either a fixed list or a callable taking the batch."""
    calls = []

    def fetch(latlngs, timeout):
        calls.append(list(latlngs))
        return values(latlngs) if callable(values) else values[: len(latlngs)]

    return fetch, calls


def test_second_identical_route_makes_no_request(no_wait, monkeypatch):
    fetch, calls = _recorder([10.0, 30.0])
    monkeypatch.setattr(elevation, "_fetch_elevations", fetch)

    first = elevation.add_elevation([_feature()])
    second = elevation.add_elevation([_feature()])

    assert len(calls) == 1, "the warm cache must not hit the API again"
    assert second[0]["properties"]["ascent_m"] == first[0]["properties"]["ascent_m"]
    assert second[0]["properties"]["elevation"] == [10, 30]


def test_only_missing_coordinates_are_requested(no_wait, monkeypatch):
    fetch, calls = _recorder(lambda latlngs: [10.0] * len(latlngs))
    monkeypatch.setattr(elevation, "_fetch_elevations", fetch)

    elevation.add_elevation([_feature()])  # warms 32.080/34.780 + 32.090/34.790
    shifted = {
        "geometry": {"coordinates": [[34.790, 32.090], [34.800, 32.100]]},
        "properties": {},
    }
    elevation.add_elevation([shifted])

    assert len(calls) == 2
    # Only the genuinely new point goes out in the second batch.
    assert calls[1] == [(32.1, 34.8)]


def test_repeated_point_within_one_batch_is_requested_once(no_wait, monkeypatch):
    fetch, calls = _recorder(lambda latlngs: [10.0] * len(latlngs))
    monkeypatch.setattr(elevation, "_fetch_elevations", fetch)

    # Two candidates sharing a street: the shared endpoint must not be sent twice.
    a = {"geometry": {"coordinates": [[34.780, 32.080], [34.790, 32.090]]},
         "properties": {}}
    b = {"geometry": {"coordinates": [[34.790, 32.090], [34.781, 32.081]]},
         "properties": {}}

    elevation.add_elevation([a, b])

    assert len(calls[0]) == len(set(calls[0])) == 3  # 4 points, one shared


def test_nearby_points_share_a_grid_cell(no_wait, monkeypatch):
    fetch, calls = _recorder(lambda latlngs: [10.0] * len(latlngs))
    monkeypatch.setattr(elevation, "_fetch_elevations", fetch)

    elevation.add_elevation([_feature()])
    # ~1 m away — inside the ~11 m grid, so it resolves to the same cell.
    nudged = {
        "geometry": {"coordinates": [[34.78000_4, 32.08000_4], [34.790, 32.090]]},
        "properties": {},
    }
    elevation.add_elevation([nudged])

    assert len(calls) == 1


def test_failed_fetch_does_not_poison_the_cache(no_wait, monkeypatch):
    monkeypatch.setattr(elevation, "_fetch_elevations",
                        lambda latlngs, timeout: (_ for _ in ()).throw(OSError("down")))
    feats = elevation.add_elevation([_feature()])
    assert "ascent_m" not in feats[0]["properties"]
    assert elevation.cache_stats()["size"] == 0

    # A later working response must still be able to fill those coordinates.
    monkeypatch.setattr(elevation, "_fetch_elevations",
                        lambda latlngs, timeout: [10.0, 30.0])
    feats = elevation.add_elevation([_feature()])
    assert feats[0]["properties"]["ascent_m"] == 20


def test_short_response_is_treated_as_a_failure(no_wait, monkeypatch):
    # A truncated list would misalign every point after the gap and cache wrong
    # heights forever — the worst possible outcome, so it must be rejected.
    monkeypatch.setattr(elevation, "_fetch_elevations",
                        lambda latlngs, timeout: [10.0])

    feats = elevation.add_elevation([_feature()])

    assert "ascent_m" not in feats[0]["properties"]
    assert elevation.cache_stats()["size"] == 0


def test_null_elevation_is_cached_and_not_refetched(no_wait, monkeypatch):
    # A point the DEM has no data for should not be retried on every request.
    fetch, calls = _recorder(lambda latlngs: [None] * len(latlngs))
    monkeypatch.setattr(elevation, "_fetch_elevations", fetch)

    elevation.add_elevation([_feature()])
    elevation.add_elevation([_feature()])

    assert len(calls) == 1


def test_cache_evicts_least_recently_used_over_the_cap(no_wait, monkeypatch):
    monkeypatch.setattr(elevation, "_CACHE_MAX", 3)
    elevation._cache_put({("a",): 1.0, ("b",): 2.0, ("c",): 3.0})
    elevation._cache_get([("a",)])          # touch 'a' so 'b' is now the oldest
    elevation._cache_put({("d",): 4.0})

    assert set(elevation._cache) == {("a",), ("c",), ("d",)}
