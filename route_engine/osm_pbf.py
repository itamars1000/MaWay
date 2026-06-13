"""
Build a routable walk graph from a local OSM .pbf extract (Geofabrik), scoped to
a bounding box — the offline, cloud-friendly alternative to the Overpass download
in network.py. Uses pyosmium (well-maintained, ships wheels for all platforms).

The output is a networkx.MultiDiGraph shaped like what osmnx produces, so it
drops straight into dual_graph.build_dual_graph (node x/y, edge highway/surface/
length/geometry). Ways are split at shared (intersection) nodes so turns are
modelled correctly.
"""
from __future__ import annotations

import networkx as nx
import osmium
import shapely
from shapely.geometry import LineString

from .geo import haversine

# Tag sets mirror builder.green_edges / _WATER_TAGS / _PARK_TAGS so the pbf path
# produces the same pleasant/scenic signals as the osmnx path.
_GREEN = {
    "leisure": {"park", "garden", "nature_reserve", "pitch", "common"},
    "landuse": {"grass", "recreation_ground", "forest", "meadow", "village_green"},
    "natural": {"wood", "scrub", "grassland"},
}
_WATER_AREA = {
    "natural": {"water", "wetland", "bay", "beach"},
    "waterway": {"riverbank", "dock"},
}
_WATER_LINE = {
    "waterway": {"river", "canal", "stream"},
    "natural": {"coastline"},
}
_PARK = {"leisure": {"park", "nature_reserve"}, "landuse": {"forest"}}
_FEATURE_KEYS = ("leisure", "landuse", "natural", "water", "waterway")


def _matches(tags, spec) -> bool:
    for key, vals in spec.items():
        v = tags.get(key)
        if v is not None and v in vals:
            return True
    return False


def _bbox_overlaps(geom, bbox) -> bool:
    min_lon, min_lat, max_lon, max_lat = bbox
    x0, y0, x1, y1 = geom.bounds  # x=lon, y=lat
    return not (x1 < min_lon or x0 > max_lon or y1 < min_lat or y0 > max_lat)


def features_from_pbf(pbf_path: str, bbox):
    """Extract pleasant/scenic geometries within bbox from a .pbf.

    Returns (green_polys, water_geoms, park_polys): polygon/line lists ready for
    builder._green_edges_from_polys and builder._scenic_edges_from_geoms."""
    green_polys, water_geoms, park_polys = [], [], []
    wkb = osmium.geom.WKBFactory()

    # Pass 1: assembled areas (parks, green landuse, water bodies). The KeyFilter
    # is applied BEFORE area assembly, so only tagged areas are assembled — this
    # is ~40× faster than assembling every area then filtering.
    areas = (
        osmium.FileProcessor(pbf_path)
        .with_areas()
        .with_filter(osmium.filter.KeyFilter(*_FEATURE_KEYS))
    )
    for o in areas:
        if not (hasattr(o, "is_area") and o.is_area()):
            continue
        tags = o.tags
        is_green = _matches(tags, _GREEN)
        is_water = _matches(tags, _WATER_AREA) or tags.get("water") is not None
        is_park = _matches(tags, _PARK)
        if not (is_green or is_water or is_park):
            continue
        try:
            g = shapely.from_wkb(bytes.fromhex(wkb.create_multipolygon(o)))
        except Exception:  # noqa: BLE001 — skip un-assemblable areas
            continue
        if g.is_empty or not _bbox_overlaps(g, bbox):
            continue
        if is_green:
            green_polys.append(g)
        if is_water:
            water_geoms.append(g)
        if is_park:
            park_polys.append(g)

    # Pass 2: water LINES (coastline, rivers) — these are ways, not areas.
    lines = (
        osmium.FileProcessor(pbf_path)
        .with_locations()
        .with_filter(osmium.filter.KeyFilter("waterway", "natural"))
    )
    for o in lines:
        if not o.is_way():
            continue
        if not _matches(o.tags, _WATER_LINE):
            continue
        pts = [(nd.location.lon, nd.location.lat) for nd in o.nodes if nd.location.valid()]
        if len(pts) < 2:
            continue
        g = LineString(pts)
        if _bbox_overlaps(g, bbox):
            water_geoms.append(g)

    return green_polys, water_geoms, park_polys


def bbox_for(lat: float, lng: float, distance_m: float):
    """A tile bbox (min_lon,min_lat,max_lon,max_lat) sized to a loop's reach —
    mirrors ondemand's radius (the far polygon waypoint sits ~0.32·distance)."""
    import math
    radius = max(2500.0, min(9000.0, 0.32 * distance_m + 1500.0))
    dlat = radius / 111320.0
    dlon = radius / (111320.0 * max(0.2, math.cos(math.radians(lat))))
    return (lng - dlon, lat - dlat, lng + dlon, lat + dlat)


def bbox_around(lat: float, lng: float, radius_m: float):
    """A square bbox of half-width radius_m around a point (for city precompute)."""
    import math
    dlat = radius_m / 111320.0
    dlon = radius_m / (111320.0 * max(0.2, math.cos(math.radians(lat))))
    return (lng - dlon, lat - dlat, lng + dlon, lat + dlat)


def build_region_data(lat: float, lng: float, distance_m: float, place=None,
                       bbox=None, consolidate=False):
    """Resolve → download → crop → build a serialized region dict for any point
    on earth, straight from a Geofabrik extract (no Overpass). Raises with a
    stable token if the point isn't covered by any extract. Pass `bbox` to
    override the loop-sized tile (e.g. a generous city-size box for precompute);
    pass `consolidate=True` to merge complex intersections (smaller graph —
    used for precomputed cities, skipped for fast on-demand tiles)."""
    from . import extracts
    from . import builder as _b
    from .builder import (
        prune, _green_edges_from_polys, _scenic_edges_from_geoms,
        _MIN_PARK_AREA_DEG2, serialize,
    )
    from .dual_graph import build_dual_graph

    if bbox is None:
        bbox = bbox_for(lat, lng, distance_m)
    res = extracts.resolve_extract(lat, lng)
    if res is None:
        raise RuntimeError("no_extract: point not covered by any OSM extract")
    ext_id, url = res
    pbf = extracts.ensure_extract(ext_id, url)
    src = extracts.crop_extract(pbf, bbox, pbf + ".crop.pbf")

    G = prune(graph_from_pbf(src, bbox))
    if consolidate:
        try:
            G = prune(_b.consolidate(G))  # merge junctions → far smaller graph
        except Exception as exc:  # noqa: BLE001
            print(f"      consolidation skipped ({exc})")
    green_polys, water_geoms, park_polys = features_from_pbf(src, bbox)
    green_keys = _green_edges_from_polys(G, green_polys)
    big_parks = [g for g in park_polys if g.area >= _MIN_PARK_AREA_DEG2]
    scenic_keys = _scenic_edges_from_geoms(G, water_geoms, big_parks)
    DG, info = build_dual_graph(G, green_keys=green_keys, scenic_keys=scenic_keys)
    return serialize(G, DG, info, place or f"extract:{ext_id}")

# Same as builder._DROP_HIGHWAYS — skip unsafe roads up front (smaller graph).
_DROP = {"motorway", "motorway_link", "trunk", "trunk_link"}


def _tag(value):
    """OSM tag values are strings; keep highway/surface as-is (single value)."""
    return value or ""


def graph_from_pbf(pbf_path: str, bbox) -> nx.MultiDiGraph:
    """bbox = (min_lon, min_lat, max_lon, max_lat). Returns a walk MultiDiGraph
    covering every way that touches the bbox (full geometry, even nodes just
    outside, so border edges stay intact)."""
    min_lon, min_lat, max_lon, max_lat = bbox

    ways = []                      # [(coords:[(nid,lat,lon)], tags)]
    node_count: dict[int, int] = {}   # how many kept ways use each node
    node_ll: dict[int, tuple] = {}    # nid -> (lat, lon)

    fp = (
        osmium.FileProcessor(pbf_path)
        .with_locations()
        .with_filter(osmium.filter.KeyFilter("highway"))
    )
    for o in fp:
        if not o.is_way():
            continue
        hw = _tag(o.tags.get("highway"))
        if hw in _DROP:
            continue
        coords = []
        touch = False
        for nd in o.nodes:
            loc = nd.location
            if not loc.valid():
                continue
            lat, lon = loc.lat, loc.lon
            coords.append((nd.ref, lat, lon))
            if min_lon <= lon <= max_lon and min_lat <= lat <= max_lat:
                touch = True
        if not touch or len(coords) < 2:
            continue
        tags = {"highway": hw}
        surf = _tag(o.tags.get("surface"))
        if surf:
            tags["surface"] = surf
        ways.append((coords, tags))
        for nid, lat, lon in coords:
            node_count[nid] = node_count.get(nid, 0) + 1
            node_ll[nid] = (lat, lon)

    G = nx.MultiDiGraph(crs="EPSG:4326")

    def _is_node(nid):  # graph node = an intersection (shared by ≥2 ways)
        return node_count.get(nid, 0) >= 2

    for coords, tags in ways:
        last = len(coords) - 1
        seg_start = 0
        for i in range(1, len(coords)):
            if _is_node(coords[i][0]) or i == last:
                seg = coords[seg_start:i + 1]
                seg_start = i
                if len(seg) < 2:
                    continue
                u, v = seg[0][0], seg[-1][0]
                if u == v:
                    continue
                line = [(lat, lon) for _, lat, lon in seg]
                length = sum(haversine(line[k - 1], line[k]) for k in range(1, len(line)))
                if length <= 0:
                    continue
                fwd = LineString([(lon, lat) for lat, lon in line])      # x=lon, y=lat
                rev = LineString([(lon, lat) for lat, lon in reversed(line)])
                # Walking is bidirectional → add both directions.
                G.add_edge(u, v, highway=tags["highway"], length=length,
                           geometry=fwd, **({"surface": tags["surface"]} if "surface" in tags else {}))
                G.add_edge(v, u, highway=tags["highway"], length=length,
                           geometry=rev, **({"surface": tags["surface"]} if "surface" in tags else {}))

    for nid in list(G.nodes):
        lat, lon = node_ll[nid]
        G.nodes[nid]["y"] = lat
        G.nodes[nid]["x"] = lon

    return G
