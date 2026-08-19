"""Tests for the shared bucket cache of Geofabrik country extracts.

Offline: GCS and Geofabrik are both faked. Nothing is downloaded.

Why this exists: each Cloud Run Job execution gets a fresh container, so the
on-disk cache never survived and every on-demand build re-downloaded the whole
country — 113 MB for Israel even for a city already built ten times, 399 MB for
South Africa. Measured on 2026-08-19: builds took 1.2-2.4 min in Israel, and a
Cape Town user waited 13 minutes and left without a route.

The cache is an optimisation, never a source of truth: every failure path here
must fall through to Geofabrik rather than break the build.
"""
import time
import types

import pytest

from route_engine import extracts


class FakeBlob:
    def __init__(self, exists=True, age_days=1.0, fail_on=None):
        self._exists = exists
        self.updated = types.SimpleNamespace(
            timestamp=lambda: time.time() - age_days * 86400
        )
        self.fail_on = fail_on or set()
        self.downloaded_to = None
        self.uploaded_from = None

    def exists(self):
        if "exists" in self.fail_on:
            raise RuntimeError("GCS down")
        return self._exists

    def reload(self):
        if "reload" in self.fail_on:
            raise RuntimeError("GCS down")

    def download_to_filename(self, path):
        if "download" in self.fail_on:
            raise RuntimeError("GCS down")
        self.downloaded_to = path
        with open(path, "wb") as f:
            f.write(b"cached-pbf")

    def upload_from_filename(self, path):
        if "upload" in self.fail_on:
            raise RuntimeError("GCS down")
        self.uploaded_from = path


@pytest.fixture
def bucket(monkeypatch, tmp_path):
    """Point the extract cache at a temp dir and a fake bucket."""
    monkeypatch.setattr(extracts, "_CACHE", str(tmp_path))
    from route_engine import graph_store

    monkeypatch.setattr(graph_store, "_BUCKET", "maway-regions")
    holder = {"blob": FakeBlob(), "keys": []}

    def fake_gcs():
        return types.SimpleNamespace(blob=lambda key: (holder["keys"].append(key),
                                                       holder["blob"])[1])

    monkeypatch.setattr(graph_store, "_gcs", fake_gcs)
    return holder


@pytest.fixture
def no_download(monkeypatch):
    """Fail loudly if anything reaches Geofabrik."""
    def boom(*a, **k):
        raise AssertionError("should not have downloaded from Geofabrik")

    monkeypatch.setattr(extracts.requests, "get", boom)


def test_uses_the_cached_copy_instead_of_downloading(bucket, no_download):
    path = extracts.ensure_extract("israel-and-palestine", "https://example/x.pbf")

    assert open(path, "rb").read() == b"cached-pbf"
    assert bucket["keys"] == ["extracts/israel-and-palestine.osm.pbf"]


def test_slashes_in_the_id_become_a_flat_key(bucket, no_download):
    extracts.ensure_extract("africa/south-africa", "https://example/x.pbf")

    assert bucket["keys"] == ["extracts/africa_south-africa.osm.pbf"]


def test_a_stale_copy_is_refreshed(bucket, monkeypatch, tmp_path):
    # OSM changes daily; a cache that never expires means the map never improves.
    bucket["blob"] = FakeBlob(age_days=45)
    calls = _stub_download(monkeypatch)

    extracts.ensure_extract("greece", "https://example/greece.pbf")

    assert calls["n"] == 1, "a 45-day-old copy must be re-downloaded"


def test_a_fresh_copy_within_the_age_limit_is_kept(bucket, no_download):
    bucket["blob"] = FakeBlob(age_days=29)

    extracts.ensure_extract("greece", "https://example/greece.pbf")  # must not download


def test_a_new_download_is_uploaded_for_the_next_build(bucket, monkeypatch):
    bucket["blob"] = FakeBlob(exists=False)
    _stub_download(monkeypatch)

    extracts.ensure_extract("south-africa", "https://example/sa.pbf")

    assert bucket["blob"].uploaded_from is not None


@pytest.mark.parametrize("failure", ["exists", "reload", "download"])
def test_a_broken_cache_falls_through_to_geofabrik(bucket, monkeypatch, failure):
    bucket["blob"] = FakeBlob(fail_on={failure})
    calls = _stub_download(monkeypatch)

    path = extracts.ensure_extract("israel-and-palestine", "https://example/x.pbf")

    assert calls["n"] == 1
    assert open(path, "rb").read() == b"fresh-pbf"


def test_a_failed_upload_does_not_fail_the_build(bucket, monkeypatch):
    bucket["blob"] = FakeBlob(exists=False, fail_on={"upload"})
    _stub_download(monkeypatch)

    path = extracts.ensure_extract("greece", "https://example/greece.pbf")

    assert open(path, "rb").read() == b"fresh-pbf"  # build proceeds regardless


def test_local_copy_wins_over_the_bucket(bucket, monkeypatch, no_download):
    import os

    path = os.path.join(extracts._CACHE, "greece.osm.pbf")
    os.makedirs(extracts._CACHE, exist_ok=True)
    with open(path, "wb") as f:
        f.write(b"local-pbf")

    got = extracts.ensure_extract("greece", "https://example/greece.pbf")

    assert open(got, "rb").read() == b"local-pbf"
    assert bucket["keys"] == [], "no bucket lookup when it is already on disk"


def test_without_a_bucket_nothing_touches_storage(monkeypatch, tmp_path):
    # Local dev has no bucket configured; behaviour must be exactly as before.
    monkeypatch.setattr(extracts, "_CACHE", str(tmp_path))
    from route_engine import graph_store

    monkeypatch.setattr(graph_store, "_BUCKET", "")
    monkeypatch.setattr(graph_store, "_gcs", lambda: pytest.fail("no bucket configured"))
    _stub_download(monkeypatch)

    path = extracts.ensure_extract("greece", "https://example/greece.pbf")

    assert open(path, "rb").read() == b"fresh-pbf"


def _stub_download(monkeypatch):
    """Replace the Geofabrik download with a 1-chunk fake; counts calls."""
    calls = {"n": 0}

    class FakeResp:
        status_code = 200

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def raise_for_status(self):
            pass

        def iter_content(self, chunk_size=None):
            yield b"fresh-pbf"

    def fake_get(url, **kw):
        calls["n"] += 1
        return FakeResp()

    monkeypatch.setattr(extracts.requests, "get", fake_get)
    return calls
