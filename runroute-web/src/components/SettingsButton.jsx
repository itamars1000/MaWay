import { useSettings } from '../state/SettingsProvider.jsx';
import { useT } from '../state/SettingsProvider.jsx';
import { GearIcon } from './icons.jsx';

/** Header control that opens the full-screen settings. */
export default function SettingsButton() {
  const { openSettings } = useSettings();
  const { t } = useT();
  return (
    <button
      type="button"
      className="auth-pill glass-pill"
      aria-label={t('settings.title')}
      onClick={openSettings}
    >
      <GearIcon size={21} />
    </button>
  );
}
