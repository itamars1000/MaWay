"""CLI: python -m route_engine --lat 32.0810 --lng 34.7800 --distance 5000"""
from __future__ import annotations

import argparse
import json
import sys

from . import generate_loop


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Generate a low-turn running loop (GeoJSON).")
    p.add_argument("--lat", type=float, required=True, help="Start latitude")
    p.add_argument("--lng", type=float, required=True, help="Start longitude")
    p.add_argument("--distance", type=float, required=True, help="Target distance (meters)")
    p.add_argument("--seed", type=int, default=None, help="Random seed (bearing variety)")
    p.add_argument("--alpha", type=float, default=500.0, help="Turn-penalty strength")
    p.add_argument("--k", type=float, default=3.0, help="Turn-penalty exponent")
    p.add_argument("--out", type=str, default=None, help="Write GeoJSON here (else stdout)")
    p.add_argument("--plot", type=str, default=None, help="Write a folium HTML map here")
    args = p.parse_args(argv)

    feature = generate_loop(
        args.lat, args.lng, args.distance, seed=args.seed, alpha=args.alpha, k=args.k
    )

    text = json.dumps(feature, ensure_ascii=False)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"Wrote {args.out}", file=sys.stderr)
    else:
        print(text)

    print(
        "props: " + json.dumps(feature["properties"], ensure_ascii=False),
        file=sys.stderr,
    )

    if args.plot:
        _plot(feature, args.lat, args.lng, args.plot)
    return 0


def _plot(feature, lat, lng, path):
    try:
        import folium
    except ImportError:
        print("folium not installed; skipping --plot", file=sys.stderr)
        return
    m = folium.Map(location=[lat, lng], zoom_start=15, tiles="cartodbpositron")
    latlng = [[c[1], c[0]] for c in feature["geometry"]["coordinates"]]
    folium.PolyLine(latlng, color="#111625", weight=5).add_to(m)
    folium.CircleMarker([lat, lng], radius=7, color="#1d9bf0", fill=True).add_to(m)
    m.save(path)
    print(f"Wrote map {path}", file=sys.stderr)


if __name__ == "__main__":
    raise SystemExit(main())
