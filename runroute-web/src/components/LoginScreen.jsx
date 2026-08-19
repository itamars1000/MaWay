import { useState } from 'react';
import { useAuth } from '../state/AuthProvider.jsx';
import { useT } from '../state/SettingsProvider.jsx';
import { GoogleIcon, ChevronIcon } from './icons.jsx';

/**
 * Full-screen onboarding / sign-in shown on launch. Sign-in and sign-up are the
 * same screen: the heading, fields and footer link swap with `mode`, and
 * sign-up adds a back arrow plus a confirm-password field. Signing in is
 * offered but not required — "continue as guest" dismisses the gate and the app
 * runs on local storage. A guest who reopens this from Settings can close it
 * again (`guest` is already true), so it doesn't become a trap.
 */
export default function LoginScreen() {
  const {
    loginVisible,
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    guest,
    continueAsGuest,
    dismissLogin,
  } = useAuth();
  const { t } = useT();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState(null);
  const [sentTo, setSentTo] = useState(null);

  // Keep rendering the "check your inbox" state even though no session exists
  // yet (loginVisible is still true) — it replaces the form in place. Only
  // reachable if email confirmation is turned back on in Supabase.
  if (!loginVisible && !sentTo) return null;

  const isSignup = mode === 'signup';

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
    // With confirmation off, sign-up returns a session and onAuthStateChange
    // closes the gate. If it's ever turned back on, show the inbox state.
    if (res.needsConfirm) setSentTo(email.trim());
  };

  const switchMode = (next) => {
    setMode(next);
    setErrorCode(null);
    setConfirm('');
  };

  if (sentTo) {
    return (
      <div className="login-screen" role="dialog" aria-modal="true" aria-label={t('login.ariaLabel')}>
        <div className="login-inner login-inner--sent">
          <span className="sent-badge" aria-hidden="true">✉</span>
          <h1 className="login-heading login-heading--center">{t('login.checkMailTitle')}</h1>
          <p className="sent-text">{t('login.checkMailSub', { email: sentTo })}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen" role="dialog" aria-modal="true" aria-label={t('login.ariaLabel')}>
      <div className="login-inner">
        {isSignup && (
          <button
            type="button"
            className="login-back"
            aria-label={t('login.back')}
            onClick={() => switchMode('signin')}
          >
            <ChevronIcon size={22} className="login-back-chev" />
          </button>
        )}

        <div className="login-mark">
          <img className="login-logo" src="/maway-logo.png" alt="" />
          <span className="login-brand">MaWay</span>
        </div>

        <h1 className="login-heading">
          {isSignup ? t('login.headingSignUp') : t('login.headingSignIn')}
        </h1>

        <form className="login-form" onSubmit={submit}>
          <input
            className="login-input"
            type="email"
            dir="ltr"
            autoComplete="email"
            required
            placeholder={t('login.emailLabel')}
            aria-label={t('login.emailLabel')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="login-input"
            type="password"
            dir="ltr"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            required
            minLength={6}
            placeholder={t('login.passwordLabel')}
            aria-label={t('login.passwordLabel')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {isSignup && (
            <input
              className="login-input"
              type="password"
              dir="ltr"
              autoComplete="new-password"
              required
              minLength={6}
              placeholder={t('login.confirmLabel')}
              aria-label={t('login.confirmLabel')}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          )}

          {errorCode && (
            <p className="login-error" role="alert">{t(`login.err.${errorCode}`)}</p>
          )}

          <button type="submit" className="login-submit" disabled={busy}>
            {busy ? t('login.working') : isSignup ? t('login.signUp') : t('login.signIn')}
          </button>
        </form>

        <p className="login-or">
          {isSignup ? t('login.orSignUp') : t('login.orSignIn')}
        </p>

        <div className="login-social">
          <button
            type="button"
            className="login-social-btn"
            aria-label={t('login.google')}
            onClick={() => signInWithGoogle()}
          >
            <GoogleIcon size={22} />
          </button>
        </div>

        <p className="login-switch">
          {isSignup ? t('login.haveAccount') : t('login.noAccount')}{' '}
          <button
            type="button"
            className="login-switch-link"
            onClick={() => switchMode(isSignup ? 'signin' : 'signup')}
          >
            {isSignup ? t('login.signIn') : t('login.signUp')}
          </button>
        </p>

        {/* An account only adds cross-device sync — routes save locally either
            way — so the way past this screen stays plainly visible. */}
        <button
          type="button"
          className="login-guest"
          onClick={guest ? dismissLogin : continueAsGuest}
        >
          {t('login.continueAsGuest')}
        </button>
      </div>
    </div>
  );
}
