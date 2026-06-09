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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // If auth isn't configured we're "ready" immediately (guest-only).
  const [ready, setReady] = useState(!isSupabaseConfigured);

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

  const value = {
    user,
    ready,
    authEnabled: isSupabaseConfigured,
    signInWithGoogle,
    signOut,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
