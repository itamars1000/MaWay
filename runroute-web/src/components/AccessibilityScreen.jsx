import { useSettings, useT } from '../state/SettingsProvider.jsx';
import { ChevronIcon } from './icons.jsx';

/**
 * Full-screen accessibility statement (Hatzaharat Negishot), opened from
 * Settings. Legally mandatory under IS 5568 / the Equal Rights for Persons with
 * Disabilities regulations. Reuses the settings-screen layout; content lives in
 * i18n (a11y.*) so it stays bilingual.
 */
const SECTIONS = ['commitment', 'features', 'alternatives', 'contact'];

export default function AccessibilityScreen() {
  const { a11yOpen, closeA11y } = useSettings();
  const { t } = useT();
  if (!a11yOpen) return null;

  return (
    <div className="settings-screen" role="dialog" aria-modal="true"
         aria-label={t('a11y.title')}>
      <header className="settings-bar">
        <button
          type="button"
          className="settings-back"
          aria-label={t('settings.close')}
          onClick={closeA11y}
        >
          <ChevronIcon size={22} />
        </button>
        <h1 className="settings-heading">{t('a11y.title')}</h1>
        <span className="settings-bar-spacer" />
      </header>

      <div className="settings-body">
        <section className="settings-group">
          <div className="settings-card">
            <p className="settings-note">{t('a11y.intro')}</p>
            <p className="settings-version">{t('a11y.updated')}</p>
          </div>
        </section>

        {SECTIONS.map((key) => (
          <section className="settings-group" key={key}>
            <h2 className="settings-group-title">{t(`a11y.h.${key}`)}</h2>
            <div className="settings-card">
              <p className="settings-note" style={{ marginBottom: 0 }}>
                {t(`a11y.${key}`)}
              </p>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
