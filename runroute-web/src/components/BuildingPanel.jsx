import { useEffect, useState } from 'react';

// Illustrative stages cycled while the cloud builds the area (we have no live
// backend progress signal — these convey motion + roughly what's happening).
const STEPS = [
  'מורידים מפת רחובות…',
  'בונים רשת דרכים…',
  'מחשבים מסלולים מתאימים…',
];

function fmtElapsed(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Shown while the engine builds a brand-new area's map in the cloud — the first
 * request in an uncovered place (~1–4 min, one-time per area). Replaces the
 * disabled CTA so a multi-minute wait feels alive and expected, not frozen.
 * Self-contained: it only mounts while routeStatus === 'building', so its timers
 * start on mount and clear on unmount.
 */
export default function BuildingPanel() {
  const [elapsed, setElapsed] = useState(0);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const tick = setInterval(() => setElapsed((s) => s + 1), 1000);
    const cycle = setInterval(() => setStep((i) => (i + 1) % STEPS.length), 3500);
    return () => {
      clearInterval(tick);
      clearInterval(cycle);
    };
  }, []);

  return (
    <div className="building-panel" role="status" aria-live="polite">
      <div className="building-head">
        <span className="map-spinner building-spinner" aria-hidden="true" />
        <span className="building-title">מכינים את האזור הזה</span>
      </div>

      <div className="building-progress" aria-hidden="true">
        <span className="building-progress__bar" />
      </div>

      {/* `key` re-mounts the node each change so the fade-in animation replays. */}
      <div className="building-step" key={step}>
        {STEPS[step]}
      </div>

      <div className="building-meta">
        <span className="building-time">{fmtElapsed(elapsed)}</span>
        <span className="building-note">
          פעם ראשונה באזור הזה — בדרך כלל כדקה. בפעם הבאה זה יהיה מיידי.
        </span>
      </div>
    </div>
  );
}
