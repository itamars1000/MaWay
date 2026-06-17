import { MapOutlineIcon } from './icons.jsx';
import { useT } from '../state/SettingsProvider.jsx';

/** Empty state for the Saved tab. */
export default function SavedEmptyState() {
  const { t } = useT();
  return (
    <div className="empty-state">
      <div className="empty-icon-tile">
        <MapOutlineIcon />
      </div>
      <p className="empty-title">{t('saved.emptyTitle')}</p>
      <p className="empty-text">{t('saved.emptyText')}</p>
    </div>
  );
}
