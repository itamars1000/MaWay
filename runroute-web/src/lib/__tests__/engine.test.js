import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateFromEngine } from '../engine.js';

/**
 * Covers the guest-funnel tagging on /loop: the request carries `guest=1` and a
 * client id only when nobody is signed in. Getting this wrong is silent — the
 * route still comes back — so it is worth pinning down.
 */

const FEATURE = {
  type: 'Feature',
  geometry: { type: 'LineString', coordinates: [[34.78, 32.08], [34.79, 32.09]] },
  properties: { distance_m: 5000, sharp_turns: 2, sharp_turns_per_km: 0.4 },
};

let calls;

beforeEach(() => {
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    calls.push(new URL(url));
    return {
      ok: true,
      status: 200,
      json: async () => ({ type: 'FeatureCollection', features: [FEATURE] }),
    };
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const START = { lat: 32.08, lng: 34.78 };
const params = () => calls[0].searchParams;

describe('generateFromEngine — guest tagging', () => {
  it('tags a guest request and includes the client id', async () => {
    await generateFromEngine({
      start: START,
      distanceKm: 5,
      guest: true,
      clientId: 'abc-123',
    });

    expect(params().get('guest')).toBe('1');
    expect(params().get('cid')).toBe('abc-123');
  });

  it('sends neither flag for a signed-in user', async () => {
    await generateFromEngine({ start: START, distanceKm: 5, guest: false, clientId: 'abc-123' });

    expect(params().has('guest')).toBe(false);
    expect(params().has('cid')).toBe(false);
  });

  it('defaults to untagged when the caller says nothing', async () => {
    await generateFromEngine({ start: START, distanceKm: 5 });

    expect(params().has('guest')).toBe(false);
  });

  it('still tags the request when no client id could be stored', async () => {
    // localStorage can be unavailable (private mode) — the volume count must
    // survive that, only the per-device count is lost.
    await generateFromEngine({ start: START, distanceKm: 5, guest: true, clientId: null });

    expect(params().get('guest')).toBe('1');
    expect(params().has('cid')).toBe(false);
  });

  it('keeps sending the routing params it always did', async () => {
    await generateFromEngine({ start: START, distanceKm: 5, guest: true, clientId: 'abc-123' });

    expect(params().get('lat')).toBe('32.08');
    expect(params().get('lng')).toBe('34.78');
    expect(params().get('distance')).toBe('5000');
  });
});
