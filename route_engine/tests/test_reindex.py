"""Tests for graph_store.reindex() — self-healing index.json on the disk path.

reindex() drops index entries whose .pkl is missing, rewrites index.json, and
reloads. No GCS / network needed (local _REGIONS_DIR path).
"""
import json
import pickle

from route_engine import graph_store


def _write_index(tmp_path, entries):
    (tmp_path / "index.json").write_text(
        json.dumps(entries, ensure_ascii=False), encoding="utf-8"
    )


def _touch_pkl(tmp_path, name):
    # A minimal non-empty file; reindex only checks existence, never loads it.
    (tmp_path / name).write_bytes(pickle.dumps({"stub": True}))


def test_reindex_drops_missing_pkl(tmp_path):
    _touch_pkl(tmp_path, "tel_aviv.pkl")  # present
    _write_index(tmp_path, [
        {"name": "Tel Aviv", "file": "tel_aviv.pkl", "bbox": [0, 0, 1, 1]},
        {"name": "Be'er Sheva", "file": "beer_sheva.pkl", "bbox": [0, 0, 1, 1]},
    ])
    graph_store.load_all(str(tmp_path))  # point the module at the temp dir

    result = graph_store.reindex()

    assert result["kept"] == 1
    assert result["dropped"] == ["Be'er Sheva"]
    # index.json was rewritten without the dead entry
    on_disk = json.loads((tmp_path / "index.json").read_text(encoding="utf-8"))
    assert [e["file"] for e in on_disk] == ["tel_aviv.pkl"]
    # in-memory index reloaded to match
    assert [m.file for m in graph_store.regions()] == ["tel_aviv.pkl"]


def test_reindex_noop_when_all_present(tmp_path):
    _touch_pkl(tmp_path, "tel_aviv.pkl")
    _write_index(tmp_path, [
        {"name": "Tel Aviv", "file": "tel_aviv.pkl", "bbox": [0, 0, 1, 1]},
    ])
    graph_store.load_all(str(tmp_path))

    result = graph_store.reindex()

    assert result == {"kept": 1, "dropped": []}


def test_reindex_handles_missing_index(tmp_path):
    graph_store.load_all(str(tmp_path))  # no index.json at all
    assert graph_store.reindex() == {"kept": 0, "dropped": []}
