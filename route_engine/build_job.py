"""
Build a region from a Geofabrik extract and store it where the engine serves
from. ONE entrypoint, two uses:

  • On-demand tile (the Cloud Run **Job** payload). Triggered by world_store when
    a request lands in an uncovered area. Reads its parameters from env
    (TILE_KEY/TILE_LAT/TILE_LNG/TILE_DISTANCE[/TILE_SPAN][/TILE_NAME]) and writes
    a small loop-sized tile to gs://$REGIONS_BUCKET/ondemand/<key>.pkl plus a
    status marker the server polls. Idle cost is zero — the Job scales to zero.

        # what the Job runs (env-driven):
        python -m route_engine.build_job

  • Base city (automation: add a precomputed city to the live bucket in one
    command, no console, no redeploy when paired with POST /admin/reload):

        REGIONS_BUCKET=maway-regions python -m route_engine.build_job \
            --base --lat 52.52 --lng 13.405 --name "Berlin, Germany" \
            --slug berlin --radius 8000

Both paths build with the offline pbf pipeline (route_engine/osm_pbf.py), so
they work from any IP (no Overpass) — exactly like build_world.py, but writing
to the served store (GCS) instead of the local regions/ dir.
"""
from __future__ import annotations

import argparse
import json
import os
import pickle
import re
import time

from . import graph_store, ondemand
from .osm_pbf import bbox_around, build_region_data


def _now() -> float:
    return time.time()


def _slugify(text: str) -> str:
    """A filesystem/bucket-safe slug, e.g. 'Île-de-France' -> 'le-de-france'."""
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return s or "area"


def build_ondemand_tile(key: str, lat: float, lng: float, distance_m: float,
                        span_m: float | None = None, name: str | None = None) -> dict:
    """Build the loop-sized tile for `key` and upload it + a 'ready' marker.
    On failure, record an 'error' marker (so the server stops polling) and
    re-raise. Mirrors ondemand.get_or_build's tile shape exactly.

    The tile is stored under a recognisable name derived from the covering
    Geofabrik extract (e.g. ondemand/berlin_52.52_13.4_v7.pkl) so the bucket is
    browsable; the readable filename is recorded in the marker so the server can
    find it. The status marker itself stays at the deterministic coord-key path
    so the server can locate it from lat/lng alone."""
    from . import extracts

    res = extracts.resolve_extract(lat, lng)  # cheap; index is cached by the build
    region_name = res[0] if res else None
    label = name or (f"{region_name} ({lat:.3f},{lng:.3f})" if region_name
                     else f"area {lat:.3f},{lng:.3f}")
    # Shorten multi-country Geofabrik ids for a tidier bucket name, e.g.
    # "israel-and-palestine" -> "israel" (filename only; the marker keeps the
    # full `file`, so lookups are unaffected).
    slug = _slugify(region_name).split("-and-")[0]
    file = f"{graph_store._ONDEMAND_PREFIX}{slug}_{key}.pkl"

    graph_store.write_marker(key, {"status": "building", "name": label,
                                   "updated_at": _now()})
    try:
        # A→B span tiles get a square box around the midpoint; loops use the
        # distance-sized bbox that osm_pbf.bbox_for computes (bbox=None).
        bbox = None
        if span_m is not None:
            radius = max(2500.0, min(12000.0, 0.5 * span_m + 2500.0))
            bbox = bbox_around(lat, lng, radius)
        data = build_region_data(lat, lng, distance_m, place=label, bbox=bbox,
                                 consolidate=False)
        buf = pickle.dumps(data, protocol=pickle.HIGHEST_PROTOCOL)
        graph_store._write_bytes(file, buf, content_type="application/octet-stream")
        graph_store.write_marker(key, {"status": "ready", "name": label,
                                       "file": file, "bbox": data["bbox"],
                                       "size": len(buf), "updated_at": _now()})
        print(f"ondemand tile {key} ready -> {file} ({len(buf)/1e6:.1f} MB)")
        return data
    except Exception as exc:  # noqa: BLE001 — record + surface for the Job log
        graph_store.write_marker(key, {"status": "error", "name": label,
                                       "error": str(exc)[:500], "updated_at": _now()})
        print(f"ondemand tile {key} FAILED: {exc}")
        raise


def build_base_city(lat: float, lng: float, name: str, slug: str,
                    radius_m: float = 8000.0) -> dict:
    """Build a generous precomputed city and add it to the served base index
    (index.json) — the automated equivalent of build_world.py + manual upload."""
    bbox = bbox_around(lat, lng, radius_m)
    print(f"building base city {name!r} (radius {radius_m/1000:.0f} km)…")
    data = build_region_data(lat, lng, 0.0, place=name, bbox=bbox, consolidate=True)
    buf = pickle.dumps(data, protocol=pickle.HIGHEST_PROTOCOL)
    file = f"{slug}.pkl"
    graph_store._write_bytes(file, buf, content_type="application/octet-stream")

    # Read-modify-write the base index (manual single-operator op → no locking).
    try:
        index = json.loads(graph_store._read_bytes("index.json"))
    except Exception:  # noqa: BLE001 — first city / missing index
        index = []
    index = [r for r in index if r.get("file") != file]
    index.append({"name": name, "file": file, "bbox": data["bbox"]})
    graph_store._write_bytes(
        "index.json",
        json.dumps(index, ensure_ascii=False, indent=2).encode("utf-8"),
        content_type="application/json",
    )
    where = f"gs://{graph_store._BUCKET}" if graph_store._BUCKET else graph_store._REGIONS_DIR
    print(f"base city {name!r} -> {where}/{file} ({len(buf)/1e6:.1f} MB); "
          f"index now {len(index)} regions")
    return data


def _from_env() -> int:
    """Cloud Run Job entry: build the on-demand tile described by env vars."""
    key = os.environ["TILE_KEY"]
    lat = float(os.environ["TILE_LAT"])
    lng = float(os.environ["TILE_LNG"])
    distance = float(os.environ.get("TILE_DISTANCE", "5000"))
    span = os.environ.get("TILE_SPAN")
    span_m = float(span) if span else None
    name = os.environ.get("TILE_NAME")
    build_ondemand_tile(key, lat, lng, distance, span_m=span_m, name=name)
    return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Build a region into the served store (GCS/disk).")
    p.add_argument("--base", action="store_true",
                   help="build a precomputed BASE city (else an on-demand tile)")
    p.add_argument("--lat", type=float)
    p.add_argument("--lng", type=float)
    p.add_argument("--name", help='e.g. "Berlin, Germany"')
    p.add_argument("--slug", help="base mode: pkl filename stem, e.g. 'berlin'")
    p.add_argument("--radius", type=float, default=8000.0, help="base box half-width (m)")
    p.add_argument("--distance", type=float, default=5000.0, help="tile mode: loop target (m)")
    p.add_argument("--key", help="tile mode: cache key (default: computed from lat/lng/distance)")
    args = p.parse_args(argv)

    # No args at all → Cloud Run Job mode (everything from env).
    if not args.base and args.lat is None:
        return _from_env()

    if args.lat is None or args.lng is None:
        p.error("--lat and --lng are required")
    if args.base:
        if not (args.name and args.slug):
            p.error("--base requires --name and --slug")
        build_base_city(args.lat, args.lng, args.name, args.slug, radius_m=args.radius)
    else:
        key = args.key or ondemand.tile_key(args.lat, args.lng, args.distance)[0]
        build_ondemand_tile(key, args.lat, args.lng, args.distance, name=args.name)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
