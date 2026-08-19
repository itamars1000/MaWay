import { useEffect, useState } from 'react';
import { useAuth } from '../state/AuthProvider.jsx';
import { useT } from '../state/SettingsProvider.jsx';
import { getSafetyAcked } from '../lib/settings.js';
import {
  getPlatform,
  hasNativePrompt,
  isDismissed,
  isStandalone,
  onInstallAvailable,
  promptInstall,
  setDismissed,
} from '../lib/pwa.js';

/**
 * Small card suggesting "add to home screen" when the app is opened in a
 * browser rather than installed.
 *
 * On Chrome (Android/desktop) it offers a real one-tap install; on iOS, which
 * has no install API, it explains the Share-sheet route instead — and iOS is
 * where this matters most, since nothing else there hints the app is
 * installable at all.
 *
 * Deliberately queued behind the login gate and the safety notice: first open
 * already shows both, and a third overlay stacked on top reads as spam rather
 * than a suggestion. Dismissing it is remembered for good.
 */
export default function InstallPrompt() {
  const { t } = useT();
  const { loginVisible } = useAuth();
  const [dismissed, setLocalDismissed] = useState(isDismissed);
  const [native, setNative] = useState(hasNativePrompt);

  // The install event can arrive after mount (Chrome fires it once it decides
  // the app qualifies), so upgrade from instructions to a real button live.
  useEffect(() => onInstallAvailable(setNative), []);

  const platform = getPlatform();

  if (dismissed || isStandalone()) return null;
  // Wait for the screens that must be answered first.
  if (loginVisible || !getSafetyAcked()) return null;
  // Nothing useful to say on a desktop browser with no install support.
  if (platform === 'desktop' && !native) return null;

  const close = () => {
    setDismissed();
    setLocalDismissed(true);
  };

  const install = async () => {
    await promptInstall();
    close(); // either they installed it, or they said no — don't ask twice
  };

  return (
    <div className="install-card" role="dialog" aria-labelledby="install-title">
      <div className="install-text">
        <h2 id="install-title" className="install-title">{t('install.title')}</h2>
        <p className="install-body">
          {platform === 'ios' ? t('install.bodyIos') : t('install.body')}
        </p>
      </div>
      <div className="install-actions">
        {native && (
          <button type="button" className="install-btn" onClick={install}>
            {t('install.action')}
          </button>
        )}
        <button type="button" className="install-dismiss" onClick={close}>
          {t('install.dismiss')}
        </button>
      </div>
    </div>
  );
}
