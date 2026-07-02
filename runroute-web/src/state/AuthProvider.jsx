import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

/**
 * Google sign-in via Supabase, required to use the app (no guest mode) so every
 * route is tied to an account. When Supabase isn't configured at all (local dev
 * without env vars) auth is simply off and the app runs unauthenticated.
 *
 * Exposes: { user, ready, authEnabled, signInWithGoogle, signOut, loginVisible }.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // If auth isn't configured we're "ready" immediately (no login gate).
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

  // Full-screen login gate: shown whenever auth is configured, state has
  // loaded, and nobody is signed in — including right after signOut(), since
  // that clears `user` and this recomputes with no guest bypass to skip it.
  const loginVisible = isSupabaseConfigured && ready && !user;

  const value = {
    user,
    ready,
    authEnabled: isSupabaseConfigured,
    signInWithGoogle,
    signOut,
    loginVisible,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
