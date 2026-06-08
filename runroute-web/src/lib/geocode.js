// Geocoding via Nominatim (OpenStreetMap) — no API key required.
//
// Nominatim usage policy: max ~1 request/second and a meaningful referer.
// Callers MUST debounce (see AddressAutocomplete). For production volume,
// self-host Nominatim or use a paid geocoder instead of the public endpoint.

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

/**
 * Search for addresses matching `query` (biased to Israel, Hebrew labels).
 * @param {string} query
 * @param {AbortSignal} [signal] - abort an in-flight request when superseded.
 * @returns {Promise<Array<{ label: string, lat: number, lng: number }>>}
 */
export async function searchAddress(query, signal) {
  const q = query.trim();
  if (q.length < 2) return [];

  const params = new URLSearchParams({
    format: 'json',
    addressdetails: '1',
    limit: '5',
    'accept-language': 'he',
    countrycodes: 'il',
    q,
  });

  const res = await fetch(`${ENDPOINT}?${params}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);

  const data = await res.json();
  return data.map((item) => ({
    label: item.display_name,
    lat: Number(item.lat),
    lng: Number(item.lon),
  }));
}
