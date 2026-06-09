import { useAuth } from '../state/AuthProvider.jsx';
import { GoogleIcon } from './icons.jsx';

/**
 * Full-screen, optional sign-in shown on launch (and re-openable from the header
 * account button). Sign in with Google to save & sync routes, or skip as guest.
 * Renders nothing unless the auth context says it should be visible.
 */
export default function LoginScreen() {
  const { loginVisible, signInWithGoogle, continueAsGuest } = useAuth();
  if (!loginVisible) return null;

  return (
    <div className="login-screen" role="dialog" aria-modal="true" aria-label="התחברות">
      <div className="login-inner">
        <img className="login-logo" src="/maway-logo.png" alt="MaWay" />
        <h1 className="login-title">מצא את הדרך שלך</h1>
        <p className="login-sub">
          התחבר כדי לשמור ולסנכרן את המסלולים שלך בין מכשירים — או המשך כאורח.
        </p>

        <button
          type="button"
          className="auth-google"
          onClick={() => signInWithGoogle()}
        >
          <GoogleIcon size={20} />
          <span>התחבר עם Google</span>
        </button>

        <button type="button" className="auth-guest" onClick={continueAsGuest}>
          המשך כאורח
        </button>
      </div>
    </div>
  );
}
