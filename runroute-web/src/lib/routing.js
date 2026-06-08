// Real route generation via OpenRouteService (ORS).
//
// Strategy ("virtual equilateral triangle"):
//   1. From the start point + target distance, set each triangle leg
//      L = targetDistance / 3.
//   2. Pick a random starting bearing (0-360°).
//   3. Compute 2 virtual waypoints with the destination-point formula so that
//      Start, WP1, WP2 form a perfect equilateral triangle (all sides L).
//   4. Request a normal foot-hiking Directions route through the ordered points
//      [Start -> WP1 -> WP2 -> Start] with preference:"fastest" (avoids the
//      micro-shortcuts that round_trip tends to produce).
//   5. Do this for several random bearings in parallel → distinct loops.
//   6. Score each loop from its geometry (sharp-turn density + clustering),
//      drop self-intersecting (figure-8) loops via Turf.js, and pick the
//      straightest with the best distance accuracy.
//
// SECURITY NOTE: the key is read from import.meta.env.VITE_ORS_API_KEY and is
// therefore visible in the browser's network requests. That's fine for a
// personal/dev app; for production, proxy this call through a small backend.
// Get a free key at https://openrouteservice.org/dev/#/signup

import { kinks } from '@turf/kinks';
import { lineString } from '@turf/helpers';

// foot-hiking favours paths/parks/trails — straighter, calmer loops.
const ENDPOINT =
  'https://api.openrouteservice.org/v2/directions/foot-hiking/geojson';

// Number of parallel triangle loops (each a different random bearing).
export const CANDIDATE_COUNT = 3;

const EARTH_RADIUS_M = 6371000;

// --- Turn-analysis tuning ---------------------------------------------------
// Resample spacing: ORS emits many tiny vertices along a single street; we
// down-sample to this spacing so a gentle curve isn't read as many turns.
const RESAMPLE_SPACING_M = 25;
// A heading change at/above this is a "sharp" turn (~a right-angle corner).
const SHARP_TURN_DEG = 70;
// Two sharp turns closer than this are a penalising "cluster" (zig-zag).
const CLUSTER_DISTANCE_M = 300;
// Average sharp turns/km at/below this counts as a calm, direct route (UI flag).
const TARGET_TURNS_PER_KM = 3;

// Selection weights (sum = 1): turns matter more than exact distance.
const WEIGHTS = { turns: 0.6, distance: 0.4 };

/** Error with a stable `code` so the UI can show a friendly Hebrew message. */
export class RoutingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RoutingError';
    this.code = code; // 'no-key' | 'no-start' | 'http' | 'empty' | 'network'
  }
}

// --- Geometry: virtual equilateral triangle ---------------------------------

/**
 * Destination point given a start, bearing and distance (great-circle formula).
 * φ = latitude (rad), λ = longitude (rad), δ = angular distance, θ = bearing.
 */
function destinationPoint(lat, lng, bearingDeg, distanceM) {
  const δ = distanceM / EARTH_RADIUS_M;
  const θ = (bearingDeg * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lng * Math.PI) / 180;

  const sinφ2 =
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);
  const y = Math.sin(θ) * Math.sin(δ) * Math.cos(φ1);
  const x = Math.cos(δ) - Math.sin(φ1) * sinφ2;
  const λ2 = λ1 + Math.atan2(y, x);

  return {
    lat: (φ2 * 180) / Math.PI,
    lng: (((λ2 * 180) / Math.PI + 540) % 360) - 180, // normalise to [-180,180)
  };
}

/**
 * Build the ordered ORS coordinates for an equilateral triangle loop.
 * WP1 and WP2 sit at distance L from the start on bearings θ and θ+60°, so the
 * angle at the start is 60° and all three sides equal L (equilateral). The
 * traversal Start -> WP1 -> WP2 -> Start has perimeter 3·L = targetDistance.
 * @returns {Array<[number,number]>} [lng,lat] points for the request body.
 */
function buildTriangle(start, targetMeters, bearingDeg) {
  const L = targetMeters / 3;
  const wp1 = destinationPoint(start.lat, start.lng, bearingDeg, L);
  const wp2 = destinationPoint(start.lat, start.lng, bearingDeg + 60, L);
  return [
    [start.lng, start.lat],
    [wp1.lng, wp1.lat],
    [wp2.lng, wp2.lat],
    [start.lng, start.lat],
  ];
}

// --- ORS request ------------------------------------------------------------

/** Route through one triangle's ordered waypoints → a parsed candidate. */
async function requestTriangleRoute({ key, start, distanceKm, bearing, signal }) {
  const coordinates = buildTriangle(start, distanceKm * 1000, bearing);

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      signal,
      headers: {
        Authorization: key,
        'Content-Type': 'application/json',
        Accept: 'application/geo+json',
      },
      body: JSON.stringify({
        coordinates, // [Start, WP1, WP2, Start]
        preference: 'fastest', // avoid micro-shortcuts
      }),
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new RoutingError('network', 'Network error');
  }

  if (!res.ok) throw new RoutingError('http', `ORS responded ${res.status}`);

  const data = await res.json();
  const feature = data?.features?.[0];
  const line = feature?.geometry?.coordinates; // [[lng, lat], ...]
  if (!Array.isArray(line) || line.length < 3) {
    throw new RoutingError('empty', 'No route returned');
  }

  const summary = feature.properties?.summary ?? {};
  return {
    lngLat: line, // raw GeoJSON order, for Turf self-intersection
    coords: line.map(([lng, lat]) => [lat, lng]), // Leaflet order [lat, lng]
    distanceKm: (summary.distance ?? 0) / 1000,
    durationMin: (summary.duration ?? 0) / 60,
  };
}

// --- Geometry helpers (turn analysis) ---------------------------------------

// Equirectangular projection to local meters (accurate enough at city scale).
function toMeters(coords) {
  const lat0 = (coords[0][0] * Math.PI) / 180;
  const mPerDegLat = 110540;
  const mPerDegLng = 111320 * Math.cos(lat0);
  return coords.map(([lat, lng]) => [lng * mPerDegLng, lat * mPerDegLat]);
}

// Down-sample a projected polyline to a minimum point spacing, carrying the
// cumulative along-route distance for each kept point.
function resample(points, spacing) {
  const out = [{ x: points[0][0], y: points[0][1], dist: 0 }];
  let cum = 0;
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i];
    const last = out[out.length - 1];
    cum += Math.hypot(x - last.x, y - last.y);
    if (cum - last.dist >= spacing) out.push({ x, y, dist: cum });
  }
  return out;
}

/**
 * Turn angle at point B for the triple A→B→C: the heading change from A→B to
 * B→C ("deflection"). 0° = straight, 90° = right-angle corner, ~180° = U-turn.
 * Computed as |atan2(v1 × v2, v1 · v2)|, which is robust and sign-free. A turn
 * is "sharp" once the deflection reaches SHARP_TURN_DEG.
 */
function deflectionDeg(a, b, c) {
  const v1x = b.x - a.x;
  const v1y = b.y - a.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const cross = v1x * v2y - v1y * v2x;
  const dot = v1x * v2x + v1y * v2y;
  return Math.abs((Math.atan2(cross, dot) * 180) / Math.PI);
}

/**
 * Analyse a route's geometry for sharp turns and their clustering.
 * `clusters` = consecutive sharp-turn pairs spaced closer than
 * CLUSTER_DISTANCE_M (tight zig-zags feel worse than the same turns spread out).
 */
function analyzeTurns(coords, distanceKm) {
  const pts = resample(toMeters(coords), RESAMPLE_SPACING_M);
  if (pts.length < 3) {
    return { sharpTurns: 0, sharpTurnsPerKm: 0, clusters: 0 };
  }

  const sharpAt = []; // cumulative distances (m) of each sharp turn
  for (let i = 1; i < pts.length - 1; i++) {
    if (deflectionDeg(pts[i - 1], pts[i], pts[i + 1]) >= SHARP_TURN_DEG) {
      sharpAt.push(pts[i].dist);
    }
  }

  let clusters = 0;
  for (let i = 1; i < sharpAt.length; i++) {
    if (sharpAt[i] - sharpAt[i - 1] < CLUSTER_DISTANCE_M) clusters++;
  }

  const km = Math.max(distanceKm, 0.1);
  return {
    sharpTurns: sharpAt.length,
    sharpTurnsPerKm: sharpAt.length / km,
    clusters,
  };
}

/** True if the loop crosses itself (figure-8) — disqualifying. */
function selfIntersects(lngLat) {
  try {
    // kinks finds where non-adjacent segments cross. A clean loop only touches
    // at its shared start/end point (not a crossing) → 0 kinks.
    return kinks(lineString(lngLat)).features.length > 0;
  } catch {
    return false; // never disqualify on an analysis error
  }
}

// --- Scoring & selection ----------------------------------------------------

/**
 * Score a candidate (higher = better):
 *  - turnScore: 1/(1 + sharpTurns/km + ½·clusters/km) → rewards few, spread turns.
 *  - distanceScore: 1 − |actual − target|/target      → rewards distance accuracy.
 */
function scoreCandidate(candidate, targetKm) {
  const { sharpTurns, sharpTurnsPerKm, clusters } = analyzeTurns(
    candidate.coords,
    candidate.distanceKm,
  );
  const clustersPerKm = clusters / Math.max(candidate.distanceKm, 0.1);

  const turnScore = 1 / (1 + sharpTurnsPerKm + 0.5 * clustersPerKm);
  const distanceScore = Math.max(
    0,
    1 - Math.abs(candidate.distanceKm - targetKm) / targetKm,
  );
  const score = WEIGHTS.turns * turnScore + WEIGHTS.distance * distanceScore;

  return {
    ...candidate,
    turns: sharpTurns, // shown in the UI as "פניות" (sharp turns)
    turnsPerKm: sharpTurnsPerKm,
    clusters,
    meetsTurnTarget: sharpTurnsPerKm <= TARGET_TURNS_PER_KM,
    score,
    breakdown: { turnScore, distanceScore },
  };
}

// --- Public API -------------------------------------------------------------

/**
 * Generate triangle-based candidate loops, drop self-intersecting ones, and
 * return the rest ranked best-first (fewest sharp turns + best distance).
 * @returns {Promise<Array<{coords,distanceKm,durationMin,turns,turnsPerKm,meetsTurnTarget,score}>>}
 */
export async function generateSmartRoutes({
  start,
  distanceKm,
  signal,
  count = CANDIDATE_COUNT,
}) {
  const key = import.meta.env.VITE_ORS_API_KEY;
  if (!key) throw new RoutingError('no-key', 'Missing VITE_ORS_API_KEY');
  if (!start) throw new RoutingError('no-start', 'No start position');

  // Distinct random bearings → triangles pointing in different directions.
  const bearings = Array.from({ length: count }, () => Math.random() * 360);
  const settled = await Promise.allSettled(
    bearings.map((bearing) =>
      requestTriangleRoute({ key, start, distanceKm, bearing, signal }),
    ),
  );

  // If aborted, surface that so the hook can ignore the result.
  if (settled.some((s) => s.status === 'rejected' && s.reason?.name === 'AbortError')) {
    const e = new Error('Aborted');
    e.name = 'AbortError';
    throw e;
  }

  const ok = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value);
  if (ok.length === 0) {
    const firstErr = settled.find((s) => s.status === 'rejected')?.reason;
    throw firstErr instanceof RoutingError
      ? firstErr
      : new RoutingError('http', 'All candidates failed');
  }

  // Disqualify self-intersecting loops; fall back to the full set only if that
  // would leave nothing to show.
  const clean = ok.filter((c) => !selfIntersects(c.lngLat));
  const pool = clean.length ? clean : ok;

  const ranked = pool
    .map((c) => scoreCandidate(c, distanceKm))
    .sort((a, b) => b.score - a.score);

  // TEMP-DEBUG: verification only.
  if (typeof window !== 'undefined') {
    window.__routeDebug = {
      ok: ok.length,
      clean: clean.length,
      ranked: ranked.map((r) => ({
        km: Number(r.distanceKm.toFixed(2)),
        sharpTurns: r.turns,
        perKm: Number(r.turnsPerKm.toFixed(2)),
        score: Number(r.score.toFixed(3)),
      })),
    };
  }

  return ranked;
}
