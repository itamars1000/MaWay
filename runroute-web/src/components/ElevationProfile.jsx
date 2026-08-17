import { useMemo } from 'react';
import { useT } from '../state/SettingsProvider.jsx';

const W = 300; // viewBox units; the SVG scales to the container width
const H = 64;
const PAD_Y = 6;

/**
 * Mini elevation profile for the shown route — a filled area chart of the
 * sampled height series the engine returns (`elevation`).
 *
 * Deliberately left-to-right in both languages: distance-along-route reads
 * start→finish left→right in every fitness app (Strava, Garmin), so flipping
 * it for RTL would be more confusing than consistent.
 *
 * Renders nothing when there's no usable series — elevation is best-effort, so
 * a route can legitimately arrive without one.
 */
export default function ElevationProfile({ points }) {
  const { t } = useT();

  const chart = useMemo(() => {
    if (!Array.isArray(points) || points.length < 2) return null;
    const lo = Math.min(...points);
    const hi = Math.max(...points);
    // A flat route would divide by zero; give it a nominal band so the line
    // renders through the middle instead of collapsing.
    const span = hi - lo || 1;
    const stepX = W / (points.length - 1);
    const y = (v) => PAD_Y + (1 - (v - lo) / span) * (H - PAD_Y * 2);

    const line = points.map((v, i) => `${i * stepX},${y(v)}`).join(' ');
    return {
      lo: Math.round(lo),
      hi: Math.round(hi),
      line: `M ${line.split(' ').join(' L ')}`,
      area: `M 0,${H} L ${line.split(' ').join(' L ')} L ${W},${H} Z`,
    };
  }, [points]);

  if (!chart) return null;

  return (
    <div className="elev">
      <div className="elev-head">
        <span className="elev-title">{t('elev.title')}</span>
        <span className="elev-range">{chart.lo}–{chart.hi} {t('elev.m')}</span>
      </div>
      <svg
        className="elev-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={t('elev.aria', { lo: chart.lo, hi: chart.hi })}
      >
        <defs>
          <linearGradient id="elevFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--mint-deep)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--mint-deep)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={chart.area} fill="url(#elevFill)" />
        <path
          d={chart.line}
          fill="none"
          stroke="var(--mint-deep)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
