// Local (device-only) persistence for saved routes — no backend.
// Stored as a JSON array under one localStorage key.

const KEY = 'maway.saved';

/** Read the saved-routes list (newest first). Returns [] on any error. */
export function loadSaved() {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Persist the list. Swallows quota/serialisation errors (best-effort). */
export function persist(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full / unavailable — keep the in-memory list either way */
  }
}

// Pure list transforms (caller persists + sets state with the result).
export function addRoute(list, item) {
  return [item, ...list];
}

export function removeRoute(list, id) {
  return list.filter((r) => r.id !== id);
}

export function renameRoute(list, id, name) {
  return list.map((r) => (r.id === id ? { ...r, name } : r));
}
