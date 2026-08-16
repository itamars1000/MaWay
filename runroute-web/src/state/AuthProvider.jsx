import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

/**
 * Sign-in via Supabase — Google, or plain email + password — required to use
 * the app (no guest mode) so every route is tied to an account. When Supabase
 * isn't configured at all (local dev without env vars) auth is simply off and
 * the app runs unauthenticated.
 *
 * Email sign-up goes through Supabase's "Confirm email" flow: signUp() creates
 * the user but no session, and the caller shows a "check your inbox" state
 * until the user clicks the link and comes back.
 */
const AuthContext = createContext(null);

/** Map a Supabase auth error to a stable code the UI maps to a message. */
function authErrorCode(error) {
  const msg = (error?.message || '').toLowerCase();
  // Raised by the signup_cap trigger (supabase/signup_cap.sql).
  if (msg.includes('signup_cap_reached')) return 'cap';
  if (msg.includes('already registered') || msg.includes('already exists')) return 'taken';
  if (msg.includes('invalid login credentials')) return 'badCreds';
  if (msg.includes('email not confirmed')) return 'unconfirmed';
  if (msg.includes('password')) return 'weakPassword';
  if (msg.includes('email')) return 'badEmail';
  if (msg.includes('rate limit') || error?.status === 429) return 'rateLimited';
  return 'generic';
}

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

  /* Email + password. Both resolve to { ok } or { ok: false, code } — never
     throw — so the form can render a friendly message per `code`. A successful
     sign-in needs no further action: onAuthStateChange sets `user`, which
     closes the login gate. A successful sign-up returns needsConfirm, since
     with "Confirm email" on there's no session until the link is clicked. */
  const signUpWithEmail = async (email, password) => {
    if (!supabase) return { ok: false, code: 'generic' };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) return { ok: false, code: authErrorCode(error) };
    // Session present => confirmation is disabled and they're already in.
    return { ok: true, needsConfirm: !data.session };
  };

  const signInWithEmail = async (email, password) => {
    if (!supabase) return { ok: false, code: 'generic' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, code: authErrorCode(error) };
    return { ok: true };
  };

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
    signUpWithEmail,
    signInWithEmail,
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
