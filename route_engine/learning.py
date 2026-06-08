"""
Lightweight, online "what's a good route" learner.

Every route is described by a small feature vector of *badness* signals (each
0 = great, higher = worse):
    turns    = sharp_turns_per_km / 8
    dist     = |distance - target| / target
    pleasant = 1 - pleasant_frac
    scenic   = 1 - scenic_frac      # near water / parks / the beach

The scorer ranks candidates by  w·features  (lower = better). Instead of the
hand-tuned weights, we LEARN them from 👍/👎 feedback: a tiny logistic
regression predicts "good" from the features; the fitted coefficients give the
weights. With little data the result is blended toward the hand-tuned defaults
(so early behaviour is unchanged), shifting to the learned weights as feedback
accumulates. Interpretable, dependency-light, safe with small data.
"""
from __future__ import annotations

import json
import os
import threading

import numpy as np

FEATS = ["turns", "dist", "pleasant", "scenic"]
# Turns are *already* a hard filter (≤3/km) before scoring, so among qualifying
# routes we can weight scenery more strongly to surface sea/river/park loops.
DEFAULT_WEIGHTS = {"turns": 0.38, "dist": 0.30, "pleasant": 0.10, "scenic": 0.22}
PRIOR_STRENGTH = 20  # feedback samples at which learned weights are ~half-trusted

_DIR = os.path.dirname(__file__)
_FB_PATH = os.path.join(_DIR, "feedback.jsonl")
_W_PATH = os.path.join(_DIR, "learned_weights.json")
_LOCK = threading.Lock()
_cache = {"weights": dict(DEFAULT_WEIGHTS), "n": 0, "loaded": False}


def count() -> int:
    _ensure_loaded()
    return _cache["n"]


def get_weights() -> dict:
    _ensure_loaded()
    return _cache["weights"]


def record(features: dict, label: int):
    """Append a feedback sample (features = badness dict, label 1=good/0=bad)."""
    with _LOCK:
        with open(_FB_PATH, "a", encoding="utf-8") as fh:
            fh.write(json.dumps({"f": features, "y": int(label)}) + "\n")
        _retrain_locked()


def _ensure_loaded():
    if _cache["loaded"]:
        return
    with _LOCK:
        if os.path.exists(_W_PATH):
            try:
                d = json.load(open(_W_PATH, encoding="utf-8"))
                _cache["weights"] = d.get("weights", dict(DEFAULT_WEIGHTS))
                _cache["n"] = d.get("n", 0)
            except (json.JSONDecodeError, OSError):
                pass
        _cache["loaded"] = True


def _load_data():
    X, Y = [], []
    if os.path.exists(_FB_PATH):
        for line in open(_FB_PATH, encoding="utf-8"):
            line = line.strip()
            if not line:
                continue
            d = json.loads(line)
            # .get(k, 0.0) tolerates older rows logged before a feature existed.
            X.append([d["f"].get(k, 0.0) for k in FEATS])
            Y.append(d["y"])
    return np.array(X, float), np.array(Y, float)


def _fit_logistic(X, Y, iters=800, lr=0.5):
    """Tiny logistic regression. Returns coefficients w (one per feature)."""
    Xs = X  # features already ~[0,1]
    w = np.zeros(X.shape[1])
    b = 0.0
    n = len(Y)
    for _ in range(iters):
        p = 1.0 / (1.0 + np.exp(-(b + Xs @ w)))
        err = p - Y
        w -= lr * (Xs.T @ err) / n
        b -= lr * err.mean()
    return w


def _retrain_locked():
    X, Y = _load_data()
    n = len(Y)
    weights = dict(DEFAULT_WEIGHTS)

    if n >= 4 and len(set(Y.tolist())) == 2:
        coef = _fit_logistic(X, Y)
        # Features are "badness"; a good route → negative coefficient. Convert
        # to non-negative weights and normalise.
        badness = np.clip(-coef, 0.0, None)
        if badness.sum() > 1e-9:
            learned = badness / badness.sum()
            # Blend toward defaults by sample count (confidence).
            alpha = n / (n + PRIOR_STRENGTH)
            dflt = np.array([DEFAULT_WEIGHTS[k] for k in FEATS])
            blended = alpha * learned + (1 - alpha) * dflt
            blended = blended / blended.sum()
            weights = {k: float(v) for k, v in zip(FEATS, blended)}

    json.dump({"weights": weights, "n": n}, open(_W_PATH, "w", encoding="utf-8"))
    _cache["weights"] = weights
    _cache["n"] = n
    _cache["loaded"] = True
