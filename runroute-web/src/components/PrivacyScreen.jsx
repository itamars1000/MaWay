import { useSettings, useT } from '../state/SettingsProvider.jsx';
import { ChevronIcon } from './icons.jsx';

/**
 * Full-screen privacy policy, opened from Settings. Reuses the settings-screen
 * layout/classes. Content lives in i18n (privacy.*) so it stays bilingual.
 */
const SECTIONS = ['collect', 'use', 'third', 'retention', 'rights', 'contact'];

export default function PrivacyScreen() {
  const { privacyOpen, closePrivacy } = useSettings();
  const { t } = useT();
  if (!privacyOpen) return null;

  return (
    <div className="settings-screen" role="dialog" aria-modal="true"
         aria-label={t('privacy.title')}>
      <header className="settings-bar">
        <button
          type="button"
          className="settings-back"
          aria-label={t('settings.close')}
          onClick={closePrivacy}
        >
          <ChevronIcon size={22} />
        </button>
        <h1 className="settings-heading">{t('privacy.title')}</h1>
        <span className="settings-bar-spacer" />
      </header>

      <div className="settings-body">
        <section className="settings-group">
          <div className="settings-card">
            <p className="settings-note">{t('privacy.intro')}</p>
            <p className="settings-version">{t('privacy.updated')}</p>
          </div>
        </section>

        {SECTIONS.map((key) => (
          <section className="settings-group" key={key}>
            <h2 className="settings-group-title">{t(`privacy.h.${key}`)}</h2>
            <div className="settings-card">
              <p className="settings-note" style={{ marginBottom: 0 }}>
                {t(`privacy.${key}`)}
              </p>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
