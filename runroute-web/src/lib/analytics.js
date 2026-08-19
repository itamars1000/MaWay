// Anonymous, first-party measurement for the guest funnel — no third-party
// analytics, no cookies, nothing that leaves our own services.
//
// Two questions it exists to answer:
//   1. How many people generated a route without an account? (`cid` on /loop)
//   2. How many of them went on to sign up?  (`anon_id` stamped on the account
//      at first sign-in, so a join on the two sides gives the conversion rate)
//
// `cid` is a random id with no personal data in it, stored on the device. It is
// sent to our own route engine only, and only on guest requests — a signed-in
// user is already identified by their account and needs no extra id.

const CID_KEY = 'maway:cid';
const GUEST_KEY = 'maway:guest';        // currently browsing without an account
const WAS_GUEST_KEY = 'maway:was-guest'; // ever did — kept for attribution

/** localStorage can throw (private mode, disabled storage); never break on it. */
function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* measurement is best-effort — a device that can't store just isn't counted */
  }
}

function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function uuid() {
  // randomUUID needs a secure context; getRandomValues is far more widely
  // available, and Math.random is the last resort (a duplicate id only costs
  // accuracy in a count, so a weak fallback is better than no id at all).
  if (typeof crypto !== 'undefined') {
    if (crypto.randomUUID) return crypto.randomUUID();
    if (crypto.getRandomValues) {
      const b = crypto.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  }
  return `x${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/** Stable per-device id, created on first use. */
export function getClientId() {
  const existing = read(CID_KEY);
  if (existing) return existing;
  const id = uuid();
  write(CID_KEY, id);
  return id;
}

/** True if the user chose to use the app without an account. */
export function isGuest() {
  return read(GUEST_KEY) === '1';
}

/** Remember the guest choice across reloads (and forever, for attribution). */
export function setGuest() {
  write(GUEST_KEY, '1');
  write(WAS_GUEST_KEY, '1');
}

/** Cleared on explicit sign-out, so signing out returns to the login screen
 *  instead of silently dropping the user back into guest mode. */
export function clearGuest() {
  remove(GUEST_KEY);
}

/** Whether this device ever used guest mode — stamped on the account at
 *  sign-up so "guest → account" conversion is measurable. */
export function wasEverGuest() {
  return read(WAS_GUEST_KEY) === '1';
}
