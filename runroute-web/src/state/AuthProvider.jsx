import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

/**
 * Optional Google sign-in via Supabase. The app works fully as a guest; signing
 * in is only needed to save/sync routes across devices (sync lands in phase 2).
 *
 * Exposes: { user, ready, authEnabled, signInWithGoogle, signOut }.
 * When Supabase isn't configured, authEnabled is false and the UI hides sign-in.
 */
const AuthContext = createContext(null);

const GUEST_KEY = 'maway:guestSkip'; // remembers the user chose to continue as guest

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // If auth isn't configured we're "ready" immediately (guest-only).
  const [ready, setReady] = useState(!isSupabaseConfigured);
  // Has the user dismissed the launch login screen as a guest (persisted)?
  const [guestSkip, setGuestSkip] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem(GUEST_KEY) === '1',
  );
  // Force the login screen open (e.g. tapping the header account button later).
  const [forceLogin, setForceLogin] = useState(false);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = () =>
    supabase?.auth.signInWithOAuth({
      provider: 'google',
      // Return to the current page after the Google round-trip.
      options: { redirectTo: window.location.origin },
    });

  const signOut = () => supabase?.auth.signOut();

  // Full-screen login is shown on launch when auth is configured, state has
  // loaded, nobody is signed in, and the user hasn't already skipped as guest.
  // It can also be force-opened later from the header account button.
  const loginVisible =
    isSupabaseConfigured && ready && !user && (forceLogin || !guestSkip);

  const continueAsGuest = () => {
    setGuestSkip(true);
    try {
      localStorage.setItem(GUEST_KEY, '1');
    } catch {
      /* ignore storage errors (private mode) */
    }
    setForceLogin(false);
  };

  const openLogin = () => setForceLogin(true);

  const value = {
    user,
    ready,
    authEnabled: isSupabaseConfigured,
    signInWithGoogle,
    signOut,
    loginVisible,
    openLogin,
    continueAsGuest,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
