import { useAuth } from '../state/AuthProvider.jsx';
import { GoogleIcon } from './icons.jsx';

/**
 * Optional sign-in modal. Sign in with Google to save & sync routes, or keep
 * using the app as a guest. Rendered only when `open` is true.
 */
export default function LoginModal({ open, onClose }) {
  const { signInWithGoogle } = useAuth();
  if (!open) return null;

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div
        className="auth-card"
        role="dialog"
        aria-modal="true"
        aria-label="התחברות"
        onClick={(e) => e.stopPropagation()}
      >
        <img className="auth-logo" src="/maway-logo.png" alt="MaWay" />
        <h2 className="auth-title">התחברות ל-MaWay</h2>
        <p className="auth-sub">
          התחבר כדי לשמור ולסנכרן את המסלולים שלך בין מכשירים.
        </p>

        <button
          type="button"
          className="auth-google"
          onClick={() => signInWithGoogle()}
        >
          <GoogleIcon size={20} />
          <span>התחבר עם Google</span>
        </button>

        <button type="button" className="auth-guest" onClick={onClose}>
          המשך כאורח
        </button>
      </div>
    </div>
  );
}
