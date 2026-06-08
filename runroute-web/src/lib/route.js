// Demo route geometry. This is a placeholder loop — real route generation
// (via a routing engine) is a separate, future step. The shape is anchored to
// the chosen start point so the map view stays coherent wherever the user is.

// Offsets (in degrees) describing a small loop, relative to its first point.
// Derived from the original fixed Tel Aviv sample so the look is unchanged.
const LOOP_OFFSETS = [
  [0, 0],
  [0.0036, -0.0012],
  [0.0048, 0.0037],
  [0.0022, 0.0073],
  [-0.0013, 0.0051],
  [0, 0],
];

// Fallback center (Tel Aviv) used until a real position is known.
export const DEFAULT_CENTER = { lat: 32.0853, lng: 34.7818 };

/**
 * Build a demo loop polyline anchored at `center`.
 * @param {{lat:number,lng:number}} center
 * @returns {Array<[number, number]>} Leaflet [lat, lng] positions.
 */
export function buildDemoLoop(center) {
  const c = center ?? DEFAULT_CENTER;
  return LOOP_OFFSETS.map(([dLat, dLng]) => [c.lat + dLat, c.lng + dLng]);
}
