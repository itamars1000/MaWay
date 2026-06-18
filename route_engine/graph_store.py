"""
Loads precomputed region pickles into fast in-memory rustworkx graphs and
serves region lookup. The API loads everything once at startup.
"""
from __future__ import annotations

import json
import os
import pickle
from collections import OrderedDict

import numpy as np
import rustworkx as rx

from .geo import haversine

_REGIONS_DIR = os.path.join(os.path.dirname(__file__), "regions")
# Region storage: a GCS bucket in production (env REGIONS_BUCKET), else the local
# regions/ dir. Regions load LAZILY (on first request) into a bounded LRU so RAM
# stays flat no matter how many world regions are available.
_BUCKET = os.getenv("REGIONS_BUCKET", "").strip()
_LRU_MAX = int(os.getenv("REGIONS_LRU_MAX", "10"))
_INDEX: list["RegionMeta"] = []          # lightweight {name, file, bbox}
_CACHE: "OrderedDict[str, Region]" = OrderedDict()   # file -> loaded Region (LRU)
_gcs_bucket = None

# A precomputed region's bbox is the whole municipality rectangle, which can
# include the sea or neighbouring towns it has no streets for. Only treat a
# point as "covered" if there's an actual node within this distance — otherwise
# the caller builds an on-demand tile at the real location instead of snapping
# the route to a far-away edge of the city.
_MAX_COVERAGE_GAP_M = 1200.0


class Region:
    """One precomputed city: a rustworkx dual graph + side-table arrays."""

    def __init__(self, data: dict):
        self.name = data["meta"]["place"]
        self.bbox = data["bbox"]  # [min_lat, min_lng, max_lat, max_lng]

        # Side tables, indexed by dual-node index.
        self.end_lat = np.asarray(data["end_lat"], dtype=float)
        self.end_lng = np.asarray(data["end_lng"], dtype=float)
        self.end_heading = np.asarray(data["end_heading"], dtype=float)
        self.length = np.asarray(data["length"], dtype=float)
        self.pleasant = np.asarray(
            data.get("pleasant", [False] * len(data["coords"])), dtype=bool
        )
        self.scenic = np.asarray(
            data.get("scenic", [False] * len(data["coords"])), dtype=bool
        )
        # Off-road/unpaved (dirt/field) segments — default False for older pickles.
        self.offroad = np.asarray(
            data.get("offroad", [False] * len(data["coords"])), dtype=bool
        )
        # Segments running ALONG a busy road (primary/secondary/trunk) — the
        # scorer prefers quieter routes among those that meet the turn cap.
        # Default False for older pickles built before this array existed.
        self.busy = np.asarray(
            data.get("busy", [False] * len(data["coords"])), dtype=bool
        )
        # Rough-paved: sett/cobblestones/metal — technically paved but unpleasant.
        self.rough = np.asarray(
            data.get("rough", [False] * len(data["coords"])), dtype=bool
        )
        # Edges with a mapped sidewalk or foot=designated/official.
        self.sidewalked = np.asarray(
            data.get("sidewalked", [False] * len(data["coords"])), dtype=bool
        )
        # Scenic "destination" anchors (lat,lng) the router aims candidates at.
        anchors = data.get("scenic_anchors") or []
        self.anchor_lat = np.asarray([a[0] for a in anchors], dtype=float)
        self.anchor_lng = np.asarray([a[1] for a in anchors], dtype=float)
        self.v_primal = data["v_primal"]
        self.node_useg = [tuple(s) for s in data["node_useg"]]
        self.coords = data["coords"]
        self.start_by_primal = data["start_by_primal"]

        # Primal node coords for nearest-node lookup.
        self.primal_nodes = data["primal_nodes"]
        self.primal_lat = np.asarray(data["primal_lat"], dtype=float)
        self.primal_lng = np.asarray(data["primal_lng"], dtype=float)

        # Build the rustworkx graph: node payload = its own index.
        g = rx.PyDiGraph(check_cycle=False, multigraph=False)
        g.add_nodes_from(list(range(len(self.coords))))
        # edge payload = (weight, undirected_seg_of_target)
        g.add_edges_from(
            [(f, t, (w, tuple(useg))) for (f, t, w, useg) in data["edges"]]
        )
        self.graph = g

    def contains(self, lat, lng) -> bool:
        a, b, c, d = self.bbox
        return a <= lat <= c and b <= lng <= d

    def center(self):
        a, b, c, d = self.bbox
        return ((a + c) / 2, (b + d) / 2)

    def _argmin_to(self, lats, lngs, lat, lng) -> int:
        # Cheap squared planar distance (fine for nearest within a city).
        dlat = lats - lat
        dlng = (lngs - lng) * np.cos(np.radians(lat))
        return int(np.argmin(dlat * dlat + dlng * dlng))

    def primal_index(self, lat, lng) -> int:
        return self._argmin_to(self.primal_lat, self.primal_lng, lat, lng)

    def nearest_node_to(self, point) -> int:
        return self._argmin_to(self.end_lat, self.end_lng, point[0], point[1])

    def coverage_gap_m(self, lat, lng) -> float:
        """Distance from (lat,lng) to the nearest covered street node (meters)."""
        i = self.primal_index(lat, lng)
        return haversine(
            (float(self.primal_lat[i]), float(self.primal_lng[i])), (lat, lng)
        )

    def anchors_for_reach(self, lat, lng, reach_m, k=8):
        """Scenic anchors near the loop's far reach (`reach_m` ≈ target/π), so a
        long loop aims at a *distant* landmark (the sea) rather than a local pond
        right next to the start. Returns (lat,lng) sorted by closeness to
        `reach_m`, within a [0.5, 1.25]·reach band (else the farthest available).
        """
        if self.anchor_lat.size == 0:
            return []
        dlat = self.anchor_lat - lat
        dlng = (self.anchor_lng - lng) * np.cos(np.radians(lat))
        d = np.sqrt(dlat * dlat + dlng * dlng) * 111_000.0  # deg → ~m
        idx = np.where((d >= 0.5 * reach_m) & (d <= 1.25 * reach_m))[0]
        if idx.size == 0:  # nothing at that range → take the farthest we have
            idx = np.argsort(d)[::-1][: k * 3]
        idx = idx[np.argsort(np.abs(d[idx] - reach_m))]  # closest to the reach
        return [(float(self.anchor_lat[j]), float(self.anchor_lng[j]))
                for j in idx[: k * 3]]


class RegionMeta:
    """Lightweight index entry — enough to pick a region without loading it."""

    __slots__ = ("name", "file", "bbox")

    def __init__(self, name, file, bbox):
        self.name = name
        self.file = file
        self.bbox = bbox  # [min_lat, min_lng, max_lat, max_lng]

    def contains(self, lat, lng) -> bool:
        a, b, c, d = self.bbox
        return a <= lat <= c and b <= lng <= d


# ---- storage backend (GCS bucket or local dir) ----------------------------

def _gcs():
    global _gcs_bucket
    if _gcs_bucket is None:
        from google.cloud import storage  # lazy import; only when a bucket is set
        _gcs_bucket = storage.Client().bucket(_BUCKET)
    return _gcs_bucket


def _read_bytes(name: str) -> bytes:
    """Read a region artifact ('index.json' / '<file>.pkl') from GCS or disk."""
    if _BUCKET:
        return _gcs().blob(name).download_as_bytes()
    with open(os.path.join(_REGIONS_DIR, name), "rb") as f:
        return f.read()


def _write_bytes(name: str, data: bytes, content_type: str | None = None) -> None:
    """Write a region artifact to GCS or disk (used by the build Job / markers)."""
    if _BUCKET:
        _gcs().blob(name).upload_from_string(data, content_type=content_type)
        return
    path = os.path.join(_REGIONS_DIR, name)
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)


# ---- on-demand tiles (built in the cloud, served lazily) -------------------
# On-demand tiles live under this prefix, separate from the precomputed base
# regions listed in index.json. Each tile has a sidecar JSON "marker" recording
# its build status so the server can show a "building…" state without a registry
# service. See route_engine/world_store.py (trigger) + build_job.py (builder).
_ONDEMAND_PREFIX = "ondemand/"


def read_marker(key: str) -> dict | None:
    """The build-state marker for an on-demand tile, or None if never built."""
    try:
        raw = _read_bytes(f"{_ONDEMAND_PREFIX}{key}.json")
    except Exception:  # noqa: BLE001 — missing marker → not built yet
        return None
    try:
        return json.loads(raw)
    except Exception:  # noqa: BLE001 — corrupt marker → treat as missing
        return None


def write_marker(key: str, payload: dict) -> None:
    """Record an on-demand tile's build state (status/updated_at/bbox/…)."""
    _write_bytes(
        f"{_ONDEMAND_PREFIX}{key}.json",
        json.dumps(payload).encode("utf-8"),
        content_type="application/json",
    )


def load_ondemand_file(file: str) -> "Region | None":
    """Load a ready on-demand tile pickle (by its full object name) into the LRU,
    or return it cached. None if the pickle isn't present (still building/failed)."""
    try:
        return _get_region(file)
    except Exception:  # noqa: BLE001 — pkl missing/unreadable
        return None


def load_ondemand(key: str) -> "Region | None":
    """Legacy helper: load the coord-named tile for `key` (older tiles that
    predate the readable filenames recorded in the marker's `file`)."""
    return load_ondemand_file(f"{_ONDEMAND_PREFIX}{key}.pkl")


def reload():
    """Re-read the base region index from storage without a restart (so a newly
    uploaded base city is picked up). Returns the new region count."""
    return len(load_all(_REGIONS_DIR))


def load_all(regions_dir: str = _REGIONS_DIR):
    """Load the region INDEX (not the regions themselves). Regions are fetched
    lazily on first use. Returns the list of RegionMeta. Resilient: an empty/
    missing index just means no precomputed coverage (everything on-demand)."""
    global _REGIONS_DIR, _INDEX, _CACHE
    _REGIONS_DIR = regions_dir
    _CACHE = OrderedDict()
    try:
        entries = json.loads(_read_bytes("index.json"))
    except Exception as exc:  # noqa: BLE001 — missing index → no precomputed regions
        print(f"region index unavailable ({exc}); precomputed coverage disabled")
        _INDEX = []
        return _INDEX
    _INDEX = [RegionMeta(e["name"], e["file"], e["bbox"]) for e in entries]
    src = f"gs://{_BUCKET}" if _BUCKET else regions_dir
    print(f"region index: {len(_INDEX)} regions from {src} (lazy LRU={_LRU_MAX})")
    return _INDEX


def regions():
    """Lightweight metadata for every available region (no graphs loaded)."""
    return _INDEX


def _get_region(file: str) -> "Region":
    """Return the loaded Region for `file`, fetching + caching (LRU) on a miss."""
    cached = _CACHE.get(file)
    if cached is not None:
        _CACHE.move_to_end(file)
        return cached
    region = Region(pickle.loads(_read_bytes(file)))
    _CACHE[file] = region
    _CACHE.move_to_end(file)
    while len(_CACHE) > _LRU_MAX:
        _CACHE.popitem(last=False)  # evict least-recently-used
    return region


def region_for(lat, lng):
    """Region that actually covers the point (bbox + a nearby street node),
    else None so the caller can build an on-demand tile. Loads candidates lazily."""
    for m in _INDEX:
        if not m.contains(lat, lng):
            continue
        try:
            r = _get_region(m.file)
        except Exception as exc:  # noqa: BLE001 — missing/corrupt pkl → skip, fall through to on-demand
            print(f"region {m.name!r}: skipping missing/unreadable pkl ({exc})")
            continue
        if r.coverage_gap_m(lat, lng) <= _MAX_COVERAGE_GAP_M:
            return r
    return None
