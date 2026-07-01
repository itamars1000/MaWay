import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { a11yStore } from '../lib/a11yPrefs.js';
import { useT } from '../state/SettingsProvider.jsx';

// Cycle orders for the multi-state toggles.
const CONTRAST = ['off', 'high', 'invert'];
const TEXT = [100, 115, 130, 150];
const LINES = [100, 160, 200];
const nextIn = (arr, v) => arr[(arr.indexOf(v) + 1) % arr.length];

/** Universal accessibility figure. */
function A11yIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
         fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
         strokeLinejoin="round">
      <circle cx="12" cy="4.3" r="1.9" fill="currentColor" stroke="none" />
      <path d="M4.5 8.5h15" />
      <path d="M12 8v6" />
      <path d="M8.4 20l3.6-6 3.6 6" />
    </svg>
  );
}

/**
 * Floating accessibility-preferences widget (Regulation 35). Toggles CSS classes
 * on <html> via the a11yPrefs store — a user comfort tool, never a content-DOM
 * overlay. Reachable from any focus context with Alt+A.
 */
export default function A11yWidget() {
  const { t } = useT();
  const prefs = useSyncExternalStore(
    a11yStore.subscribe, a11yStore.getSnapshot, a11yStore.getSnapshot);
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0); // bumps the live region so it re-announces
  const panelRef = useRef(null);
  const triggerRef = useRef(null);

  const set = (patch) => { a11yStore.set(patch); setTick((n) => n + 1); };
  const reset = () => { a11yStore.reset(); setTick((n) => n + 1); };

  // Safety net: re-apply saved classes after mount (covers a blocked bootstrap).
  useEffect(() => { a11yStore.set({}); }, []);

  // Alt+A toggles the panel — e.code is layout-independent (macOS Alt+A = "å").
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'KeyA') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close on outside pointer / Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) setOpen(false);
    };
    const onEsc = (e) => {
      if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const lineLabel = (v) => (v === 100 ? t('a11yw.lineSpacing.normal') : (v / 100).toFixed(1));

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id="a11y-widget-trigger"
        className="a11y-fab"
        aria-label={t('a11yw.open')}
        aria-expanded={open}
        aria-controls="a11y-widget-panel"
        aria-keyshortcuts="Alt+A"
        onClick={() => setOpen((o) => !o)}
      >
        <A11yIcon />
      </button>

      {open && (
        <div
          id="a11y-widget-panel"
          ref={panelRef}
          className="a11y-panel"
          role="dialog"
          aria-label={t('a11yw.title')}
        >
          <div className="a11y-panel-head">
            <h2>{t('a11yw.title')}</h2>
            <button type="button" className="a11y-x" aria-label={t('a11yw.close')}
                    onClick={() => setOpen(false)}>✕</button>
          </div>

          <div className="a11y-grid">
            {/* Cycling toggles — no aria-pressed; the label carries the value. */}
            <button
              type="button"
              className={`a11y-card ${prefs.contrast !== 'off' ? 'active' : ''}`}
              aria-label={`${t('a11yw.contrast')}: ${t(`a11yw.contrast.${prefs.contrast}`)}`}
              onClick={() => set({ contrast: nextIn(CONTRAST, prefs.contrast) })}
            >
              <span className="a11y-card-label">{t('a11yw.contrast')}</span>
              <span className="a11y-card-value">{t(`a11yw.contrast.${prefs.contrast}`)}</span>
            </button>

            <button
              type="button"
              className={`a11y-card ${prefs.textSize !== 100 ? 'active' : ''}`}
              aria-label={`${t('a11yw.textSize')}: ${prefs.textSize}%`}
              onClick={() => set({ textSize: nextIn(TEXT, prefs.textSize) })}
            >
              <span className="a11y-card-label">{t('a11yw.textSize')}</span>
              <span className="a11y-card-value">{prefs.textSize}%</span>
            </button>

            <button
              type="button"
              className={`a11y-card ${prefs.lineSpacing !== 100 ? 'active' : ''}`}
              aria-label={`${t('a11yw.lineSpacing')}: ${lineLabel(prefs.lineSpacing)}`}
              onClick={() => set({ lineSpacing: nextIn(LINES, prefs.lineSpacing) })}
            >
              <span className="a11y-card-label">{t('a11yw.lineSpacing')}</span>
              <span className="a11y-card-value">{lineLabel(prefs.lineSpacing)}</span>
            </button>

            {/* Binary toggles — aria-pressed. */}
            <button
              type="button"
              className={`a11y-card ${prefs.links ? 'active' : ''}`}
              aria-pressed={prefs.links}
              onClick={() => set({ links: !prefs.links })}
            >
              <span className="a11y-card-label">{t('a11yw.links')}</span>
              <span className="a11y-card-value">{prefs.links ? t('a11yw.on') : t('a11yw.off')}</span>
            </button>

            <button
              type="button"
              className={`a11y-card ${prefs.reduceMotion ? 'active' : ''}`}
              aria-pressed={prefs.reduceMotion}
              onClick={() => set({ reduceMotion: !prefs.reduceMotion })}
            >
              <span className="a11y-card-label">{t('a11yw.motion')}</span>
              <span className="a11y-card-value">{prefs.reduceMotion ? t('a11yw.on') : t('a11yw.off')}</span>
            </button>
          </div>

          <button type="button" className="a11y-reset" onClick={reset}>
            {t('a11yw.reset')}
          </button>
        </div>
      )}

      {/* Live region OUTSIDE the panel so a close doesn't drop a late announcement. */}
      <div className="sr-only" role="status" aria-live="polite">
        {tick > 0 ? t('a11yw.announce') + '​'.repeat(tick % 2) : ''}
      </div>
    </>
  );
}
