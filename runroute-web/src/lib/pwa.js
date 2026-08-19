// "Add to home screen" support.
//
// Two very different worlds. Chrome/Edge (Android + desktop) fire
// `beforeinstallprompt`, which lets us offer a real one-tap install. iOS offers
// no such hook at all — installing there is a manual trip through the Share
// sheet — so all we can do is explain it, which is exactly the platform where
// most Israeli runners will open this.
//
// The event fires before React mounts, so it is captured at module scope (this
// module is imported from main.jsx) and replayed to whoever asks later.

const DISMISS_KEY = 'maway:install-dismissed';

let deferredPrompt = null;
const listeners = new Set();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Chrome shows its own mini-infobar unless the event is cancelled; we want
    // the prompt to appear in our own card, at a moment we choose.
    e.preventDefault();
    deferredPrompt = e;
    listeners.forEach((fn) => fn(true));
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    listeners.forEach((fn) => fn(false));
  });
}

/** Subscribe to "a native install prompt is available". Returns an unsubscribe. */
export function onInstallAvailable(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function hasNativePrompt() {
  return deferredPrompt !== null;
}

/** Show the browser's own install dialog. Resolves true if the user accepted. */
export async function promptInstall() {
  if (!deferredPrompt) return false;
  const e = deferredPrompt;
  deferredPrompt = null; // a prompt can only be used once
  listeners.forEach((fn) => fn(false));
  try {
    e.prompt();
    const { outcome } = await e.userChoice;
    return outcome === 'accepted';
  } catch {
    return false;
  }
}

/** True when already running as an installed app — nothing to suggest. */
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  const displayMode = ['standalone', 'fullscreen', 'minimal-ui'].some(
    (m) => window.matchMedia?.(`(display-mode: ${m})`).matches,
  );
  // iOS Safari predates the display-mode media query and uses its own flag.
  return displayMode || window.navigator.standalone === true;
}

/** 'ios' | 'android' | 'desktop' — decides which instructions to show. */
export function getPlatform() {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  // iPadOS 13+ reports itself as a Mac; the touch points give it away.
  const iPadAsMac = /Macintosh/i.test(ua) && (navigator.maxTouchPoints || 0) > 1;
  if (/iPhone|iPad|iPod/i.test(ua) || iPadAsMac) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export function isDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function setDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* storage blocked — the card reappears next visit, which is acceptable */
  }
}
