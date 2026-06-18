"""Tests for the elevation-aware scoring (prefer flatter loops). Offline — no
network: _score / _hill_badness read plain feature dicts and learning defaults;
_finalize tests monkeypatch elevation.add_elevation so no request is made."""
from route_engine import router
from route_engine.router import _finalize, _hill_badness, _score


def _feature(distance_m, turns_per_km, ascent_m=None, **extra):
    props = {
        "distance_m": distance_m,
        "sharp_turns_per_km": turns_per_km,
        "pleasant_frac": 0.0,
        "scenic_frac": 0.0,
        "offroad_frac": 0.0,
        "overlap_frac": 0.0,
        "busy_frac": 0.0,
        "rough_frac": 0.0,
        "sidewalked_frac": 0.0,
    }
    if ascent_m is not None:
        props["ascent_m"] = ascent_m
    props.update(extra)
    return {"type": "Feature", "properties": props}


def test_hill_badness_missing_is_zero():
    # No elevation data → no penalty (best-effort when Open-Meteo is unreachable).
    assert _hill_badness(_feature(5000, 2.0)) == 0.0


def test_hill_badness_flat_is_small():
    # 5 km loop, 25 m climb → 5 m/km → 5/50 = 0.1
    assert abs(_hill_badness(_feature(5000, 2.0, ascent_m=25)) - 0.1) < 1e-9


def test_hill_badness_caps_at_one():
    # 5 km loop, 1000 m climb → 200 m/km → capped at 1.0
    assert _hill_badness(_feature(5000, 2.0, ascent_m=1000)) == 1.0


def test_score_prefers_flatter_route():
    target = 5000
    flat = _feature(5000, 2.0, ascent_m=20)
    hilly = _feature(5000, 2.0, ascent_m=300)
    assert _score(flat, target) < _score(hilly, target)


def test_score_no_elevation_matches_no_penalty():
    # A feature without ascent_m scores exactly as if the hill term were absent
    # (i.e. identical to one with ascent_m=0 over the same distance).
    target = 5000
    no_data = _feature(5000, 2.0)              # ascent_m absent → badness 0
    flat_zero = _feature(5000, 2.0, ascent_m=0)  # explicit 0 climb → badness 0
    assert abs(_score(no_data, target) - _score(flat_zero, target)) < 1e-9


# --- _finalize: elevation fetch + flat-first re-rank (monkeypatched) ----------

def _patch_elevation(monkeypatch, ascents):
    """Make add_elevation assign ascent_m from `ascents` (by order), no network."""
    def fake(features, timeout=4.0):
        for feat, up in zip(features, ascents):
            feat["properties"]["ascent_m"] = up
        return features
    monkeypatch.setattr(router.elevation, "add_elevation", fake)


def test_finalize_reranks_flattest_first(monkeypatch):
    target = 5000
    # Two equal loops; the second is much flatter and should lead after finalize.
    cands = [_feature(5000, 2.0), _feature(5000, 2.0)]
    _patch_elevation(monkeypatch, ascents=[300, 20])
    out = _finalize(cands, target)
    assert out[0]["properties"]["ascent_m"] == 20  # flatter wins


def test_finalize_no_resort_preserves_order(monkeypatch):
    target = 5000
    cands = [_feature(6000, 2.0), _feature(5500, 2.0)]
    _patch_elevation(monkeypatch, ascents=[300, 20])
    out = _finalize(cands, target, resort=False)
    # Order untouched (distance-descending fallback path), but elevation attached.
    assert [f["properties"]["distance_m"] for f in out] == [6000, 5500]
    assert out[0]["properties"]["ascent_m"] == 300


def test_finalize_survives_elevation_failure(monkeypatch):
    target = 5000
    cands = [_feature(5000, 2.0), _feature(5200, 2.0)]

    def boom(features, timeout=4.0):
        raise RuntimeError("network down")
    monkeypatch.setattr(router.elevation, "add_elevation", boom)

    out = _finalize(cands, target)  # must not raise
    assert len(out) == 2
    assert all("ascent_m" not in f["properties"] for f in out)


def test_finalize_empty_is_safe(monkeypatch):
    _patch_elevation(monkeypatch, ascents=[])
    assert _finalize([], 5000) == []
