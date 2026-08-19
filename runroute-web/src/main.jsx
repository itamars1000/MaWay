import React from 'react';
import ReactDOM from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './index.css';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { initSentry } from './lib/sentry.js';
// Imported for its side effect: Chrome fires `beforeinstallprompt` before React
// mounts, so the listener has to be installed at startup or the event is lost.
import './lib/pwa.js';

initSentry();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

hideSplash();

/** Fade out and remove the static #app-splash (see index.html) once React has
 * mounted. Keeps it on screen for a minimum stretch so a fast load doesn't
 * flash it for a few ms, which reads as broken rather than "polished".
 *
 * Deliberately setTimeout-only, NOT requestAnimationFrame: rAF only fires
 * while the page is actively compositing frames, which a backgrounded or
 * prerendered tab may never do — that would leave the splash stuck forever
 * (verified: it does exactly this in a headless/non-composited preview).
 * setTimeout fires regardless. A hard-cap timer is a last-resort safety net
 * in case anything above still goes wrong. */
function hideSplash() {
  const el = document.getElementById('app-splash');
  if (!el) return;
  const MIN_VISIBLE_MS = 1600;
  const FADE_MS = 300;
  const elapsed = Date.now() - (window.__splashStart || Date.now());
  const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);

  const remove = () => {
    if (!el.isConnected) return; // already removed
    const reduceMotion = document.documentElement.classList.contains('a11y-reduce-motion')
      || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      el.remove();
      return;
    }
    el.style.opacity = '0';
    setTimeout(() => el.remove(), FADE_MS);
  };

  setTimeout(remove, wait);
  setTimeout(() => el.isConnected && el.remove(), 4000); // hard safety net
}
