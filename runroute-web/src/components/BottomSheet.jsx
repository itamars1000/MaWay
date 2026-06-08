import { useEffect, useRef, useState } from 'react';
import { useAppState, TABS } from '../state/AppState.jsx';
import RouteForm from './RouteForm.jsx';
import SavedView from './SavedView.jsx';

// Snap points as a fraction of viewport height.
export const SNAP = {
  collapsed: 0.14, // handle + title only
  anchor: 0.45, // half-open
  expanded: 0.9, // fully open
};
const SNAP_POINTS = [SNAP.collapsed, SNAP.anchor, SNAP.expanded];

const nearestSnap = (value) =>
  SNAP_POINTS.reduce((a, b) =>
    Math.abs(b - value) < Math.abs(a - value) ? b : a,
  );

/**
 * Draggable, snapping bottom sheet. The grab handle / title area is the drag
 * target; the body scrolls independently when expanded. On release the sheet
 * snaps to the nearest of collapsed / anchor / expanded.
 */
export default function BottomSheet({ onFractionChange }) {
  const { currentTab, sheetTitle } = useAppState();
  const [fraction, setFraction] = useState(SNAP.anchor);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const startFraction = useRef(0);

  useEffect(() => {
    onFractionChange(fraction);
  }, [fraction, onFractionChange]);

  const onPointerDown = (e) => {
    setDragging(true);
    startY.current = e.clientY;
    startFraction.current = fraction;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    const dy = startY.current - e.clientY; // up = grow
    const next = startFraction.current + dy / window.innerHeight;
    setFraction(Math.min(SNAP.expanded, Math.max(SNAP.collapsed, next)));
  };

  const endDrag = () => {
    if (!dragging) return;
    setDragging(false);
    setFraction((f) => nearestSnap(f));
  };

  return (
    <section
      className={`sheet ${dragging ? 'dragging' : ''}`}
      style={{ height: `${fraction * 100}%` }}
    >
      <div
        className="sheet-header"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="grab" />
        <h2 className="sheet-title">{sheetTitle}</h2>
      </div>
      <div className="sheet-body">
        {currentTab === TABS.ROUTE ? <RouteForm /> : <SavedView />}
      </div>
    </section>
  );
}
