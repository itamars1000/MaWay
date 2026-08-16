import { useState } from 'react';
import { useAuth } from '../state/AuthProvider.jsx';
import { useT } from '../state/SettingsProvider.jsx';
import { GoogleIcon } from './icons.jsx';

/**
 * Full-screen onboarding / sign-in shown on launch. Either Google, or plain
 * email + password. Signing in is required — there is no guest mode.
 */
export default function LoginScreen() {
  const { loginVisible, signInWithGoogle, signUpWithEmail, signInWithEmail } = useAuth();
  const { t } = useT();
  const [showEmail, setShowEmail] = useState(false);
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState(null);
  const [sentTo, setSentTo] = useState(null); // set once a confirmation mail is sent

  if (!loginVisible && !sentTo) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setErrorCode(null);
    setBusy(true);
    const fn = mode === 'signup' ? signUpWithEmail : signInWithEmail;
    const res = await fn(email.trim(), password);
    setBusy(false);
    if (!res.ok) {
      setErrorCode(res.code);
      return;
    }
    // Sign-in (or sign-up with confirmation off) → onAuthStateChange closes the
    // gate on its own. Sign-up needing confirmation → show the "check inbox" state.
    if (res.needsConfirm) setSentTo(email.trim());
  };

  const switchMode = (next) => {
    setMode(next);
    setErrorCode(null);
  };

  return (
    <div className="login-screen" role="dialog" aria-modal="true" aria-label={t('login.ariaLabel')}>
      <span className="login-blob login-blob--1" aria-hidden="true" />
      <span className="login-blob login-blob--2" aria-hidden="true" />

      <div className="login-hero">
        <RouteArt />
        <img className="login-logo" src="/maway-logo.png" alt="" />
        <p className="login-brand">MaWay</p>
        {sentTo ? (
          <>
            <h1 className="login-title">{t('login.checkMailTitle')}</h1>
            <p className="login-sub">{t('login.checkMailSub', { email: sentTo })}</p>
          </>
        ) : (
          <>
            <h1 className="login-title">{t('login.title')}</h1>
            <p className="login-sub">{t('login.sub')}</p>
          </>
        )}
      </div>

      {!sentTo && (
        <div className="login-actions">
          <button type="button" className="auth-google" onClick={() => signInWithGoogle()}>
            <GoogleIcon size={20} />
            <span>{t('login.google')}</span>
          </button>

          {!showEmail ? (
            <button
              type="button"
              className="auth-alt"
              onClick={() => setShowEmail(true)}
            >
              {t('login.withEmail')}
            </button>
          ) : (
            <form className="auth-form" onSubmit={submit}>
              <div className="auth-tabs" role="group" aria-label={t('login.ariaLabel')}>
                <button
                  type="button"
                  className={`auth-tab ${mode === 'signin' ? 'active' : ''}`}
                  onClick={() => switchMode('signin')}
                >
                  {t('login.signIn')}
                </button>
                <button
                  type="button"
                  className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
                  onClick={() => switchMode('signup')}
                >
                  {t('login.signUp')}
                </button>
              </div>

              <input
                className="auth-input"
                type="email"
                dir="ltr"
                autoComplete="email"
                required
                placeholder={t('login.emailPlaceholder')}
                aria-label={t('login.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="auth-input"
                type="password"
                dir="ltr"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
                minLength={6}
                placeholder={t('login.passwordPlaceholder')}
                aria-label={t('login.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {errorCode && (
                <p className="auth-error" role="alert">{t(`login.err.${errorCode}`)}</p>
              )}

              <button type="submit" className="auth-submit" disabled={busy}>
                {busy
                  ? t('login.working')
                  : mode === 'signup' ? t('login.signUp') : t('login.signIn')}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

/** Decorative winding running-route with a start dot and an end pin. */
function RouteArt() {
  return (
    <svg
      className="login-art"
      viewBox="0 0 220 150"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M26 120 C 70 116 64 64 104 64 C 150 64 138 28 192 30"
        stroke="#3e9b76"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="1 12"
        opacity="0.9"
      />
      <circle cx="26" cy="120" r="9" fill="#fff" stroke="#3e9b76" strokeWidth="4" />
      <path
        d="M192 12 c10 0 18 8 18 18 0 13 -18 30 -18 30 s-18 -17 -18 -30 c0 -10 8 -18 18 -18 z"
        fill="#4a5a6b"
      />
      <circle cx="192" cy="30" r="6" fill="#fff" />
    </svg>
  );
}
