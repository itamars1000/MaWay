import { useEffect, useState } from 'react';
import { useT } from '../state/SettingsProvider.jsx';

function fmtElapsed(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Shown while the engine builds a brand-new area's map in the cloud.
 * Self-contained: mounts while routeStatus === 'building', so timers start on
 * mount and clear on unmount.
 */
export default function BuildingPanel() {
  const { t } = useT();
  const STEPS = [t('build.step1'), t('build.step2'), t('build.step3')];
  const [elapsed, setElapsed] = useState(0);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const tick = setInterval(() => setElapsed((s) => s + 1), 1000);
    const cycle = setInterval(() => setStep((i) => (i + 1) % STEPS.length), 3500);
    return () => {
      clearInterval(tick);
      clearInterval(cycle);
    };
    // STEPS length is stable — only STEPS content changes with lang, which
    // remounts this component via a key from RouteForm's building state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="building-panel" role="status" aria-live="polite">
      <div className="building-head">
        <span className="map-spinner building-spinner" aria-hidden="true" />
        <span className="building-title">{t('build.title')}</span>
      </div>

      <div className="building-progress" aria-hidden="true">
        <span className="building-progress__bar" />
      </div>

      <div className="building-step" key={step}>
        {STEPS[step]}
      </div>

      <div className="building-meta">
        <span className="building-time">{fmtElapsed(elapsed)}</span>
        <span className="building-note">{t('build.note')}</span>
      </div>
    </div>
  );
}
