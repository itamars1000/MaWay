import { useSettings } from '../state/SettingsProvider.jsx';
import { GearIcon } from './icons.jsx';

/** Header control that opens the full-screen settings. */
export default function SettingsButton() {
  const { openSettings } = useSettings();
  return (
    <button
      type="button"
      className="auth-pill glass-pill"
      aria-label="הגדרות"
      onClick={openSettings}
    >
      <GearIcon size={21} />
    </button>
  );
}
