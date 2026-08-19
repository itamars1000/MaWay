"""Tests for graph_store.audit — the coverage check behind /health's `degraded`.

Offline: the index is faked in memory and `_exists` is monkeypatched, so no GCS
and no pickles are touched.

Regression context: on 2026-08-19 the region pickles were missing from the
bucket while index.json still listed all 11 cities. Regions load lazily, so
nothing noticed until a user asked for one of those cities — meanwhile /health
reported 11 regions and looked perfectly healthy for an hour. These tests pin
down that the audit reports what storage actually has, not what the index says.
"""
import pytest

from route_engine import graph_store


@pytest.fixture(autouse=True)
def clean_index(monkeypatch):
    """Fake index + a fresh audit cache for every test."""
    idx = [
        graph_store.RegionMeta("Tel Aviv, Israel", "tel_aviv.pkl", [32.0, 34.7, 32.2, 34.9]),
        graph_store.RegionMeta("Bat Yam, Israel", "bat_yam.pkl", [32.0, 34.7, 32.1, 34.8]),
        graph_store.RegionMeta("Herzliya, Israel", "herzliya.pkl", [32.1, 34.8, 32.2, 34.9]),
    ]
    monkeypatch.setattr(graph_store, "_INDEX", idx)
    monkeypatch.setattr(graph_store, "_audit_cache", {"at": 0.0, "result": None})
    yield


def test_all_present_is_not_degraded(monkeypatch):
    monkeypatch.setattr(graph_store, "_exists", lambda name: True)

    result = graph_store.audit(force=True)

    assert result["indexed"] == 3
    assert result["available"] == 3
    assert result["missing"] == []
    assert result["error"] is None


def test_reports_the_cities_whose_pickle_is_gone(monkeypatch):
    # Exactly the 2026-08-19 failure: the index still lists them, storage doesn't.
    monkeypatch.setattr(graph_store, "_exists", lambda name: name == "herzliya.pkl")

    result = graph_store.audit(force=True)

    assert result["available"] == 1
    assert sorted(result["missing"]) == ["Bat Yam, Israel", "Tel Aviv, Israel"]


def test_reports_names_not_filenames(monkeypatch):
    # `missing` goes into an alert someone reads at 2am — city names, not paths.
    monkeypatch.setattr(graph_store, "_exists", lambda name: False)

    assert graph_store.audit(force=True)["missing"] == [
        "Tel Aviv, Israel",
        "Bat Yam, Israel",
        "Herzliya, Israel",
    ]


def test_an_empty_index_is_not_degraded(monkeypatch):
    # No precomputed coverage at all is a valid configuration (everything
    # on-demand), not a fault to page someone about.
    monkeypatch.setattr(graph_store, "_INDEX", [])
    monkeypatch.setattr(graph_store, "_exists", lambda name: False)

    result = graph_store.audit(force=True)

    assert result == {
        "indexed": 0,
        "available": 0,
        "missing": [],
        "error": None,
        "checked_at": result["checked_at"],
    }


def test_storage_failure_is_reported_not_raised(monkeypatch):
    def boom(name):
        raise RuntimeError("GCS unreachable")

    monkeypatch.setattr(graph_store, "_exists", boom)

    result = graph_store.audit(force=True)  # must not raise — /health depends on it

    assert result["error"] and "GCS unreachable" in result["error"]


def test_result_is_cached_between_calls(monkeypatch):
    # One HEAD per region is too expensive to repeat on every /health.
    calls = {"n": 0}

    def counting(name):
        calls["n"] += 1
        return True

    monkeypatch.setattr(graph_store, "_exists", counting)

    graph_store.audit(force=True)
    graph_store.audit()
    graph_store.audit()

    assert calls["n"] == 3  # three regions, checked once


def test_cache_expires_after_the_ttl(monkeypatch):
    calls = {"n": 0}

    def counting(name):
        calls["n"] += 1
        return True

    monkeypatch.setattr(graph_store, "_exists", counting)
    monkeypatch.setattr(graph_store, "_AUDIT_TTL_S", 60)

    graph_store.audit(force=True)
    # Pretend the cached result is older than the TTL.
    graph_store._audit_cache["at"] -= 61
    graph_store.audit()

    assert calls["n"] == 6  # re-checked all three


def test_force_bypasses_the_cache(monkeypatch):
    monkeypatch.setattr(graph_store, "_exists", lambda name: True)
    graph_store.audit(force=True)

    # Storage changed underneath us; only force sees it before the TTL.
    monkeypatch.setattr(graph_store, "_exists", lambda name: False)

    assert graph_store.audit()["missing"] == []
    assert len(graph_store.audit(force=True)["missing"]) == 3
