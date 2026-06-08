// Client for the Python route engine (FastAPI). Returns a ranked candidate
// array (matching the state contract) so the UI can cycle with "מסלול הבא".
//
// Configure the base URL via VITE_ENGINE_URL (defaults to localhost:8000).

const BASE = import.meta.env.VITE_ENGINE_URL || 'http://localhost:8000';

// Safety net so the UI never hangs forever. The engine itself is time-budgeted
// (~sub-second to ~8 s); this only bites on a stuck/very slow build.
const REQUEST_TIMEOUT_MS = 45000;

/** Error with a stable `code` so the UI can show a friendly Hebrew message. */
export class EngineError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'EngineError';
    this.code = code; // 'no-start' | 'offline' | 'http' | 'empty'
  }
}

/** Convert one GeoJSON Feature → the candidate shape the UI expects. */
function featureToCandidate(feature) {
  const line = feature?.geometry?.coordinates;
  if (!Array.isArray(line) || line.length < 2) return null;

  const coords = line.map(([lng, lat]) => [lat, lng]); // GeoJSON → Leaflet
  const p = feature.properties ?? {};
  const distance = (p.distance_m ?? 0) / 1000;
  const turnsPerKm = p.sharp_turns_per_km ?? 0;

  return {
    coords,
    distanceKm: distance,
    durationMin: distance * 6, // ~6 min/km running estimate
    turns: p.sharp_turns ?? 0,
    turnsPerKm,
    meetsTurnTarget: turnsPerKm <= 3,
    pleasantFrac: p.pleasant_frac ?? 0,
    scenicFrac: p.scenic_frac ?? 0,
    belowRequested: p.below_requested ?? false,
    directOnly: p.direct_only ?? false,
    ascentM: p.ascent_m ?? null,
    descentM: p.descent_m ?? null,
    score: 1,
  };
}

/**
 * Ask the engine for the loop candidates that meet the ≤3 turns/km bar
 * (the server tries many rotations and returns only the qualifying ones,
 * best-first). Returns a non-empty array so the UI can cycle with "מסלול הבא",
 * or throws EngineError('no-quality') when the area has none.
 */
export async function generateFromEngine({ start, distanceKm, via, end, signal }) {
  if (!start) throw new EngineError('no-start', 'No start position');
  if (end && !(end.lat && end.lng)) throw new EngineError('no-end', 'No end position');

  const params = new URLSearchParams({
    lat: String(start.lat),
    lng: String(start.lng),
    distance: String(Math.round(distanceKm * 1000)),
    seed: String(Math.floor(Math.random() * 1e6)),
  });
  if (end) {
    params.set('end_lat', String(end.lat));
    params.set('end_lng', String(end.lng));
  } else if (via) {
    params.set('via_lat', String(via.lat));
    params.set('via_lng', String(via.lng));
  }

  // Combine the caller's abort signal (used to supersede an older request) with
  // an internal timeout, so a stuck request fails cleanly instead of hanging.
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, REQUEST_TIMEOUT_MS);
  const onExternalAbort = () => ctrl.abort();
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  let res;
  try {
    res = await fetch(`${BASE}/loop?${params}`, { signal: ctrl.signal });
  } catch (err) {
    if (timedOut) throw new EngineError('timeout', 'Engine timed out');
    if (err.name === 'AbortError') throw err; // superseded by a newer request
    throw new EngineError('offline', 'Engine unreachable');
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onExternalAbort);
  }
  if (!res.ok) {
    // The engine signals "no route met the ≤3 turns/km bar" via a 422 whose
    // detail starts with "no_quality".
    let detail = '';
    try {
      detail = (await res.json())?.detail ?? '';
    } catch {
      /* ignore non-JSON error bodies */
    }
    if (res.status === 422) {
      const d = String(detail);
      if (d.startsWith('no_quality')) throw new EngineError('no-quality', detail);
      if (d.startsWith('via_too_far')) throw new EngineError('via-too-far', detail);
      if (d.startsWith('no_via')) throw new EngineError('no-via', detail);
      if (d.startsWith('end_uncovered')) throw new EngineError('end-uncovered', detail);
      if (d.startsWith('no_path')) throw new EngineError('no-path', detail);
    }
    throw new EngineError('http', `Engine responded ${res.status}`);
  }

  const collection = await res.json();
  const features = collection?.features ?? [];
  const candidates = features.map(featureToCandidate).filter(Boolean);

  if (candidates.length === 0) throw new EngineError('empty', 'No route returned');
  return candidates; // already sorted best-first by the engine
}

/** Send a 👍 (liked=true) / 👎 (liked=false) on a route so the engine learns. */
export async function sendFeedback(route, targetKm, liked) {
  try {
    await fetch(`${BASE}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        turns_per_km: route.turnsPerKm,
        distance_m: route.distanceKm * 1000,
        target_m: targetKm * 1000,
        pleasant_frac: route.pleasantFrac ?? 0,
        scenic_frac: route.scenicFrac ?? 0,
        label: liked ? 1 : 0,
      }),
    });
  } catch {
    /* feedback is best-effort; ignore network errors */
  }
}
