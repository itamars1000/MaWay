// Small persisted user-preferences store (localStorage). Kept framework-free so
// non-React modules (e.g. engine.js) can read a value synchronously.

export const PACE_KEY = 'maway:paceMinPerKm';
export const DEFAULT_PACE = 6; // minutes per km
export const MIN_PACE = 3;
export const MAX_PACE = 12;

/** Running pace in min/km, clamped to a sane range. Falls back to the default. */
export function getPace() {
  try {
    const v = Number(localStorage.getItem(PACE_KEY));
    if (v >= MIN_PACE && v <= MAX_PACE) return v;
  } catch {
    /* ignore storage errors */
  }
  return DEFAULT_PACE;
}

export function setPaceStored(value) {
  try {
    localStorage.setItem(PACE_KEY, String(value));
  } catch {
    /* ignore storage errors (private mode) */
  }
}
