"""
Loads precomputed region pickles into fast in-memory rustworkx graphs and
serves region lookup. The API loads everything once at startup.
"""
from __future__ import annotations

import glob
import os
import pickle

import numpy as np
import rustworkx as rx

from .geo import haversine

_REGIONS_DIR = os.path.join(os.path.dirname(__file__), "regions")
_REGIONS: list["Region"] = []

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


def load_all(regions_dir: str = _REGIONS_DIR):
    """(Re)load every regions/*.pkl into memory. Returns the list of regions."""
    global _REGIONS
    _REGIONS = []
    for path in sorted(glob.glob(os.path.join(regions_dir, "*.pkl"))):
        with open(path, "rb") as f:
            _REGIONS.append(Region(pickle.load(f)))
    return _REGIONS


def regions():
    return _REGIONS


def region_for(lat, lng):
    """Region that actually covers the point (bbox + a nearby street node),
    else None so the caller can build an on-demand tile at the real location."""
    for r in _REGIONS:
        if r.contains(lat, lng) and r.coverage_gap_m(lat, lng) <= _MAX_COVERAGE_GAP_M:
            return r
    return None
