import { useSettings, useT } from '../state/SettingsProvider.jsx';
import { ChevronIcon } from './icons.jsx';

/**
 * Full-screen terms of use, opened from Settings or the safety notice. Reuses
 * the settings-screen layout/classes (with --legal so it opens above the
 * first-run safety gate). Content lives in i18n (terms.*) so it stays bilingual.
 */
const SECTIONS = ['service', 'use', 'content', 'disclaimer', 'liability', 'changes', 'law', 'contact'];

export default function TermsScreen() {
  const { termsOpen, closeTerms } = useSettings();
  const { t } = useT();
  if (!termsOpen) return null;

  return (
    <div className="settings-screen settings-screen--legal" role="dialog" aria-modal="true"
         aria-label={t('terms.title')}>
      <header className="settings-bar">
        <button
          type="button"
          className="settings-back"
          aria-label={t('settings.close')}
          onClick={closeTerms}
        >
          <ChevronIcon size={22} />
        </button>
        <h1 className="settings-heading">{t('terms.title')}</h1>
        <span className="settings-bar-spacer" />
      </header>

      <div className="settings-body">
        <section className="settings-group">
          <div className="settings-card">
            <p className="settings-note">{t('terms.intro')}</p>
            <p className="settings-version">{t('terms.updated')}</p>
          </div>
        </section>

        {SECTIONS.map((key) => (
          <section className="settings-group" key={key}>
            <h2 className="settings-group-title">{t(`terms.h.${key}`)}</h2>
            <div className="settings-card">
              <p className="settings-note" style={{ marginBottom: 0 }}>
                {t(`terms.${key}`)}
              </p>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
