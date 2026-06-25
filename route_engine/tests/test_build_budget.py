"""Tests for the global per-hour on-demand build budget (world_store).

Drives the GCS ledger via the local disk path (graph_store._REGIONS_DIR → tmp),
mirroring test_reindex.py. No network.
"""
import json
import time

import pytest

from route_engine import graph_store, world_store


@pytest.fixture
def tmp_store(tmp_path, monkeypatch):
    monkeypatch.setattr(graph_store, "_REGIONS_DIR", str(tmp_path))
    monkeypatch.setattr(graph_store, "_BUCKET", "")          # force the disk path
    return tmp_path


def _ledger(tmp_path):
    p = tmp_path / "ondemand" / "_builds.json"
    return json.loads(p.read_text()) if p.exists() else None


def test_allows_under_cap(tmp_store, monkeypatch):
    monkeypatch.setattr(world_store, "_MAX_BUILDS_PER_HOUR", 3)
    world_store._reserve_build_slot()
    world_store._reserve_build_slot()
    assert len(_ledger(tmp_store)) == 2


def test_raises_at_cap(tmp_store, monkeypatch):
    monkeypatch.setattr(world_store, "_MAX_BUILDS_PER_HOUR", 2)
    world_store._reserve_build_slot()
    world_store._reserve_build_slot()
    with pytest.raises(world_store.BuildBusy):
        world_store._reserve_build_slot()


def test_stale_entries_are_dropped(tmp_store, monkeypatch):
    monkeypatch.setattr(world_store, "_MAX_BUILDS_PER_HOUR", 2)
    # Pre-seed two timestamps older than an hour — they must not count.
    old = time.time() - 7200.0
    (tmp_store / "ondemand").mkdir(parents=True, exist_ok=True)
    (tmp_store / "ondemand" / "_builds.json").write_text(json.dumps([old, old]))
    world_store._reserve_build_slot()       # should succeed (stale dropped)
    led = _ledger(tmp_store)
    assert len(led) == 1 and led[0] > old   # only the fresh entry remains


def test_zero_disables_cap(tmp_store, monkeypatch):
    monkeypatch.setattr(world_store, "_MAX_BUILDS_PER_HOUR", 0)
    for _ in range(50):
        world_store._reserve_build_slot()   # never raises
    assert _ledger(tmp_store) is None        # cap disabled → no ledger written
