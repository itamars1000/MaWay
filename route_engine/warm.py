"""
Pre-build the major Israeli cities so they're instant from the first request
(full pipeline: prune + consolidate + parks). Anything not listed here still
works via on-demand tiles (route_engine/ondemand.py) — just slower on first use.

    python -m route_engine.warm            # build all
    python -m route_engine.warm "Haifa, Israel"   # build one
"""
from __future__ import annotations

import os
import re
import sys

from .builder import main as build_main

CITIES = [
    "Tel Aviv, Israel",
    "Be'er Sheva, Israel",
    "Jerusalem, Israel",
    "Haifa, Israel",
    "Rishon LeZion, Israel",
    "Petah Tikva, Israel",
    "Netanya, Israel",
    "Ashdod, Israel",
    "Holon, Israel",
    "Ramat Gan, Israel",
    "Herzliya, Israel",
    "Kfar Saba, Israel",
]

_REGIONS = os.path.join(os.path.dirname(__file__), "regions")


def _slug(place: str) -> str:
    name = place.split(",")[0].strip().lower()
    return re.sub(r"[^a-z0-9]+", "_", name).strip("_")


def main(argv=None) -> int:
    argv = argv if argv is not None else sys.argv[1:]
    cities = argv or CITIES
    for place in cities:
        out = os.path.join(_REGIONS, f"{_slug(place)}.pkl")
        print(f"\n=== {place} -> {out} ===")
        try:
            build_main(["--place", place, "--out", out])
        except Exception as exc:  # noqa: BLE001
            print(f"   FAILED: {exc}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
