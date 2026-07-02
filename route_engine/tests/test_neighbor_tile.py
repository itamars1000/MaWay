"""Tests for neighbouring-tile reuse on the on-demand path.

Tiles are keyed per ~1 km cell but built with a generous 7 km radius, so a
request one cell over from a built area must reuse the existing tile instead
of paying a full rebuild. No network/GCP: markers, tile loads and the Job
trigger are monkeypatched.
"""
import pytest

from route_engine import ondemand, world_store


NEIGHBOR_CELL = (51.51, -0.13)
NEIGHBOR_KEY = f"{NEIGHBOR_CELL[0]}_{NEIGHBOR_CELL[1]}_{ondemand._TILE_VERSION}"
NEIGHBOR_FILE = "ondemand/london_tile.pkl"
SENTINEL_REGION = object()

# ~1 km from the neighbour's cell centre, but in a different 0.01° cell.
POINT = (51.503, -0.121)


@pytest.fixture
def ready_neighbor(monkeypatch):
    """A ready tile marker at NEIGHBOR_CELL and nothing anywhere else."""
    monkeypatch.setattr(world_store, "_FILE_BY_KEY", {})

    def fake_marker(key):
        if key == NEIGHBOR_KEY:
            return {"status": "ready", "file": NEIGHBOR_FILE, "updated_at": 0}
        return None

    def fake_load(file):
        return SENTINEL_REGION if file == NEIGHBOR_FILE else None

    monkeypatch.setattr(world_store.graph_store, "read_marker", fake_marker)
    monkeypatch.setattr(world_store.graph_store, "load_ondemand_file", fake_load)


def test_adjacent_cell_reuses_ready_tile(ready_neighbor, monkeypatch):
    def boom(*a, **kw):
        raise AssertionError("must not build when a neighbour tile covers the point")

    monkeypatch.setattr(world_store, "_run_job", boom)
    monkeypatch.setattr(world_store, "_reserve_build_slot", boom)

    region = world_store.get_or_trigger(*POINT, distance_m=5000)

    assert region is SENTINEL_REGION
    # The requested cell now resolves straight to the neighbour's file.
    key, *_ = ondemand.tile_key(*POINT, 5000)
    assert world_store._FILE_BY_KEY[key] == NEIGHBOR_FILE


def test_long_loop_builds_its_own_cell(ready_neighbor, monkeypatch):
    """A ~21 km loop needs the full tile radius from its own cell — the
    neighbour's centre is too far to guarantee coverage, so it must build."""
    calls = {"reserved": 0, "ran": 0}
    monkeypatch.setattr(world_store, "_reserve_build_slot",
                        lambda: calls.__setitem__("reserved", 1))
    monkeypatch.setattr(world_store, "_run_job",
                        lambda *a, **kw: calls.__setitem__("ran", 1))
    monkeypatch.setattr(world_store.graph_store, "write_marker", lambda *a, **kw: None)

    with pytest.raises(world_store.Building):
        world_store.get_or_trigger(*POINT, distance_m=21000)

    assert calls == {"reserved": 1, "ran": 1}


def test_neighbor_keys_match_tile_key_format():
    """The scan must construct keys EXACTLY as tile_key formats them, including
    floats that round to fewer decimals (51.5, -0.1)."""
    key, *_ = ondemand.tile_key(51.504, -0.104, 5000)
    assert key == f"51.5_-0.1_{ondemand._TILE_VERSION}"
    # A cell reached by stepping 0.01 from a neighbour must format identically.
    stepped_lat = round(round(51.514, 2) - 0.01, 2)
    stepped_lng = round(round(-0.114, 2) + 0.01, 2)
    assert f"{stepped_lat}_{stepped_lng}_{ondemand._TILE_VERSION}" == key


def test_local_covering_cached_finds_neighbor(tmp_path, monkeypatch):
    """The local disk-cache variant: a loop tile one cell over is reused; an
    A→B tile and a far/too-long request are not."""
    monkeypatch.setattr(ondemand, "_CACHE_DIR", str(tmp_path))
    monkeypatch.setattr(ondemand, "Region", lambda data: SENTINEL_REGION)
    import pickle
    (tmp_path / f"51.51_-0.13_{ondemand._TILE_VERSION}.pkl").write_bytes(
        pickle.dumps({"fake": True}))
    (tmp_path / f"51.51_-0.13_r5_{ondemand._TILE_VERSION}.pkl").write_bytes(
        pickle.dumps({"fake": True}))  # A→B tile — must be ignored

    assert ondemand._covering_cached(*POINT, 5000) is SENTINEL_REGION
    assert ondemand._covering_cached(*POINT, 21000) is None      # too long
    assert ondemand._covering_cached(52.0, -0.13, 5000) is None  # too far
