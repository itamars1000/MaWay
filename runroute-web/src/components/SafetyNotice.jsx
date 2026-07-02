import { useState } from 'react';
import { useSettings, useT } from '../state/SettingsProvider.jsx';
import { getSafetyAcked, setSafetyAcked } from '../lib/settings.js';

/**
 * One-time safety / liability notice, shown on first use until acknowledged.
 * Routes are auto-generated suggestions — the user must accept responsibility for
 * their own safety. Persisted in localStorage (maway:safety-ack) so it shows once.
 */
export default function SafetyNotice() {
  const { t } = useT();
  const { openTerms, openPrivacy } = useSettings();
  const [acked, setAcked] = useState(getSafetyAcked);
  if (acked) return null;

  const accept = () => {
    setSafetyAcked();
    setAcked(true);
  };

  return (
    <div className="safety-overlay" role="dialog" aria-modal="true"
         aria-labelledby="safety-title">
      <div className="safety-card">
        <h2 id="safety-title" className="safety-title">{t('safety.title')}</h2>
        <p className="safety-intro">{t('safety.intro')}</p>
        <ul className="safety-list">
          <li>{t('safety.b1')}</li>
          <li>{t('safety.b2')}</li>
          <li>{t('safety.b3')}</li>
        </ul>
        <button type="button" className="action-button" onClick={accept}>
          {t('safety.ack')}
        </button>
        <p className="safety-legal">
          {t('safety.agreePrefix')}
          <button type="button" className="linklike" onClick={openTerms}>
            {t('terms.link')}
          </button>
          {t('safety.and')}
          <button type="button" className="linklike" onClick={openPrivacy}>
            {t('privacy.link')}
          </button>
          .
        </p>
      </div>
    </div>
  );
}
