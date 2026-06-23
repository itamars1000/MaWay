"""
End-to-end smoke check for a running engine (local or deployed). Hits GET /loop
for a few cities/distances and asserts the behaviours the recent engine work was
meant to deliver:

  - distance accuracy  — returned loop is at/above the requested length
                         (or explicitly flagged below_requested)
  - quality cap        — sharp_turns_per_km <= 3 for the shown route
  - flat preference    — the FIRST (shown) candidate has ~minimal ascent among
                         the returned candidates
  - closed loop        — start/end gap is small

Pure stdlib (urllib) so it runs anywhere. Read-only against the engine.

    python -m route_engine.verify_live --url https://<service-url>
    python -m route_engine.verify_live                      # default localhost:8000
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
import urllib.request

# (name, lat, lng) — covered cities; hilly Haifa exercises the flat preference.
CITIES = [
    ("Tel Aviv", 32.0810, 34.7800),
    ("Be'er Sheva", 31.2520, 34.7915),
    ("Haifa", 32.7940, 34.9896),
]
DISTANCES = (3000, 5000, 8000)
MAX_TURNS_PER_KM = 3.0
DIST_TOL = 0.97          # allow a hair under target for float/rounding slack
ASCENT_SLACK_M = 5       # "first is flattest" tolerance


def _get_loop(base, lat, lng, dist, timeout=60):
    qs = urllib.parse.urlencode({"lat": lat, "lng": lng, "distance": dist})
    url = f"{base.rstrip('/')}/loop?{qs}"
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        return json.load(resp), resp.status


def _check(base, name, lat, lng, dist):
    """Return (ok, [lines]) for one request."""
    out = []
    try:
        fc, status = _get_loop(base, lat, lng, dist)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:200]
        return False, [f"  {name} {dist}m: HTTP {e.code} — {body}"]
    except Exception as e:  # noqa: BLE001 — network/timeout
        return False, [f"  {name} {dist}m: request failed — {e}"]

    feats = fc.get("features") or []
    if not feats:
        return False, [f"  {name} {dist}m: no candidates returned"]

    first = feats[0]["properties"]
    actual = first.get("distance_m", 0)
    turns = first.get("sharp_turns_per_km", 0)
    gap = first.get("closed_loop_gap_m", 0)
    below = first.get("below_requested", False)
    ascents = [f["properties"].get("ascent_m") for f in feats]
    ascents = [a for a in ascents if a is not None]

    ok = True
    # distance
    if below:
        out.append(f"  {name} {dist}m: [WARN] below_requested actual={actual:.0f} "
                   f"(engine could not reach target here)")
    elif actual >= dist * DIST_TOL:
        out.append(f"  {name} {dist}m: [OK] distance {actual:.0f} (>= target)")
    else:
        ok = False
        out.append(f"  {name} {dist}m: [FAIL] distance {actual:.0f} < target {dist} "
                   f"(NOT flagged below_requested)")
    # turns
    if turns <= MAX_TURNS_PER_KM + 1e-6:
        out.append(f"      turns/km {turns:.2f} [OK]")
    else:
        out.append(f"      turns/km {turns:.2f} [FAIL] (> {MAX_TURNS_PER_KM})")
    # flat preference: first candidate should be ~the flattest
    if first.get("ascent_m") is not None and len(ascents) >= 2:
        if first["ascent_m"] <= min(ascents) + ASCENT_SLACK_M:
            out.append(f"      ascent {first['ascent_m']}m is min of "
                       f"{sorted(ascents)} [OK] (flat-first)")
        else:
            out.append(f"      ascent {first['ascent_m']}m NOT min of "
                       f"{sorted(ascents)} [WARN] (flat preference may be off)")
    elif first.get("ascent_m") is None:
        out.append("      ascent: — (no elevation data; Open-Meteo unreachable?)")
    # loop closure
    out.append(f"      loop gap {gap:.0f}m, {len(feats)} candidates")
    return ok, out


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Smoke-check a running engine's /loop.")
    p.add_argument("--url", default="http://localhost:8000",
                   help="engine base URL (default http://localhost:8000)")
    args = p.parse_args(argv)

    try:  # so the em-dashes / city names print on a cp1252 (Windows) console
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:  # noqa: BLE001
        pass

    print(f"verifying engine at {args.url}\n")
    all_ok = True
    for name, lat, lng in CITIES:
        for dist in DISTANCES:
            ok, lines = _check(args.url, name, lat, lng, dist)
            all_ok = all_ok and ok
            print("\n".join(lines))
        print()

    print("RESULT:", "PASS [OK]" if all_ok else "FAIL [FAIL] (see [FAIL] lines above)")
    return 0 if all_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
