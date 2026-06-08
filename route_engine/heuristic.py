"""
Step 3a: the "ideal shape" vector field that pulls the A* search into a loop.

We define a circle whose circumference equals the target distance:

    R = target / (2*pi)

The circle passes through the start and is centered one radius away along a
chosen primary bearing phi0. The point diametrically opposite the start
(`far_point`) is the natural turn-around for the two-phase search.

At any location the field has a **tangent** direction (perpendicular to the
radius from the circle center). Rewarding segments whose heading aligns with
this tangent nudges the path to curve around the circle instead of cutting
straight across — which is what turns an out-and-back into a round loop.
"""
from __future__ import annotations

import math

from .geo import bearing, destination, haversine, wrap180


class VectorField:
    def __init__(self, start, target_m: float, phi0: float):
        self.start = start  # (lat, lng)
        self.R = target_m / (2.0 * math.pi)
        # Circle center one radius away; far point two radii away (antipode).
        self.center = destination(start[0], start[1], phi0, self.R)
        self.far_point = destination(start[0], start[1], phi0, 2.0 * self.R)

    def tangent_bearing(self, point) -> float:
        """Desired travel heading at `point`: the radius rotated +90° (CW loop)."""
        radial = bearing(self.center, point)
        return (radial + 90.0) % 360.0

    def alignment(self, point, heading_deg: float) -> float:
        """cos of the angle between a segment heading and the local tangent (0..1+)."""
        diff = wrap180(heading_deg - self.tangent_bearing(point))
        return math.cos(math.radians(diff))


def make_heuristic(info, field: VectorField, goal_point, beta: float = 120.0):
    """
    Build h(dual_node) for A*:  distance-to-goal minus a tangent-alignment
    reward. Lower h = more promising. This is *guidance* (greedy best-first
    flavour), not an admissible lower bound, so the result is a good loop rather
    than a proven optimum.
    """
    def h(nid) -> float:
        meta = info[nid]
        end = meta["coords"][-1]
        dist = haversine(end, goal_point)
        align = max(0.0, field.alignment(end, meta["end_heading"]))
        return dist - beta * align

    return h
