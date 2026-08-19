import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';
import { getClientId, isGuest, setGuest, clearGuest, wasEverGuest } from '../lib/analytics.js';

/**
 * Sign-in via Supabase — Google, or plain email + password. Signing in is
 * offered first but not required: "continue as guest" dismisses the gate and
 * the app runs on local storage only (AppState already treats a null user that
 * way, and merges local routes into the cloud on a later sign-in). When
 * Supabase isn't configured at all (local dev without env vars) auth is simply
 * off and everyone is a guest.
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
  // Before the generic password/email matches below: the real throttle messages
  // ("Email rate limit exceeded", "over_email_send_rate_limit") contain "email",
  // so checking that first would tell a throttled user their address is invalid.
  if (msg.includes('rate limit') || msg.includes('rate_limit') || error?.status === 429)
    return 'rateLimited';
  if (msg.includes('password')) return 'weakPassword';
  if (msg.includes('email')) return 'badEmail';
  return 'generic';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // If auth isn't configured we're "ready" immediately (no login gate).
  const [ready, setReady] = useState(!isSupabaseConfigured);
  // Chose to use the app without an account. Persisted, so a reload doesn't
  // put the gate back in front of someone who already declined it.
  const [guest, setGuestState] = useState(isGuest);
  // Set when a guest asks for the login screen again (from Settings), which
  // re-shows the gate without giving up guest mode if they close it.
  const [loginRequested, setLoginRequested] = useState(false);

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
      if (session?.user) setLoginRequested(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Stamp the device's anonymous id on the account the first time it signs in.
  // This is the only link between "someone generated routes as a guest" and
  // "that person now has an account" — without it the funnel can count both
  // ends but never the conversion between them. Written once (the guard skips
  // accounts that already carry it), and never for a user who was never a
  // guest on this device, so it can't overwrite an earlier attribution.
  useEffect(() => {
    if (!supabase || !user) return;
    if (user.user_metadata?.anon_id) return;
    // Fire-and-forget inside try/catch rather than a bare `.catch`: measurement
    // must never be able to break signing in, whatever the call does.
    (async () => {
      try {
        await supabase.auth.updateUser({
          data: { anon_id: getClientId(), was_guest: wasEverGuest() },
        });
      } catch (err) {
        console.warn('attribution skipped:', err?.message || err);
      }
    })();
  }, [user]);

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

  const signOut = () => {
    // Leave guest mode too, so signing out lands on the login screen rather
    // than silently continuing as an anonymous user.
    clearGuest();
    setGuestState(false);
    setLoginRequested(false);
    return supabase?.auth.signOut();
  };

  /** Dismiss the gate and use the app without an account. */
  const continueAsGuest = () => {
    setGuest();
    setGuestState(true);
    setLoginRequested(false);
  };

  /** Re-open the gate for a guest who wants an account after all. */
  const openLogin = () => setLoginRequested(true);
  const dismissLogin = () => setLoginRequested(false);

  // Full-screen login gate: shown whenever auth is configured, state has
  // loaded, and nobody is signed in — unless they chose guest mode, which
  // only `openLogin()` (or signing out) brings the gate back from.
  const loginVisible =
    isSupabaseConfigured && ready && !user && (!guest || loginRequested);

  const value = {
    user,
    ready,
    authEnabled: isSupabaseConfigured,
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    signOut,
    loginVisible,
    guest,
    continueAsGuest,
    openLogin,
    dismissLogin,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
