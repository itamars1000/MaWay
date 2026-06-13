"""
Precompute a world city as a served region, straight from its Geofabrik extract
(no Overpass — works from any IP). The result is a regions/*.pkl that the engine
serves instantly, exactly like the hand-built Israeli cities.

    python -m route_engine.build_world --lat 52.5200 --lng 13.4050 \
        --name "Berlin, Germany" --out route_engine/regions/berlin.pkl

First run downloads the covering extract (cached afterwards). --radius is the
half-width of the city box in meters (default 10 km).
"""
from __future__ import annotations

import argparse
import os
import pickle
import time

from .builder import _register
from .osm_pbf import bbox_around, build_region_data


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Precompute a world city from a Geofabrik extract.")
    p.add_argument("--lat", type=float, required=True)
    p.add_argument("--lng", type=float, required=True)
    p.add_argument("--name", required=True, help='e.g. "Berlin, Germany"')
    p.add_argument("--out", required=True, help="output .pkl path")
    p.add_argument("--radius", type=float, default=10000.0, help="city box half-width (m)")
    args = p.parse_args(argv)

    t0 = time.time()
    bbox = bbox_around(args.lat, args.lng, args.radius)
    print(f"building {args.name!r} from its extract (radius {args.radius/1000:.0f} km)…")
    data = build_region_data(args.lat, args.lng, 0.0, place=args.name, bbox=bbox,
                             consolidate=True)

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "wb") as f:
        pickle.dump(data, f, protocol=pickle.HIGHEST_PROTOCOL)
    _register(args.out, args.name, data["bbox"])

    mb = os.path.getsize(args.out) / 1e6
    print(f"done in {time.time() - t0:.1f}s -> {args.out} ({mb:.1f} MB), "
          f"registered as {args.name!r}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
