"""
Step 3b: two-phase A* on the dual graph that produces a closed loop.

Why two phases? A plain A* from the start segment back to the start node would
return the empty path (cost 0). To build a *loop* of ~target distance we:

  Phase A (outbound): from the start, search toward the circle's far point,
      stopping once we've covered about half the target distance. Record the
      primal edges used.
  Phase B (return):   from where Phase A ended, search back to the start node,
      but add a big penalty for reusing Phase-A edges so the return leg takes a
      *different* path. Concatenating A + B yields a genuine loop (not an
      out-and-back), and the half/half split keeps the total near the target.
"""
from __future__ import annotations

import heapq
import itertools

REUSE_PENALTY_M = 5000.0  # discourage (not forbid) retracing the outbound leg


def _undirected(nid):
    """Identify a segment regardless of travel direction (u, v, key)."""
    u, v, key = nid
    return (min(u, v), max(u, v), key)


def _astar(DG, info, starts, goal_fn, h, edge_extra=None, max_pops=300_000):
    """
    Generic A* over the dual graph.

    starts   : iterable of dual-node ids to seed from
    goal_fn  : (nid, dist_m) -> bool ; dist_m is summed segment LENGTH only
    h        : (nid) -> float heuristic
    edge_extra: optional (from_nid, to_nid) -> extra cost (e.g. reuse penalty)
    Returns (path, dist_m) or (None, None).
    """
    counter = itertools.count()
    pq = []
    for s in starts:
        g0 = info[s]["length"]
        heapq.heappush(pq, (g0 + h(s), g0, g0, next(counter), s, (s,)))

    best = {}  # nid -> best cost seen
    pops = 0
    while pq and pops < max_pops:
        f, cost, dist, _, node, path = heapq.heappop(pq)
        pops += 1
        if goal_fn(node, dist):
            return list(path), dist
        if node in best and best[node] <= cost:
            continue
        best[node] = cost
        for nxt in DG.successors(node):
            w = DG[node][nxt]["weight"]
            if edge_extra is not None:
                w += edge_extra(node, nxt)
            ncost = cost + w
            ndist = dist + info[nxt]["length"]
            heapq.heappush(
                pq,
                (ncost + h(nxt), ncost, ndist, next(counter), nxt, path + (nxt,)),
            )
    return None, None


def two_phase_loop(DG, info, start_node, field, target_m, h_factory):
    """
    Run the outbound and return phases and return the combined dual-node path.
    `h_factory(goal_point)` builds a heuristic aimed at `goal_point`.
    """
    starts = [nid for nid in DG.nodes if info[nid]["u"] == start_node]
    if not starts:
        raise RuntimeError("Start node has no outgoing segments.")

    # --- Phase A: outbound toward the far point, ~half the distance ----------
    half = target_m / 2.0
    h_out = h_factory(field.far_point)
    path_a, dist_a = _astar(
        DG,
        info,
        starts,
        goal_fn=lambda nid, d: d >= half,
        h=h_out,
    )
    if path_a is None:
        raise RuntimeError("Outbound search failed to reach half distance.")

    used = {_undirected(nid) for nid in path_a}

    # --- Phase B: return to the start node, avoiding reused segments ---------
    h_back = h_factory(field.start)
    end_node = path_a[-1]

    def reuse_extra(_from, to):
        return REUSE_PENALTY_M if _undirected(to) in used else 0.0

    path_b, dist_b = _astar(
        DG,
        info,
        [end_node],
        goal_fn=lambda nid, d: info[nid]["v"] == start_node,
        h=h_back,
        edge_extra=reuse_extra,
    )
    if path_b is None:
        raise RuntimeError("Return search failed to reach the start node.")

    # Stitch (path_b[0] == end_node == path_a[-1]).
    return list(path_a) + list(path_b[1:])
