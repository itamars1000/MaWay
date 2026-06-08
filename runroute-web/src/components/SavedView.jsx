import { useState } from 'react';
import { useAppState, ROUTE_TYPES } from '../state/AppState.jsx';
import { downloadGpx } from '../lib/gpx.js';
import SavedEmptyState from './SavedEmptyState.jsx';
import {
  LoopIcon,
  AbIcon,
  DownloadIcon,
  TrashIcon,
  PencilIcon,
} from './icons.jsx';

/** One saved-route card. */
function SavedCard({ item }) {
  const { openSavedRoute, deleteSavedRoute, renameSavedRoute } = useAppState();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.name);

  const commit = () => {
    const name = draft.trim();
    if (name && name !== item.name) renameSavedRoute(item.id, name);
    setEditing(false);
  };

  const stop = (e) => e.stopPropagation();

  return (
    <div className="saved-card" onClick={() => openSavedRoute(item)}>
      <div className="saved-icon">
        {item.type === ROUTE_TYPES.LOOP ? <LoopIcon /> : <AbIcon />}
      </div>

      <div className="saved-body">
        {editing ? (
          <input
            className="saved-rename"
            value={draft}
            autoFocus
            onClick={stop}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') {
                setDraft(item.name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <div className="saved-name">{item.name}</div>
        )}
        <div className="saved-meta">
          <span>{item.distanceKm.toFixed(1)} ק״מ</span>
          {item.ascentM != null && <span>↑ {item.ascentM} מ׳</span>}
          {item.descentM != null && <span>↓ {item.descentM} מ׳</span>}
          {item.scenicFrac > 0 && <span>🌊 {Math.round(item.scenicFrac * 100)}%</span>}
        </div>
      </div>

      <div className="saved-actions" onClick={stop}>
        <button
          type="button"
          className="saved-act"
          title="ערוך שם"
          aria-label="ערוך שם"
          onClick={() => {
            setDraft(item.name);
            setEditing(true);
          }}
        >
          <PencilIcon />
        </button>
        <button
          type="button"
          className="saved-act"
          title="ייצוא GPX"
          aria-label="ייצוא GPX"
          onClick={() => downloadGpx(item)}
        >
          <DownloadIcon />
        </button>
        <button
          type="button"
          className="saved-act saved-act--danger"
          title="מחק"
          aria-label="מחק"
          onClick={() => deleteSavedRoute(item.id)}
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

/** The "שמורים" tab: saved-route cards, or the empty state. */
export default function SavedView() {
  const { savedRoutes } = useAppState();
  if (!savedRoutes.length) return <SavedEmptyState />;
  return (
    <div className="saved-list">
      {savedRoutes.map((item) => (
        <SavedCard key={item.id} item={item} />
      ))}
    </div>
  );
}
