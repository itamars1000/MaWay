"""Anti-poisoning bounds on the /feedback learner (offline — no network).

/feedback is anonymous and its feature payload is client-supplied, so these
tests pin that a flood of crafted feedback can neither take over the scorer
(learned share is capped) nor grow the log unbounded, and that wild payload
values are clamped before they reach the fit."""
from route_engine import learning
from route_engine.learning import DEFAULT_WEIGHTS, FEATS, _MAX_ALPHA

import pytest


@pytest.fixture
def fresh(tmp_path, monkeypatch):
    """Isolate the learner's on-disk state to a tmp dir + reset its cache."""
    monkeypatch.setattr(learning, "_FB_PATH", str(tmp_path / "feedback.jsonl"))
    monkeypatch.setattr(learning, "_W_PATH", str(tmp_path / "weights.json"))
    monkeypatch.setattr(
        learning, "_cache",
        {"weights": dict(DEFAULT_WEIGHTS), "n": 0, "loaded": True})
    return learning


def _poison(mod, n):
    """Separable, one-sided feedback: 'good' = low dist / high everything else,
    'bad' = the opposite. A naive learner would put ALL weight on `dist`."""
    for i in range(n):
        if i % 2 == 0:
            mod.record({"turns": 1.0, "dist": 0.0, "pleasant": 1.0, "scenic": 1.0}, 1)
        else:
            mod.record({"turns": 0.0, "dist": 1.0, "pleasant": 0.0, "scenic": 0.0}, 0)


def test_learned_share_is_capped(fresh):
    _poison(fresh, 200)  # far past the point where uncapped alpha -> ~0.9
    w = fresh.get_weights()
    # blended[k] = alpha*learned[k] + (1-alpha)*default[k], with alpha <= _MAX_ALPHA,
    # so no amount of poison can drive any weight below (1-_MAX_ALPHA)*default.
    # (Without the cap, alpha would be ~0.9 and this floor would be violated.)
    for k in FEATS:
        floor = (1.0 - _MAX_ALPHA) * DEFAULT_WEIGHTS[k]
        assert w[k] >= floor - 1e-6, (k, w[k], floor)
    assert abs(sum(w.values()) - 1.0) < 1e-6


def test_feedback_log_is_capped(fresh, monkeypatch):
    monkeypatch.setattr(fresh, "_MAX_SAMPLES", 10)
    _poison(fresh, 25)
    assert fresh.count() == 10
    with open(fresh._FB_PATH, encoding="utf-8") as fh:
        lines = [ln for ln in fh.read().splitlines() if ln.strip()]
    assert len(lines) == 10


def test_feedback_features_clamped():
    # Wild, attacker-supplied payload → every badness feature stays in range.
    from route_engine.api import Feedback, _feedback_features
    fb = Feedback(turns_per_km=1e6, distance_m=1e9, target_m=1000.0,
                  pleasant_frac=-50.0, scenic_frac=99.0, label=1)
    f = _feedback_features(fb)
    assert 0.0 <= f["turns"] <= 2.0
    assert 0.0 <= f["dist"] <= 3.0
    assert 0.0 <= f["pleasant"] <= 1.0
    assert 0.0 <= f["scenic"] <= 1.0
