"""Tests for the Geofabrik download retry logic in extracts.ensure_extract.

No real network: requests.get and time.sleep are monkeypatched. Verifies that
transient CDN errors (502/503/504) are retried, that a success after a few
failures still produces the file, that we give up after the retry budget, and
that non-retryable errors (404) propagate immediately without retrying.
"""
import pytest
import requests

from route_engine import extracts


class FakeResp:
    """Minimal stand-in for a streaming requests.Response context manager."""

    def __init__(self, status_code, content=b""):
        self.status_code = status_code
        self._content = content

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"{self.status_code} error")

    def iter_content(self, chunk_size=1):
        yield self._content


@pytest.fixture
def no_wait(monkeypatch, tmp_path):
    """Point the cache at a temp dir and make backoff sleeps instant."""
    monkeypatch.setattr(extracts, "_CACHE", str(tmp_path))
    monkeypatch.setattr(extracts.time, "sleep", lambda _s: None)


def test_retries_then_succeeds(no_wait, monkeypatch):
    calls = {"n": 0}

    def fake_get(url, **kw):
        calls["n"] += 1
        return FakeResp(502) if calls["n"] < 3 else FakeResp(200, content=b"PBFDATA")

    monkeypatch.setattr(extracts.requests, "get", fake_get)

    path = extracts.ensure_extract("asia/israel", "http://example/x.osm.pbf")

    assert calls["n"] == 3  # two 502s, then a 200
    with open(path, "rb") as f:
        assert f.read() == b"PBFDATA"


def test_gives_up_after_retry_budget(no_wait, monkeypatch):
    calls = {"n": 0}

    def fake_get(url, **kw):
        calls["n"] += 1
        return FakeResp(503)

    monkeypatch.setattr(extracts.requests, "get", fake_get)

    with pytest.raises(Exception):
        extracts.ensure_extract("asia/israel", "http://example/x.osm.pbf")

    assert calls["n"] == extracts._DOWNLOAD_RETRIES  # every attempt was used


def test_non_retryable_raises_immediately(no_wait, monkeypatch):
    calls = {"n": 0}
    sleeps = {"n": 0}
    monkeypatch.setattr(extracts.time, "sleep", lambda _s: sleeps.__setitem__("n", sleeps["n"] + 1))

    def fake_get(url, **kw):
        calls["n"] += 1
        return FakeResp(404)

    monkeypatch.setattr(extracts.requests, "get", fake_get)

    with pytest.raises(requests.HTTPError):
        extracts.ensure_extract("x/y", "http://example/missing.osm.pbf")

    assert calls["n"] == 1  # no retry on a hard 404
    assert sleeps["n"] == 0


def test_cached_file_skips_download(no_wait, monkeypatch, tmp_path):
    # Pre-create the cached extract; ensure_extract must not call the network.
    path = tmp_path / "asia_israel.osm.pbf"
    path.write_bytes(b"CACHED")

    def boom(*a, **kw):
        raise AssertionError("should not download when cached")

    monkeypatch.setattr(extracts.requests, "get", boom)

    result = extracts.ensure_extract("asia/israel", "http://example/x.osm.pbf")
    assert result == str(path)
