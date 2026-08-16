import { useState } from 'react';
import { useAuth } from '../state/AuthProvider.jsx';
import { useT } from '../state/SettingsProvider.jsx';
import { GoogleIcon } from './icons.jsx';

/**
 * Full-screen onboarding / sign-in shown on launch. One page: sign-in and
 * sign-up share a segmented control over a single form, with Google as an
 * alternative below. Signing in is required — there is no guest mode.
 */
export default function LoginScreen() {
  const { loginVisible, signInWithGoogle, signUpWithEmail, signInWithEmail } = useAuth();
  const { t, lang } = useT();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState(null);
  const [sentTo, setSentTo] = useState(null); // set once a confirmation mail is sent

  // Keep rendering the "check your inbox" state even though no session exists
  // yet (loginVisible is still true) — it replaces the form in place.
  if (!loginVisible && !sentTo) return null;

  const isSignup = mode === 'signup';
  // The thumb starts at the inline-start slot; translateX is physical, so the
  // sign has to follow the document direction (same rule as SegmentedTabs).
  const thumbShift = !isSignup ? 0 : lang === 'he' ? -100 : 100;

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setErrorCode(null);

    if (isSignup && password !== confirm) {
      setErrorCode('mismatch');
      return;
    }

    setBusy(true);
    const fn = isSignup ? signUpWithEmail : signInWithEmail;
    const res = await fn(email.trim(), password);
    setBusy(false);

    if (!res.ok) {
      setErrorCode(res.code);
      return;
    }
    // Sign-in (or sign-up with confirmation off) → onAuthStateChange closes the
    // gate on its own. Sign-up needing confirmation → show the inbox state.
    if (res.needsConfirm) setSentTo(email.trim());
  };

  const switchMode = (next) => {
    setMode(next);
    setErrorCode(null);
    setConfirm('');
  };

  return (
    <div className="login-screen" role="dialog" aria-modal="true" aria-label={t('login.ariaLabel')}>
      <span className="login-blob login-blob--1" aria-hidden="true" />
      <span className="login-blob login-blob--2" aria-hidden="true" />

      <div className="login-inner">
        <header className="login-head">
          <img className="login-logo" src="/maway-logo.png" alt="" />
          <p className="login-brand">MaWay</p>
          <p className="login-sub">{t('login.sub')}</p>
        </header>

        {sentTo ? (
          <div className="login-card login-card--sent">
            <span className="sent-badge" aria-hidden="true">✉</span>
            <h1 className="sent-title">{t('login.checkMailTitle')}</h1>
            <p className="sent-text">{t('login.checkMailSub', { email: sentTo })}</p>
          </div>
        ) : (
          <div className="login-card">
            <div className="auth-seg" role="group" aria-label={t('login.ariaLabel')}>
              <span
                className="auth-seg-thumb"
                style={{ transform: `translateX(${thumbShift}%)` }}
                aria-hidden="true"
              />
              <button
                type="button"
                className={`auth-seg-btn ${!isSignup ? 'active' : ''}`}
                aria-pressed={!isSignup}
                onClick={() => switchMode('signin')}
              >
                {t('login.signIn')}
              </button>
              <button
                type="button"
                className={`auth-seg-btn ${isSignup ? 'active' : ''}`}
                aria-pressed={isSignup}
                onClick={() => switchMode('signup')}
              >
                {t('login.signUp')}
              </button>
            </div>

            <form className="auth-form" onSubmit={submit}>
              <label className="auth-field">
                <span className="auth-label">{t('login.emailLabel')}</span>
                <input
                  className="auth-input"
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>

              <label className="auth-field">
                <span className="auth-label">{t('login.passwordLabel')}</span>
                <input
                  className="auth-input"
                  type="password"
                  dir="ltr"
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>

              {isSignup && (
                <label className="auth-field">
                  <span className="auth-label">{t('login.confirmLabel')}</span>
                  <input
                    className="auth-input"
                    type="password"
                    dir="ltr"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </label>
              )}

              {errorCode && (
                <p className="auth-error" role="alert">{t(`login.err.${errorCode}`)}</p>
              )}

              <button type="submit" className="auth-submit" disabled={busy}>
                {busy ? t('login.working') : isSignup ? t('login.signUp') : t('login.signIn')}
              </button>
            </form>

            <div className="auth-divider"><span>{t('login.or')}</span></div>

            <button type="button" className="auth-google" onClick={() => signInWithGoogle()}>
              <GoogleIcon size={19} />
              <span>{t('login.google')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
