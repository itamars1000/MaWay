import { useSettings, useT } from '../state/SettingsProvider.jsx';
import { useAuth } from '../state/AuthProvider.jsx';
import { useAppState } from '../state/AppState.jsx';
import { ChevronIcon, GoogleIcon } from './icons.jsx';
import { MAP_STYLES } from '../lib/mapStyles.js';

const APP_VERSION = '0.1.0';

/**
 * Full-screen settings. Sections: account, map style, language, data, about.
 * Opened from the header gear; closed with the back chevron.
 */
export default function SettingsScreen() {
  const { open, closeSettings, mapStyle, setMapStyle, lang, setLang, openPrivacy, openTerms, openA11y } = useSettings();
  const { t } = useT();
  const { user, authEnabled, signInWithGoogle, signOut, guest, openLogin } = useAuth();
  const { savedRoutes, clearAllSavedRoutes } = useAppState();
  if (!open) return null;

  const meta = user?.user_metadata ?? {};
  const name = meta.full_name || meta.name || user?.email || '';
  const avatar = meta.avatar_url || meta.picture || null;
  const savedCount = savedRoutes?.length ?? 0;

  const clearSaved = () => {
    if (savedCount === 0) return;
    if (window.confirm(t('settings.clearConfirm', { count: savedCount }))) {
      clearAllSavedRoutes();
    }
  };

  // Close this screen too, so the login gate (same z-index, painted first in
  // App.jsx) isn't left hidden behind it once signOut() clears the session.
  const handleSignOut = () => {
    signOut();
    closeSettings();
  };

  return (
    <div className="settings-screen" role="dialog" aria-modal="true" aria-label={t('settings.title')}>
      <header className="settings-bar">
        <button
          type="button"
          className="settings-back"
          aria-label={t('settings.close')}
          onClick={closeSettings}
        >
          <ChevronIcon size={22} />
        </button>
        <h1 className="settings-heading">{t('settings.title')}</h1>
        <span className="settings-bar-spacer" />
      </header>

      <div className="settings-body">
        {/* ---- Account ---- */}
        {authEnabled && (
          <section className="settings-group">
            <h2 className="settings-group-title">{t('settings.account')}</h2>
            {user ? (
              <div className="settings-card">
                <div className="settings-account">
                  {avatar ? (
                    <img className="settings-avatar" src={avatar} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="settings-avatar settings-avatar--initial">
                      {(name || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="settings-account-text">
                    <div className="settings-account-name">{name}</div>
                    {user.email && <div className="settings-account-email">{user.email}</div>}
                  </div>
                </div>
                <button type="button" className="settings-btn settings-btn--ghost" onClick={handleSignOut}>
                  {t('settings.signOut')}
                </button>
              </div>
            ) : (
              <div className="settings-card">
                <p className="settings-note">
                  {guest ? t('settings.guestNote') : t('settings.signInNote')}
                </p>
                <button type="button" className="settings-btn settings-btn--google" onClick={() => signInWithGoogle()}>
                  <GoogleIcon size={18} />
                  <span>{t('settings.signInGoogle')}</span>
                </button>
                {/* The only route back to the full login screen (and to email
                    sign-in) once a guest has dismissed it. */}
                <button
                  type="button"
                  className="settings-btn settings-btn--ghost"
                  onClick={() => {
                    closeSettings();
                    openLogin();
                  }}
                >
                  {t('settings.signInEmail')}
                </button>
              </div>
            )}
          </section>
        )}

        {/* ---- Map ---- */}
        <section className="settings-group">
          <h2 className="settings-group-title">{t('settings.map')}</h2>
          <div className="settings-card">
            <div className="settings-row-label" style={{ marginBottom: 12 }}>
              <span>{t('settings.mapType')}</span>
              <small>{t('settings.mapTypeHint')}</small>
            </div>
            <div className="mapstyle-row">
              {MAP_STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`mapstyle-chip ${mapStyle === s.id ? 'active' : ''}`}
                  onClick={() => setMapStyle(s.id)}
                >
                  <span className={`mapstyle-swatch mapstyle-swatch--${s.id}`} />
                  <span>{t(s.labelKey)}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Language ---- */}
        <section className="settings-group">
          <h2 className="settings-group-title">{t('settings.language')}</h2>
          <div className="settings-card">
            <div className="lang-row">
              <button
                type="button"
                className={`mapstyle-chip ${lang === 'he' ? 'active' : ''}`}
                onClick={() => setLang('he')}
              >
                עברית
              </button>
              <button
                type="button"
                className={`mapstyle-chip ${lang === 'en' ? 'active' : ''}`}
                onClick={() => setLang('en')}
              >
                English
              </button>
            </div>
          </div>
        </section>

        {/* ---- Data ---- */}
        <section className="settings-group">
          <h2 className="settings-group-title">{t('settings.data')}</h2>
          <div className="settings-card">
            <div className="settings-row">
              <div className="settings-row-label">
                <span>{t('settings.savedRoutes')}</span>
                <small>{t('settings.savedCount', { count: savedCount })}</small>
              </div>
              <button
                type="button"
                className="settings-btn settings-btn--danger"
                onClick={clearSaved}
                disabled={savedCount === 0}
              >
                {t('settings.deleteAll')}
              </button>
            </div>
          </div>
        </section>

        {/* ---- Safety ---- */}
        <section className="settings-group">
          <h2 className="settings-group-title">{t('safety.settingsTitle')}</h2>
          <div className="settings-card">
            <p className="settings-note">{t('safety.intro')}</p>
            <ul className="safety-list">
              <li>{t('safety.b1')}</li>
              <li>{t('safety.b2')}</li>
              <li>{t('safety.b3')}</li>
            </ul>
          </div>
        </section>

        {/* ---- About ---- */}
        <section className="settings-group">
          <h2 className="settings-group-title">{t('settings.about')}</h2>
          <div className="settings-card">
            <div className="settings-about">
              <img className="settings-about-logo" src="/maway-logo.png" alt="" />
              <p className="settings-brand">MaWay</p>
              <p className="settings-note">{t('settings.aboutNote')}</p>
              <p className="settings-version">{t('settings.version', { ver: APP_VERSION })}</p>
            </div>
            <div className="settings-links">
              <button type="button" className="settings-link" onClick={openPrivacy}>
                <span>{t('privacy.link')}</span>
                <ChevronIcon size={18} className="settings-link-chev" />
              </button>
              <button type="button" className="settings-link" onClick={openTerms}>
                <span>{t('terms.link')}</span>
                <ChevronIcon size={18} className="settings-link-chev" />
              </button>
              <button type="button" className="settings-link" onClick={openA11y}>
                <span>{t('a11y.link')}</span>
                <ChevronIcon size={18} className="settings-link-chev" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
