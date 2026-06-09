// Small persisted user-preferences store (localStorage). Kept framework-free so
// non-React modules (e.g. engine.js) can read a value synchronously.
import { DEFAULT_MAP_STYLE } from './mapStyles.js';

export const MAP_STYLE_KEY = 'maway:mapStyle';

/** Persisted basemap style id (validated by getStyle on use). */
export function getMapStyleId() {
  try {
    return localStorage.getItem(MAP_STYLE_KEY) || DEFAULT_MAP_STYLE;
  } catch {
    return DEFAULT_MAP_STYLE;
  }
}

export function setMapStyleStored(id) {
  try {
    localStorage.setItem(MAP_STYLE_KEY, id);
  } catch {
    /* ignore storage errors */
  }
}
