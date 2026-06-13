"""
Resolve a lat/lng to the smallest Geofabrik OSM extract that covers it, download
it (cached), and optionally crop it to a bbox. This is the data-acquisition step
for worldwide on-demand building — no live Overpass, works from any (incl. cloud)
IP.

Geofabrik publishes an index (index-v1.json): a GeoJSON FeatureCollection where
each feature is one downloadable region with a boundary polygon and a `urls.pbf`.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess

import requests
import shapely
from shapely.geometry import Point, shape

_DIR = os.path.dirname(__file__)
_CACHE = os.path.join(_DIR, "regions", "_cache")
_INDEX_URL = "https://download.geofabrik.de/index-v1.json"
_INDEX_PATH = os.path.join(_CACHE, "geofabrik-index.json")

_index_cache = None  # [(area_deg2, geometry, id, pbf_url)], sorted small→large


def _load_index():
    global _index_cache
    if _index_cache is not None:
        return _index_cache
    os.makedirs(_CACHE, exist_ok=True)
    if not os.path.exists(_INDEX_PATH):
        r = requests.get(_INDEX_URL, timeout=60)
        r.raise_for_status()
        with open(_INDEX_PATH, "w", encoding="utf-8") as f:
            f.write(r.text)
    with open(_INDEX_PATH, encoding="utf-8") as f:
        gj = json.load(f)
    feats = []
    for ft in gj.get("features", []):
        props = ft.get("properties", {})
        geom = ft.get("geometry")
        urls = props.get("urls", {})
        pbf = urls.get("pbf")
        if not geom or not pbf:
            continue
        try:
            g = shape(geom)
        except Exception:  # noqa: BLE001
            continue
        feats.append((g.area, g, props.get("id", ""), pbf))
    feats.sort(key=lambda x: x[0])  # smallest (most specific) first
    _index_cache = feats
    return feats


def resolve_extract(lat: float, lng: float):
    """Return (extract_id, pbf_url) of the smallest Geofabrik extract covering
    the point, or None if uncovered (open sea, etc.)."""
    pt = Point(lng, lat)
    for _area, geom, ext_id, pbf in _load_index():
        if geom.covers(pt):
            return ext_id, pbf
    return None


def ensure_extract(ext_id: str, pbf_url: str) -> str:
    """Download the extract (cached on disk) and return its local path."""
    os.makedirs(_CACHE, exist_ok=True)
    path = os.path.join(_CACHE, f"{ext_id.replace('/', '_')}.osm.pbf")
    if not os.path.exists(path):
        with requests.get(pbf_url, stream=True, timeout=600) as r:
            r.raise_for_status()
            tmp = path + ".part"
            with open(tmp, "wb") as f:
                for chunk in r.iter_content(chunk_size=1 << 20):
                    f.write(chunk)
            os.replace(tmp, path)
    return path


def crop_extract(pbf_path: str, bbox, out_path: str) -> str:
    """Crop to bbox=(min_lon,min_lat,max_lon,max_lat) using the osmium CLI when
    available (reference-complete, fast). Falls back to the full extract if the
    tool isn't installed (fine for small countries / local dev). Returns the path
    to read from."""
    if shutil.which("osmium") is None:
        return pbf_path
    min_lon, min_lat, max_lon, max_lat = bbox
    try:
        subprocess.run(
            ["osmium", "extract", "-b",
             f"{min_lon},{min_lat},{max_lon},{max_lat}",
             "--strategy", "complete_ways", "--overwrite",
             pbf_path, "-o", out_path],
            check=True, capture_output=True,
        )
        return out_path
    except (subprocess.CalledProcessError, OSError):
        return pbf_path  # crop failed → read the full extract
