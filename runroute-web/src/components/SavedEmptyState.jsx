import { MapOutlineIcon } from './icons.jsx';

/** Empty state for the "שמורים" (Saved) tab. */
export default function SavedEmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-icon-tile">
        <MapOutlineIcon />
      </div>
      <p className="empty-title">עדיין אין מסלולים שמורים</p>
      <p className="empty-text">
        צרו מסלול בלשונית “מסלול” כדי שיופיע כאן.
      </p>
    </div>
  );
}
