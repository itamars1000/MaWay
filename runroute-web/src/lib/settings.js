// Small persisted user-preferences store (localStorage). Kept framework-free so
// non-React modules (e.g. engine.js) can read a value synchronously.
import { DEFAULT_MAP_STYLE } from './mapStyles.js';

export const MAP_STYLE_KEY = 'maway:mapStyle';
export const LANG_KEY = 'maway:lang';
export const SAFETY_ACK_KEY = 'maway:safety-ack';

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

/** Persisted UI language ('he' | 'en'). Defaults to Hebrew. */
export function getLang() {
  try {
    return localStorage.getItem(LANG_KEY) || 'en';
  } catch {
    return 'en';
  }
}

export function setLangStored(lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* ignore storage errors */
  }
}

/** Whether the user has acknowledged the one-time safety notice. */
export function getSafetyAcked() {
  try {
    return localStorage.getItem(SAFETY_ACK_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSafetyAcked() {
  try {
    localStorage.setItem(SAFETY_ACK_KEY, '1');
  } catch {
    /* ignore storage errors */
  }
}
