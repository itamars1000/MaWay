import { useSettings } from '../state/SettingsProvider.jsx';
import { useAuth } from '../state/AuthProvider.jsx';
import { useAppState } from '../state/AppState.jsx';
import { ChevronIcon, GoogleIcon } from './icons.jsx';

const APP_VERSION = '0.1.0';

/**
 * Full-screen, app-style settings. Sections: account (sign in/out), preferences
 * (running pace → drives the route time estimate), data (clear saved routes),
 * and about. Opened from the header gear; closed with the back chevron.
 */
export default function SettingsScreen() {
  const { open, closeSettings, pace, setPace, paceBounds } = useSettings();
  const { user, authEnabled, signInWithGoogle, signOut } = useAuth();
  const { savedRoutes, clearAllSavedRoutes } = useAppState();
  if (!open) return null;

  const meta = user?.user_metadata ?? {};
  const name = meta.full_name || meta.name || user?.email || '';
  const avatar = meta.avatar_url || meta.picture || null;
  const savedCount = savedRoutes?.length ?? 0;

  const clearSaved = () => {
    if (savedCount === 0) return;
    if (window.confirm(`למחוק את כל ${savedCount} המסלולים השמורים? פעולה זו אינה הפיכה.`)) {
      clearAllSavedRoutes();
    }
  };

  return (
    <div className="settings-screen" role="dialog" aria-modal="true" aria-label="הגדרות">
      <header className="settings-bar">
        <button
          type="button"
          className="settings-back"
          aria-label="סגור"
          onClick={closeSettings}
        >
          <ChevronIcon size={22} />
        </button>
        <h1 className="settings-heading">הגדרות</h1>
        <span className="settings-bar-spacer" />
      </header>

      <div className="settings-body">
        {/* ---- Account ---- */}
        {authEnabled && (
          <section className="settings-group">
            <h2 className="settings-group-title">חשבון</h2>
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
                <button type="button" className="settings-btn settings-btn--ghost" onClick={signOut}>
                  התנתק
                </button>
              </div>
            ) : (
              <div className="settings-card">
                <p className="settings-note">התחבר כדי לשמור ולסנכרן את המסלולים שלך.</p>
                <button type="button" className="settings-btn settings-btn--google" onClick={() => signInWithGoogle()}>
                  <GoogleIcon size={18} />
                  <span>התחבר עם Google</span>
                </button>
              </div>
            )}
          </section>
        )}

        {/* ---- Preferences ---- */}
        <section className="settings-group">
          <h2 className="settings-group-title">העדפות</h2>
          <div className="settings-card">
            <div className="settings-row">
              <div className="settings-row-label">
                <span>קצב ריצה</span>
                <small>משמש לחישוב הזמן המשוער של המסלול</small>
              </div>
              <div className="stepper">
                <button
                  type="button"
                  className="stepper-btn"
                  aria-label="הפחת קצב"
                  onClick={() => setPace(pace - 0.5)}
                  disabled={pace <= paceBounds.min}
                >
                  −
                </button>
                <span className="stepper-value">
                  {pace.toFixed(1)}<small> דק׳/ק״מ</small>
                </span>
                <button
                  type="button"
                  className="stepper-btn"
                  aria-label="הגבר קצב"
                  onClick={() => setPace(pace + 0.5)}
                  disabled={pace >= paceBounds.max}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ---- Data ---- */}
        <section className="settings-group">
          <h2 className="settings-group-title">נתונים</h2>
          <div className="settings-card">
            <div className="settings-row">
              <div className="settings-row-label">
                <span>מסלולים שמורים</span>
                <small>{savedCount} מסלולים נשמרו במכשיר הזה</small>
              </div>
              <button
                type="button"
                className="settings-btn settings-btn--danger"
                onClick={clearSaved}
                disabled={savedCount === 0}
              >
                מחק הכל
              </button>
            </div>
          </div>
        </section>

        {/* ---- About ---- */}
        <section className="settings-group">
          <h2 className="settings-group-title">אודות</h2>
          <div className="settings-card">
            <div className="settings-about">
              <img className="settings-about-logo" src="/maway-logo.png" alt="MaWay" />
              <p className="settings-note">מסלולי ריצה ישרים ורציפים.</p>
              <p className="settings-version">גרסה {APP_VERSION}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
