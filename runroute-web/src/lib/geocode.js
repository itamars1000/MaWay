// Geocoding via Photon (komoot) — OpenStreetMap-based, no API key required.
//
// Photon is purpose-built for autocomplete and has a more lenient usage policy
// than the public Nominatim endpoint (which forbids use as an app backend).
// Requests run from the browser (per-user IP, debounced in AddressAutocomplete),
// so load stays distributed. For heavy production volume, self-host Photon or
// move to a keyed geocoder behind the engine.

const ENDPOINT = 'https://photon.komoot.io/api/';

// The public Photon instance only localizes to these languages; for anything
// else (e.g. 'he') we ask for `lang=default`, which returns OSM's native `name`
// — Hebrew for Israeli places. (Omitting `lang` entirely romanizes to English,
// and `lang=he` is rejected with 400, so `default` is the right fallback.)
const SUPPORTED_LANGS = new Set(['en', 'de', 'fr']);

/**
 * Search for addresses matching `query`, worldwide.
 * @param {string} query
 * @param {object} [opts]
 * @param {AbortSignal} [opts.signal] abort an in-flight request when superseded.
 * @param {string} [opts.lang] UI language ('he' | 'en' | …) for result labels.
 * @param {{lat:number,lng:number}} [opts.near] bias results near this point.
 * @returns {Promise<Array<{ label: string, lat: number, lng: number }>>}
 */
export async function searchAddress(query, opts = {}) {
  const { signal, lang, near } = opts;
  const q = query.trim();
  if (q.length < 2) return [];

  const params = new URLSearchParams({ q, limit: '6' });
  params.set('lang', SUPPORTED_LANGS.has(lang) ? lang : 'default');
  if (near && Number.isFinite(near.lat) && Number.isFinite(near.lng)) {
    // Bias (not restrict) — results near the runner rank first, but a distant
    // match is still returned so worldwide search keeps working.
    params.set('lat', String(near.lat));
    params.set('lon', String(near.lng));
  }

  const res = await fetch(`${ENDPOINT}?${params}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);

  const data = await res.json();
  return (data.features || []).map(featureToResult).filter(Boolean);
}

// Photon returns GeoJSON features: geometry.coordinates [lon, lat] and a `properties`
// bag (name / street / housenumber / city / state / country). Build a readable,
// deduped label from the most specific parts down to the country.
function featureToResult(f) {
  const c = f.geometry?.coordinates;
  if (!c || c.length < 2) return null;
  const p = f.properties || {};
  // Most-specific line: a named place/street keeps its name; a bare house shows
  // "street housenumber" (Photon omits `name` on plain addresses).
  let primary;
  if (p.name) primary = p.name;
  else if (p.street) primary = [p.street, p.housenumber].filter(Boolean).join(' ');
  else primary = p.housenumber || '';
  const locality = p.city || p.town || p.village || p.hamlet || p.county;
  const parts = [primary, locality, p.state, p.country].filter(Boolean);
  // Drop consecutive duplicates (e.g. name === street, or locality === state).
  const label = parts.filter((v, i) => v !== parts[i - 1]).join(', ');
  if (!label) return null;
  return { label, lat: Number(c[1]), lng: Number(c[0]) };
}
