// Accessibility preferences store (Regulation 35 / IS 5568 comfort widget).
//
// A tiny pub-sub store consumed via useSyncExternalStore. Every visual change is
// driven by a CSS class on <html> — the widget NEVER mutates content DOM (no
// injected alt text, no ARIA rewriting): that is the line between a compliant
// user-preference tool and a banned auto-remediation overlay.

const KEY = 'maway:a11y:v1';
const VERSION = 1;

export const DEFAULTS = {
  version: VERSION,
  links: false,
  contrast: 'off', // 'off' | 'high' | 'invert'
  textSize: 100, // 100 | 115 | 130 | 150  (applied as #root zoom — app is px-based)
  lineSpacing: 100, // 100 | 160 | 200
  reduceMotion: false,
};

// class ↔ predicate ↔ bootstrap-JS expression, defined ONCE so the runtime and
// the <head> FOUC bootstrap (index.html) apply the exact same classes. If you
// add a rule here, mirror the JS expression in index.html.
export const CLASS_RULES = [
  ['a11y-links', (p) => !!p.links, '!!p.links'],
  ['a11y-contrast-high', (p) => p.contrast === 'high', "p.contrast==='high'"],
  ['a11y-contrast-invert', (p) => p.contrast === 'invert', "p.contrast==='invert'"],
  ['a11y-text-115', (p) => p.textSize === 115, 'p.textSize===115'],
  ['a11y-text-130', (p) => p.textSize === 130, 'p.textSize===130'],
  ['a11y-text-150', (p) => p.textSize === 150, 'p.textSize===150'],
  ['a11y-lines-16', (p) => p.lineSpacing === 160, 'p.lineSpacing===160'],
  ['a11y-lines-20', (p) => p.lineSpacing === 200, 'p.lineSpacing===200'],
  ['a11y-reduce-motion', (p) => !!p.reduceMotion, '!!p.reduceMotion'],
];

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && p.version === VERSION) return { ...DEFAULTS, ...p };
    }
  } catch {
    /* localStorage blocked / corrupt → defaults */
  }
  return { ...DEFAULTS };
}

let state = load();
const listeners = new Set();

/** Toggle the CSS classes for `p` onto an element's classList (default <html>). */
export function applyPrefsToElement(el, p = state) {
  const c = el.classList;
  for (const [cls, pred] of CLASS_RULES) c.toggle(cls, pred(p));
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore quota/private-mode failures */
  }
}

function notify() {
  applyPrefsToElement(document.documentElement);
  for (const l of listeners) l();
}

export const a11yStore = {
  subscribe(l) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getSnapshot() {
    return state;
  },
  set(patch) {
    state = { ...state, ...patch, version: VERSION };
    persist();
    notify();
  },
  reset() {
    state = { ...DEFAULTS };
    persist();
    notify();
  },
};
