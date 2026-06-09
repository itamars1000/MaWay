import { useAuth } from '../state/AuthProvider.jsx';
import { GoogleIcon } from './icons.jsx';

/**
 * Full-screen, app-style onboarding / sign-in shown on launch (and re-openable
 * from the header account button). Immersive brand background, a hero route
 * illustration, and actions anchored to the bottom (thumb zone). Sign in with
 * Google to save & sync routes, or skip as guest.
 */
export default function LoginScreen() {
  const { loginVisible, signInWithGoogle, continueAsGuest } = useAuth();
  if (!loginVisible) return null;

  return (
    <div className="login-screen" role="dialog" aria-modal="true" aria-label="התחברות">
      {/* soft decorative blobs for depth */}
      <span className="login-blob login-blob--1" aria-hidden="true" />
      <span className="login-blob login-blob--2" aria-hidden="true" />

      <div className="login-hero">
        <RouteArt />
        <img className="login-logo" src="/maway-logo.png" alt="MaWay" />
        <h1 className="login-title">מצא את הדרך שלך</h1>
        <p className="login-sub">
          מסלולי ריצה ישרים ורציפים — שמירה וסנכרון בין כל המכשירים שלך.
        </p>
      </div>

      <div className="login-actions">
        <button type="button" className="auth-google" onClick={() => signInWithGoogle()}>
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
      {/* end pin */}
      <path
        d="M192 12 c10 0 18 8 18 18 0 13 -18 30 -18 30 s-18 -17 -18 -30 c0 -10 8 -18 18 -18 z"
        fill="#4a5a6b"
      />
      <circle cx="192" cy="30" r="6" fill="#fff" />
    </svg>
  );
}
