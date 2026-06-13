"""
Offline graph builder (run once per city).

    python -m route_engine.builder --place "Tel Aviv, Israel"   --out route_engine/regions/tel_aviv.pkl
    python -m route_engine.builder --place "Be'er Sheva, Israel" --out route_engine/regions/beer_sheva.pkl

Pipeline: download walk network -> prune (dead-ends, motorways, consolidate
intersections) -> dual graph with static kinematic turn costs -> serialize a
compact, rustworkx-friendly pickle + register it in regions/index.json.
"""
from __future__ import annotations

import argparse
import json
import os
import pickle
import time

import networkx as nx
import osmnx as ox
from shapely import STRtree
from shapely.geometry import Point

from .dual_graph import build_dual_graph, _edge_latlng

ox.settings.use_cache = True
ox.settings.log_console = False

# Highways we never route on (unsafe for running). Off-road dirt ways are NOT
# dropped here — removing them broke connectivity and forced extra turns;
# instead they're heavily penalised in the routing weight (see dual_graph), so
# they're avoided but still available when they're the only sensible connector.
_DROP_HIGHWAYS = {"motorway", "motorway_link", "trunk", "trunk_link"}


def _highway_of(data) -> str:
    hw = data.get("highway")
    if isinstance(hw, list):
        return hw[0] if hw else ""
    return hw or ""


def prune(G):
    """Drop motorways/trunks, then iteratively remove dead-ends (degree-1)."""
    G.remove_edges_from(
        [(u, v, k) for u, v, k, d in G.edges(keys=True, data=True)
         if _highway_of(d) in _DROP_HIGHWAYS]
    )
    while True:
        und = G.to_undirected()
        dead = [n for n in list(G.nodes) if und.degree(n) <= 1]
        if not dead:
            break
        G.remove_nodes_from(dead)
    G.remove_nodes_from(list(nx.isolates(G)))
    return G


def consolidate(G):
    """Merge complex intersections (dual carriageways, big junctions)."""
    Gp = ox.project_graph(G)
    Gc = ox.consolidate_intersections(
        Gp, tolerance=12, rebuild_graph=True, dead_ends=False, reconnect_edges=True
    )
    Gc = ox.project_graph(Gc, to_crs="EPSG:4326")
    Gc = ox.distance.add_edge_lengths(Gc)
    return Gc


def _green_edges_from_polys(G, polys):
    """Edge keys (u,v,k) whose midpoint lies in a park / green polygon."""
    polys = [g for g in polys
             if g is not None and g.geom_type in ("Polygon", "MultiPolygon")]
    if not polys:
        print("      green edges: 0")
        return set()
    tree = STRtree(polys)
    green = set()
    for u, v, key, data in G.edges(keys=True, data=True):
        coords = _edge_latlng(G, u, v, data)
        mid = coords[len(coords) // 2]  # (lat, lng)
        if len(tree.query(Point(mid[1], mid[0]), predicate="intersects")) > 0:
            green.add((u, v, key))
    print(f"      green edges: {len(green)}")
    return green


def green_edges(G, place):
    """Set of edge keys (u,v,k) whose midpoint lies in a park / green area."""
    tags = {
        "leisure": ["park", "garden", "nature_reserve", "pitch", "common"],
        "landuse": ["grass", "recreation_ground", "forest", "meadow", "village_green"],
        "natural": ["wood", "scrub", "grassland"],
    }
    gdf = _features_place(place, tags)
    polys = list(gdf.geometry) if gdf is not None else []
    return _green_edges_from_polys(G, polys)


# ~85 m in degrees — a street this close to water counts as scenic (it has the
# view even if it's not literally on it, e.g. a seaside/riverside promenade).
_SCENIC_BUFFER_DEG = 0.00085
# Min park area (deg²) to be a "scenic" park; ~40,000 m² filters out the many
# tiny neighbourhood gardens so scenic stays a *discriminating* signal (a real
# view of water or a large green), not "anywhere in a leafy city".
_MIN_PARK_AREA_DEG2 = 3.3e-6


# Scenic feature tags: water (sea/river/lake) and large parks.
_WATER_TAGS = {
    "natural": ["water", "coastline", "beach", "bay", "wetland"],
    "waterway": ["river", "riverbank", "canal", "stream", "dock"],
    "water": True,  # any water=* (lake, pond, reservoir, …)
}
_PARK_TAGS = {"leisure": ["park", "nature_reserve"], "landuse": ["forest"]}


def _features_place(place, tags):
    try:
        return ox.features_from_place(place, tags=tags)
    except Exception as exc:  # noqa: BLE001
        print(f"      (features unavailable {tags}: {exc})")
        return None


def _features_point(center, radius, tags):
    """Same as _features_place but for an on-demand tile (center + radius)."""
    try:
        return ox.features_from_point(center, tags=tags, dist=radius)
    except Exception as exc:  # noqa: BLE001
        print(f"      (features unavailable {tags}: {exc})")
        return None


def _filter_scenic_geoms(wdf, pdf):
    """Keep water lines/polys and large park polys from raw feature frames."""
    water_geoms, park_polys = [], []
    if wdf is not None:
        water_geoms = [
            g for g in wdf.geometry
            if g is not None and g.geom_type in (
                "Polygon", "MultiPolygon", "LineString", "MultiLineString"
            )
        ]
    if pdf is not None:
        park_polys = [
            g for g in pdf.geometry
            if g is not None and g.geom_type in ("Polygon", "MultiPolygon")
            and g.area >= _MIN_PARK_AREA_DEG2
        ]
    return water_geoms, park_polys


def _scenic_edges_from_geoms(G, water_geoms, park_polys):
    """Edge keys (u,v,k) scenic: near water (buffered) OR inside a large park."""
    if not water_geoms and not park_polys:
        return set()
    water_tree = STRtree(water_geoms) if water_geoms else None
    park_tree = STRtree(park_polys) if park_polys else None

    scenic = set()
    for u, v, key, data in G.edges(keys=True, data=True):
        coords = _edge_latlng(G, u, v, data)
        mid = coords[len(coords) // 2]  # (lat, lng)
        pt = Point(mid[1], mid[0])
        near_water = water_tree is not None and len(
            water_tree.query(pt.buffer(_SCENIC_BUFFER_DEG), predicate="intersects")
        ) > 0
        in_park = park_tree is not None and len(
            park_tree.query(pt, predicate="intersects")
        ) > 0
        if near_water or in_park:
            scenic.add((u, v, key))
    print(f"      scenic edges: {len(scenic)} "
          f"(water geoms={len(water_geoms)}, big parks={len(park_polys)})")
    return scenic


def scenic_edges(G, place):
    """Scenic edge keys for a named place (offline builder). Near water (sea/
    river/lake, buffered so promenades count) OR inside a large park. Stricter
    than `green_edges` — meant to single out genuine views (scoring-only)."""
    wdf = _features_place(place, _WATER_TAGS)
    pdf = _features_place(place, _PARK_TAGS)
    return _scenic_edges_from_geoms(G, *_filter_scenic_geoms(wdf, pdf))


def scenic_edges_point(G, center, radius):
    """Scenic edge keys for an on-demand tile (center=(lat,lng), radius=m)."""
    wdf = _features_point(center, radius, _WATER_TAGS)
    pdf = _features_point(center, radius, _PARK_TAGS)
    return _scenic_edges_from_geoms(G, *_filter_scenic_geoms(wdf, pdf))


# Scenic anchors are scenic nodes' end-coords downsampled to a ~500 m grid;
# they're the "destinations" the router aims a few candidates at.
_ANCHOR_GRID_DEG = 0.0045   # ~500 m
_MAX_ANCHORS = 400


def _scenic_anchors(end_lat, end_lng, scenic):
    cells = {}
    for i, is_scenic in enumerate(scenic):
        if not is_scenic:
            continue
        la, lo = end_lat[i], end_lng[i]
        cell = (round(la / _ANCHOR_GRID_DEG), round(lo / _ANCHOR_GRID_DEG))
        cells.setdefault(cell, [la, lo])
    anchors = list(cells.values())
    if len(anchors) > _MAX_ANCHORS:  # keep an even spatial spread
        stride = len(anchors) / _MAX_ANCHORS
        anchors = [anchors[int(k * stride)] for k in range(_MAX_ANCHORS)]
    return anchors


def _undirected_seg(nid):
    u, v, key = nid
    return (min(u, v), max(u, v), key)


def serialize(G, DG, info, place):
    """Flatten the dual graph into compact, index-based arrays for the router."""
    node_ids = list(info.keys())
    idx_of = {nid: i for i, nid in enumerate(node_ids)}
    n = len(node_ids)

    end_lat = [0.0] * n
    end_lng = [0.0] * n
    end_heading = [0.0] * n
    length = [0.0] * n
    pleasant = [False] * n
    scenic = [False] * n
    offroad = [False] * n
    v_primal = [None] * n
    node_useg = [None] * n
    coords = [None] * n
    start_by_primal: dict = {}

    for nid, i in idx_of.items():
        m = info[nid]
        end_lat[i], end_lng[i] = m["coords"][-1]
        end_heading[i] = m["end_heading"]
        length[i] = m["length"]
        pleasant[i] = bool(m["pleasant"])
        scenic[i] = bool(m.get("scenic", False))
        offroad[i] = bool(m.get("offroad", False))
        v_primal[i] = m["v"]
        node_useg[i] = list(_undirected_seg(nid))  # JSON/pickle-friendly
        coords[i] = m["coords"]
        start_by_primal.setdefault(m["u"], []).append(i)

    edges = []
    for a, b, d in DG.edges(data=True):
        t = idx_of[b]
        edges.append((idx_of[a], t, d["weight"], node_useg[t]))

    primal_nodes = list(G.nodes)
    primal_lat = [G.nodes[x]["y"] for x in primal_nodes]
    primal_lng = [G.nodes[x]["x"] for x in primal_nodes]
    bbox = [min(primal_lat), min(primal_lng), max(primal_lat), max(primal_lng)]

    # Scenic "destinations" the router aims a few candidates toward.
    scenic_anchors = _scenic_anchors(end_lat, end_lng, scenic)
    print(f"      scenic anchors: {len(scenic_anchors)}")

    return {
        "meta": {"place": place, "built_at": time.time(), "n_nodes": n, "n_edges": len(edges)},
        "bbox": bbox,
        "end_lat": end_lat, "end_lng": end_lng, "end_heading": end_heading,
        "length": length, "pleasant": pleasant, "scenic": scenic,
        "offroad": offroad,
        "scenic_anchors": scenic_anchors,
        "v_primal": v_primal, "node_useg": node_useg, "coords": coords,
        "edges": edges,
        "primal_nodes": primal_nodes, "primal_lat": primal_lat, "primal_lng": primal_lng,
        "start_by_primal": start_by_primal,
    }


def _register(out_path, place, bbox):
    regions_dir = os.path.dirname(os.path.abspath(out_path))
    index_path = os.path.join(regions_dir, "index.json")
    try:
        with open(index_path, encoding="utf-8") as f:
            index = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        index = []
    index = [r for r in index if r.get("file") != os.path.basename(out_path)]
    index.append({"name": place, "file": os.path.basename(out_path), "bbox": bbox})
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Precompute a city's dual graph.")
    p.add_argument("--place", required=True, help='e.g. "Tel Aviv, Israel"')
    p.add_argument("--out", required=True, help="output .pkl path")
    p.add_argument("--alpha", type=float, default=500.0)
    p.add_argument("--k", type=float, default=3.0)
    p.add_argument("--no-consolidate", action="store_true")
    args = p.parse_args(argv)

    t0 = time.time()
    print(f"[1/4] downloading walk network for {args.place!r} …")
    G = ox.graph_from_place(args.place, network_type="walk")
    print(f"      raw: {G.number_of_nodes()} nodes / {G.number_of_edges()} edges")

    print("[2/4] pruning …")
    G = prune(G)
    if not args.no_consolidate:
        try:
            G = consolidate(G)
            G = prune(G)  # consolidation can create new short dead-ends
        except Exception as exc:  # noqa: BLE001
            print(f"      consolidation skipped ({exc})")
    print(f"      pruned: {G.number_of_nodes()} nodes / {G.number_of_edges()} edges")

    print("[3/4] building dual graph + turn costs …")
    green = green_edges(G, args.place)
    scenic = scenic_edges(G, args.place)
    DG, info = build_dual_graph(
        G, alpha=args.alpha, k=args.k, green_keys=green, scenic_keys=scenic
    )
    print(f"      dual: {DG.number_of_nodes()} nodes / {DG.number_of_edges()} edges")

    print("[4/4] serializing …")
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    data = serialize(G, DG, info, args.place)
    with open(args.out, "wb") as f:
        pickle.dump(data, f, protocol=pickle.HIGHEST_PROTOCOL)
    _register(args.out, args.place, data["bbox"])

    size_mb = os.path.getsize(args.out) / 1e6
    print(f"done in {time.time() - t0:.1f}s -> {args.out} ({size_mb:.1f} MB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
