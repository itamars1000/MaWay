"""
Real-time loop router — regular polygon inscribed in the ideal circle.

Earlier approaches (two-phase out-and-back, or a 3-point triangle) gave narrow,
wandering loops with unpredictable length. Instead we inscribe a regular
N-gon in the circle whose size is tuned to the target distance, and route the
legs Start → W1 → W2 → ... → W(N-1) → Start. Short legs keep each one nearly
straight, so the result is a clean convex loop with a predictable distance.

  - shape:    convex polygon, no thin slivers
  - distance: iteratively scale the circle radius by target/actual until close
  - turns:    short straight legs + the baked-in kinematic turn penalty

N (waypoints) trades roundness vs. corner count: 4 = boxy/fewest corners,
6 = rounder/more corners. 5 is a good default.
"""
from __future__ import annotations

import math
import random
import time
from concurrent.futures import (
    ThreadPoolExecutor,
    TimeoutError as FuturesTimeout,
    as_completed,
)

import rustworkx as rx

from . import learning
from .geo import bearing as geo_bearing, destination, haversine, wrap180
from .geometry import feature_from_coords

BETA = 800.0
REUSE_PENALTY_M = 4000.0   # discourage retracing → return legs go parallel
N_WAYPOINTS = 4            # default single shape (square) for direct calls
# Shapes tried per request; the best is chosen. 2 = an out-and-back "lobe"
# (very few turns, narrow) which wins in maze cities like Be'er Sheva; 3/4 are
# wider loops that win in grid cities like Tel Aviv. The lobe is weighted
# heavily so hard cities get enough bearings to find a ≤3/km route.
WAYPOINT_OPTIONS = [2, 2, 2, 3, 4]
N_CANDIDATES = 18          # rotations tried; split across the shapes above.
MAX_CORRECTION_PASSES = 4
# Long loops have long, callback-heavy A* legs that the GIL serializes, so the
# per-request work and wall-time are scaled down with distance and bounded by a
# deadline (return best-so-far). Tuned so even a 21 km request comes back fast.
EARLY_STOP_GOOD = 3        # stop once this many qualifying candidates are in
# Landmark-seeking (aim at distant scenery) only matters for longer loops; short
# loops stay lean (no extra candidates) so their ≤3-turn search isn't crowded.
LANDMARK_MIN_M = 7000
# A returned loop must be at least the requested length (hard floor in
# find_loop_candidates). This is the upper sanity cap so it isn't wildly long.
DIST_BAND_HI = 1.6            # ≤ 160% of target
# Among routes that meet the turn cap, prefer accurate distance, then pleasant.
SCORE_W_TURNS = 0.50
SCORE_W_DIST = 0.38
SCORE_W_PLEASANT = 0.12
MAX_TURNS_PER_KM = 3.0     # hard quality cap returned to the client


class RouteError(RuntimeError):
    pass


# ---------------------------------------------------------------------------
# Geometry
# ---------------------------------------------------------------------------

def _polygon_waypoints(start_pt, radius_m, phi0, n):
    """
    Vertices of a regular n-gon inscribed in a circle that passes through the
    start. Center is one radius from the start along phi0; the start sits at
    angle (phi0 + 180) on the circle, and the other (n-1) vertices are spaced
    evenly around it.
    """
    center = destination(start_pt[0], start_pt[1], phi0, radius_m)
    start_angle = (phi0 + 180.0) % 360.0
    pts = []
    for i in range(1, n):
        ang = (start_angle + i * 360.0 / n) % 360.0
        pts.append(destination(center[0], center[1], ang, radius_m))
    return pts


# ---------------------------------------------------------------------------
# A* leg
# ---------------------------------------------------------------------------

def _leg_heuristic(region, goal_point, goal_bearing_deg, beta):
    """Non-negative estimate: distance-to-goal + misalignment penalty."""
    def est(idx):
        end = (region.end_lat[idx], region.end_lng[idx])
        diff = abs(wrap180(region.end_heading[idx] - goal_bearing_deg))
        align = max(0.0, math.cos(math.radians(diff)))
        return haversine(end, goal_point) + beta * (1.0 - align)
    return est


def _edge_cost(used):
    """Edge cost = baked-in weight + reuse penalty for already-used segments.
    Pushes return legs onto parallel streets instead of retracing."""
    if not used:
        return lambda e: e[0]
    return lambda e: e[0] + (REUSE_PENALTY_M if e[1] in used else 0.0)


def _run_leg(region, g, source, goal_fn, goal_point, goal_bearing_deg, beta, used):
    h = _leg_heuristic(region, goal_point, goal_bearing_deg, beta)
    try:
        path = list(
            rx.astar_shortest_path(g, source, goal_fn, _edge_cost(used), h)
        )
    except rx.NoPathFound:
        raise RouteError("leg search found no path")
    if not path:
        raise RouteError("empty leg path")
    return path


def _stitch(region, path):
    out = []
    for idx in path:
        seg = region.coords[idx]
        out.extend(seg if not out or out[-1] != seg[0] else seg[1:])
    return out


# ---------------------------------------------------------------------------
# One polygon loop (with iterative distance correction)
# ---------------------------------------------------------------------------

def _run_polygon(region, start_primal, start_pt, target_m, phi0, n, beta,
                 max_passes=MAX_CORRECTION_PASSES):
    g = region.graph
    seeds = (region.start_by_primal.get(start_primal)
             or region.start_by_primal.get(str(start_primal)))
    if not seeds:
        raise RouteError("no outgoing segments at start node")

    radius = target_m / (2.0 * math.pi)

    # Prefer the SMALLEST loop that is >= target (never go short, but don't
    # overshoot wildly); fall back to the LONGEST loop < target if no pass
    # reaches the requested length. `max_passes` is lowered for long routes
    # (each correction pass is several long, expensive A* legs).
    best_over = None      # (feat, dist) smallest distance >= target
    best_under = None     # (feat, dist) largest distance < target
    for _ in range(max_passes):
        waypoints = _polygon_waypoints(start_pt, radius, phi0, n)
        wp_idx = [region.nearest_node_to(wp) for wp in waypoints]

        # Seed with the outgoing segment pointing toward the first waypoint.
        source = min(
            seeds,
            key=lambda i: haversine(
                (region.end_lat[i], region.end_lng[i]), waypoints[0]
            ),
        )

        full = []
        prev_pt = start_pt
        cur = source
        used = set()           # segments already used → return legs go parallel
        ok = True
        for wp, widx in zip(waypoints, wp_idx):
            b = geo_bearing(prev_pt, wp)
            wp_goal = widx       # capture for the goal lambda
            try:
                leg = _run_leg(region, g, cur, lambda i, t=wp_goal: i == t,
                               wp, b, beta, used)
            except RouteError:
                ok = False
                break
            full = leg if not full else full + leg[1:]
            used |= {region.node_useg[i] for i in leg}
            cur = leg[-1]
            prev_pt = wp
        if not ok:
            break

        # Close the loop: last waypoint back to a segment ending at start node,
        # avoiding the streets already used (so it returns on a parallel route).
        b = geo_bearing(prev_pt, start_pt)
        try:
            closing = _run_leg(
                region, g, cur,
                lambda i: region.v_primal[i] == start_primal,
                start_pt, b, beta, used,
            )
        except RouteError:
            break
        full = full + closing[1:]

        feat = feature_from_coords(_stitch(region, full))
        # Fraction of the route length on pleasant (quiet/green) ways.
        seg_len = region.length
        total_len = sum(seg_len[i] for i in full) or 1.0
        pleasant_len = sum(seg_len[i] for i in full if region.pleasant[i])
        feat["properties"]["pleasant_frac"] = round(pleasant_len / total_len, 3)
        # Fraction of the route length that is scenic (near water / a park).
        scenic_len = sum(seg_len[i] for i in full if region.scenic[i])
        feat["properties"]["scenic_frac"] = round(scenic_len / total_len, 3)

        actual = feat["properties"]["distance_m"]
        if actual >= target_m:
            if best_over is None or actual < best_over[1]:
                best_over = (feat, actual)
            if actual <= 1.15 * target_m:
                break  # close enough from above — stop shrinking the radius
        else:
            if best_under is None or actual > best_under[1]:
                best_under = (feat, actual)
        # Aim slightly ABOVE target so the search converges from above, not below.
        factor = (1.03 * target_m) / max(actual, 1.0)
        radius *= factor  # rescale and try again

    best = best_over[0] if best_over else (best_under[0] if best_under else None)
    if best is None:
        raise RouteError("polygon routing failed")
    return best


# ---------------------------------------------------------------------------
# Via-point loop: a triangle start -> P -> Q -> start that passes through P
# ---------------------------------------------------------------------------

def _run_via_loop(region, start_primal, start_pt, target_m, via_pt, theta_deg,
                  beta, max_passes):
    """Loop that passes through the user point P. The third vertex Q rides an
    ellipse with foci {start, P} and sum-of-distances = (target - |start P|), so
    the perimeter stays ≈ target for any apex angle `theta_deg`; varying theta
    gives diverse shapes. Reuses `_run_leg` (+ reuse penalty) and the same
    distance-correction / scenic-fraction logic as `_run_polygon`."""
    g = region.graph
    seeds = (region.start_by_primal.get(start_primal)
             or region.start_by_primal.get(str(start_primal)))
    if not seeds:
        raise RouteError("no outgoing segments at start node")

    d = haversine(start_pt, via_pt)
    if d >= 0.5 * target_m:
        raise RouteError("via_too_far: point too far for a loop this length")

    p_node = region.nearest_node_to(via_pt)
    base = geo_bearing(start_pt, via_pt)
    th = math.radians(theta_deg)
    half = d / 2.0
    s = (target_m - d) / 2.0          # semi-major (each free side ~ s)

    best_over = None
    best_under = None
    for _ in range(max_passes):
        b_ax = math.sqrt(max(s * s - half * half, 0.0))   # ellipse semi-minor
        mid = destination(start_pt[0], start_pt[1], base, half)
        along = s * math.cos(th)       # signed offset along start→P axis
        perp = b_ax * math.sin(th)     # signed offset perpendicular
        p1 = destination(mid[0], mid[1],
                         base if along >= 0 else (base + 180.0) % 360.0,
                         abs(along))
        q = destination(p1[0], p1[1],
                        (base + 90.0) % 360.0 if perp >= 0 else (base - 90.0) % 360.0,
                        abs(perp))
        q_node = region.nearest_node_to(q)

        source = min(seeds, key=lambda i: haversine(
            (region.end_lat[i], region.end_lng[i]), via_pt))
        used = set()
        try:
            leg1 = _run_leg(region, g, source, lambda i, t=p_node: i == t,
                            via_pt, base, beta, used)
            used |= {region.node_useg[i] for i in leg1}
            leg2 = _run_leg(region, g, leg1[-1], lambda i, t=q_node: i == t,
                            q, geo_bearing(via_pt, q), beta, used)
            used |= {region.node_useg[i] for i in leg2}
            leg3 = _run_leg(region, g, leg2[-1],
                            lambda i: region.v_primal[i] == start_primal,
                            start_pt, geo_bearing(q, start_pt), beta, used)
        except RouteError:
            break
        full = leg1 + leg2[1:] + leg3[1:]

        feat = feature_from_coords(_stitch(region, full))
        seg_len = region.length
        total_len = sum(seg_len[i] for i in full) or 1.0
        feat["properties"]["pleasant_frac"] = round(
            sum(seg_len[i] for i in full if region.pleasant[i]) / total_len, 3)
        feat["properties"]["scenic_frac"] = round(
            sum(seg_len[i] for i in full if region.scenic[i]) / total_len, 3)
        feat["properties"]["via_ok"] = True

        actual = feat["properties"]["distance_m"]
        if actual >= target_m:
            if best_over is None or actual < best_over[1]:
                best_over = (feat, actual)
            if actual <= 1.15 * target_m:
                break
        else:
            if best_under is None or actual > best_under[1]:
                best_under = (feat, actual)
        factor = (1.03 * target_m) / max(actual, 1.0)
        s = max(half + 1.0, s * factor)   # keep s > half so the ellipse is real

    best = best_over[0] if best_over else (best_under[0] if best_under else None)
    if best is None:
        raise RouteError("no_via: could not route a loop through the point")
    return best


# ---------------------------------------------------------------------------
# A→B path: start -> (detour W) -> end, ~target length
# ---------------------------------------------------------------------------

def _run_path(region, start_primal, start_pt, end_primal, end_pt, target_m,
              theta_deg, beta, max_passes):
    """A→B route of ~target length. If the direct A→B is already ≥ target, return
    it (flagged `direct_only`). Otherwise pad with a detour waypoint W on the
    ellipse with foci {A,B} (sum-of-legs = target), so |A W|+|W B| ≈ target;
    varying `theta_deg` gives diverse detours. Reuses `_run_leg`/`_stitch`."""
    g = region.graph
    seeds = (region.start_by_primal.get(start_primal)
             or region.start_by_primal.get(str(start_primal)))
    if not seeds:
        raise RouteError("no outgoing segments at start node")

    def _build(full, direct_only=False):
        feat = feature_from_coords(_stitch(region, full))
        seg_len = region.length
        total_len = sum(seg_len[i] for i in full) or 1.0
        feat["properties"]["pleasant_frac"] = round(
            sum(seg_len[i] for i in full if region.pleasant[i]) / total_len, 3)
        feat["properties"]["scenic_frac"] = round(
            sum(seg_len[i] for i in full if region.scenic[i]) / total_len, 3)
        if direct_only:
            feat["properties"]["direct_only"] = True
        return feat

    d = haversine(start_pt, end_pt)

    # Endpoints already ≥ the requested length apart → just route the direct path.
    if d >= target_m:
        source = min(seeds, key=lambda i: haversine(
            (region.end_lat[i], region.end_lng[i]), end_pt))
        leg = _run_leg(region, g, source,
                       lambda i: region.v_primal[i] == end_primal,
                       end_pt, geo_bearing(start_pt, end_pt), beta, set())
        return _build(leg, direct_only=True)

    # Pad to target with a detour waypoint W on the ellipse (foci A, B; 2a=target).
    base = geo_bearing(start_pt, end_pt)
    th = math.radians(theta_deg)
    half = d / 2.0
    s = target_m / 2.0       # semi-major
    best_over = None
    best_under = None
    for _ in range(max_passes):
        b_ax = math.sqrt(max(s * s - half * half, 0.0))
        mid = destination(start_pt[0], start_pt[1], base, half)
        along = s * math.cos(th)
        perp = b_ax * math.sin(th)
        p1 = destination(mid[0], mid[1],
                         base if along >= 0 else (base + 180.0) % 360.0, abs(along))
        w = destination(p1[0], p1[1],
                        (base + 90.0) % 360.0 if perp >= 0 else (base - 90.0) % 360.0,
                        abs(perp))
        w_node = region.nearest_node_to(w)

        source = min(seeds, key=lambda i: haversine(
            (region.end_lat[i], region.end_lng[i]), w))
        used = set()
        try:
            leg1 = _run_leg(region, g, source, lambda i, t=w_node: i == t,
                            w, geo_bearing(start_pt, w), beta, used)
            used |= {region.node_useg[i] for i in leg1}
            leg2 = _run_leg(region, g, leg1[-1],
                            lambda i: region.v_primal[i] == end_primal,
                            end_pt, geo_bearing(w, end_pt), beta, used)
        except RouteError:
            break
        feat = _build(leg1 + leg2[1:])
        actual = feat["properties"]["distance_m"]
        if actual >= target_m:
            if best_over is None or actual < best_over[1]:
                best_over = (feat, actual)
            if actual <= 1.15 * target_m:
                break
        else:
            if best_under is None or actual > best_under[1]:
                best_under = (feat, actual)
        factor = (1.03 * target_m) / max(actual, 1.0)
        s = max(half + 1.0, s * factor)

    best = best_over[0] if best_over else (best_under[0] if best_under else None)
    if best is None:
        raise RouteError("no_path: could not route from A to B at this length")
    return best


# ---------------------------------------------------------------------------
# Candidates
# ---------------------------------------------------------------------------

# The hard floor already guarantees distance >= target, and a bit longer is
# fine — so penalise OVERSHOOT gently. This lets a scenic route that bulges out
# to the coast (and runs a touch long) win over a bland, exactly-on-target one.
OVERSHOOT_PENALTY = 0.45


def route_features(feature, target_m):
    """Badness features in [0,~1] (0 = great). Shared by scorer + learner."""
    p = feature["properties"]
    d = p["distance_m"]
    over = d - target_m
    dist_bad = (over * OVERSHOOT_PENALTY if over >= 0 else -over) / max(target_m, 1.0)
    return {
        "turns": p["sharp_turns_per_km"] / 8.0,
        "dist": dist_bad,
        "pleasant": 1.0 - p.get("pleasant_frac", 0.0),
        "scenic": 1.0 - p.get("scenic_frac", 0.0),
    }


def _score(feature, target_m):
    """Lower is better. Weights are learned from 👍/👎 feedback (blended with
    the hand-tuned defaults until enough feedback accumulates)."""
    f = route_features(feature, target_m)
    w = learning.get_weights()
    return (
        w["turns"] * f["turns"]
        + w["dist"] * f["dist"]
        + w["pleasant"] * f["pleasant"]
        + w.get("scenic", 0.0) * f["scenic"]
    )


def _budget_for(target_m):
    """Per-request work + wall-time budget, scaled to distance. Long loops have
    long A* legs, so use fewer candidates/passes and a longer (but bounded)
    deadline; short loops get the full search and a tight deadline."""
    km = target_m / 1000.0
    if km <= 8:
        return N_CANDIDATES, MAX_CORRECTION_PASSES, 4.0
    if km <= 14:
        return 12, 2, 6.0
    return 8, 2, 8.0


def find_loop_candidates(region, lat, lng, target_m, n=None,
                         seed=None, beta=BETA, waypoints=None, via_pt=None,
                         end_pt=None):
    rng = random.Random(seed)

    auto_n, max_passes, deadline_s = _budget_for(target_m)
    n = n or auto_n

    pi = region.primal_index(lat, lng)
    start_primal = region.primal_nodes[pi]
    start_pt = (float(region.primal_lat[pi]), float(region.primal_lng[pi]))

    if end_pt is not None:
        # A→B mode: path of ~target length from start to the end point. Diverse
        # detours via different apex angles; a direct path when they're already
        # ≥ target apart (flagged direct_only).
        epi = region.primal_index(end_pt[0], end_pt[1])
        end_primal = region.primal_nodes[epi]
        thetas = [90.0, -90.0, 70.0, -70.0, 110.0, -110.0]
        tasks = [
            (lambda th=th: _run_path(
                region, start_primal, start_pt, end_primal, end_pt, target_m,
                th, beta, max_passes))
            for th in thetas
        ]
        n_landmark = 0
    elif via_pt is not None:
        # Via-mode: triangle loops that pass THROUGH the user point. Different
        # apex angles give diverse shapes (all ~target perimeter). Fail fast with
        # a clear token if the point can't fit a loop of this length.
        if haversine(start_pt, via_pt) >= 0.5 * target_m:
            raise RouteError("via_too_far: point too far for a loop this length")
        thetas = [90.0, -90.0, 70.0, -70.0, 110.0, -110.0]
        tasks = [
            (lambda th=th: _run_via_loop(
                region, start_primal, start_pt, target_m, via_pt, th,
                beta, max_passes))
            for th in thetas
        ]
        n_landmark = 0
    else:
        # Try several polygon shapes per request: a square (4) is cleanest in
        # grid cities like Tel Aviv, a triangle (3) needs fewer turns in maze-like
        # cities like Be'er Sheva. Scoring picks whichever wins for this start.
        shape_options = [waypoints] if waypoints else WAYPOINT_OPTIONS
        step = 360.0 / n
        geom_specs = [((i * step + rng.uniform(-step / 4, step / 4)) % 360.0,
                       shape_options[i % len(shape_options)])
                      for i in range(n)]

        # Landmark-seeking: ADD a few candidates aimed at distant scenic anchors
        # (sea/river/park at the loop's far reach ~target/π from start). EXTRA —
        # they don't replace the geometric candidates, so the ≤3-turn hit rate is
        # preserved; scenic is only *preferred among* those that qualify.
        reach_m = target_m / math.pi
        anchor_bearings = []
        if target_m > LANDMARK_MIN_M:
            for a in region.anchors_for_reach(start_pt[0], start_pt[1], reach_m, k=8):
                b = geo_bearing(start_pt, a)
                if all(abs(wrap180(b - ub)) >= 30.0 for ub in anchor_bearings):
                    anchor_bearings.append(b)
                if len(anchor_bearings) >= 3:
                    break
        landmark_specs = [(b, shape_options[i % len(shape_options)])
                          for i, b in enumerate(anchor_bearings)]
        # Landmark first so they're submitted first and waited for (pool below).
        specs = landmark_specs + geom_specs
        tasks = [
            (lambda b=b, wp=wp: _run_polygon(
                region, start_primal, start_pt, target_m, b, wp, beta, max_passes))
            for (b, wp) in specs
        ]
        n_landmark = len(landmark_specs)

    def _qualifies(f):
        p = f["properties"]
        return (p["distance_m"] >= target_m
                and p["sharp_turns_per_km"] <= MAX_TURNS_PER_KM)

    # Run the candidates in parallel but bound the wall time: collect whatever
    # finishes before the deadline (or once enough qualifying ones are in), and
    # never block on stragglers (shutdown(wait=False)). Returns best-so-far.
    # The first `len(anchor_bearings)` specs are landmark-seeking (longer legs to
    # a distant landmark), so DON'T early-stop until they're in — otherwise the
    # fast local loops finish first and the scenic ones never get collected.
    results = []
    t0 = time.monotonic()
    pool = ThreadPoolExecutor(max_workers=min(len(tasks), 8))
    try:
        futures = {pool.submit(t): i for i, t in enumerate(tasks)}
        pending_landmark = set(range(n_landmark))
        # Soft deadline = the target wall time; hard cap = absolute max. We keep
        # searching past the soft deadline if NO qualifying (≤3, ≥target) route
        # has been found yet — so a hard start that just needs more candidates
        # isn't given a >3 best-effort route prematurely.
        hard_cap = deadline_s * 1.5
        try:
            for fut in as_completed(futures, timeout=hard_cap):
                pending_landmark.discard(futures[fut])
                try:
                    feat = fut.result()
                    feat["properties"]["region"] = region.name
                    results.append(feat)
                except RouteError:
                    pass
                good_n = sum(1 for f in results if _qualifies(f))
                elapsed = time.monotonic() - t0
                if not pending_landmark:
                    if good_n >= EARLY_STOP_GOOD:
                        break                       # plenty — fast path
                    if good_n >= 1 and elapsed >= deadline_s:
                        break                       # have one, past soft deadline
                if elapsed >= hard_cap:
                    break
        except FuturesTimeout:
            pass  # hard cap hit — use whatever completed
    finally:
        pool.shutdown(wait=False, cancel_futures=True)

    if not results:
        raise RouteError("all polygon candidates failed")

    results.sort(key=lambda f: _score(f, target_m))

    # HARD LENGTH FLOOR: never return a route shorter than requested. Keep an
    # upper sanity cap so we don't return a wildly long loop either.
    hi = DIST_BAND_HI * target_m
    meets = [f for f in results
             if target_m <= f["properties"]["distance_m"] <= hi]

    if meets:
        # Among routes that are long enough, prefer those at/under the turn cap;
        # if none qualify (maze city), return the best-scored long-enough ones.
        good = [f for f in meets
                if f["properties"]["sharp_turns_per_km"] <= MAX_TURNS_PER_KM]
        return good if good else meets[:3]

    # No route here reaches the requested length → return the LONGEST available
    # (closest from below), flagged so the UI says it's shorter than requested.
    longest = sorted(results, key=lambda f: f["properties"]["distance_m"],
                     reverse=True)[:3]
    for f in longest:
        f["properties"]["below_requested"] = (
            f["properties"]["distance_m"] < target_m
        )
    return longest


def find_loop(region, lat, lng, target_m, seed=None, beta=BETA):
    return find_loop_candidates(region, lat, lng, target_m, seed=seed, beta=beta)[0]
