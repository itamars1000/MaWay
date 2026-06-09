import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../state/AuthProvider.jsx';
import { UserIcon } from './icons.jsx';
import LoginModal from './LoginModal.jsx';

/**
 * Compact header control for optional sign-in.
 *   - signed out → a person button that opens the login modal
 *   - signed in  → the Google avatar (or initial), tapping shows a sign-out menu
 * Renders nothing when auth isn't configured, so the app stays guest-only.
 */
export default function AuthButton() {
  const { user, authEnabled, signOut } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onDocClick);
    return () => document.removeEventListener('pointerdown', onDocClick);
  }, [menuOpen]);

  if (!authEnabled) return null;

  if (!user) {
    return (
      <>
        <button
          type="button"
          className="auth-pill glass-pill"
          aria-label="התחבר"
          onClick={() => setModalOpen(true)}
        >
          <UserIcon size={20} />
        </button>
        <LoginModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  const meta = user.user_metadata ?? {};
  const name = meta.full_name || meta.name || user.email || 'משתמש';
  const avatar = meta.avatar_url || meta.picture || null;
  const initial = (name || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="auth-wrap" ref={wrapRef}>
      <button
        type="button"
        className="auth-pill glass-pill"
        aria-label="חשבון"
        onClick={() => setMenuOpen((o) => !o)}
      >
        {avatar ? (
          <img className="auth-avatar" src={avatar} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="auth-initial">{initial}</span>
        )}
      </button>

      {menuOpen && (
        <div className="auth-menu glass-pill">
          <div className="auth-menu-name">{name}</div>
          <button
            type="button"
            className="auth-menu-item"
            onClick={() => {
              setMenuOpen(false);
              signOut();
            }}
          >
            התנתק
          </button>
        </div>
      )}
    </div>
  );
}
