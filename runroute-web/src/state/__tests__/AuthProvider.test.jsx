import { render, renderHook, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Fake Supabase client. `isSupabaseConfigured` is read at module scope by the
// provider, so tests that need auth switched off re-import with it false.
const authApi = {
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOAuth: vi.fn(),
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
};
let configured = true;
vi.mock('../../lib/supabase.js', () => ({
  get supabase() {
    return configured ? { auth: authApi } : null;
  },
  get isSupabaseConfigured() {
    return configured;
  },
}));

import { AuthProvider, useAuth } from '../AuthProvider.jsx';

const USER = { id: 'u1', email: 'runner@maway.app' };
const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

/** Renders useAuth() and waits for the initial getSession() to settle. */
async function mountAuth() {
  const view = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(view.result.current.ready).toBe(true));
  return view;
}

let emitAuthChange;

beforeEach(() => {
  configured = true;
  authApi.getSession.mockResolvedValue({ data: { session: null } });
  authApi.onAuthStateChange.mockImplementation((cb) => {
    emitAuthChange = cb;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
});

describe('AuthProvider — the login gate', () => {
  it('shows the gate once state has loaded and nobody is signed in', async () => {
    const { result } = await mountAuth();
    expect(result.current.user).toBeNull();
    expect(result.current.loginVisible).toBe(true);
  });

  it('does not flash the gate before the session has loaded', async () => {
    let resolve;
    authApi.getSession.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.ready).toBe(false);
    expect(result.current.loginVisible).toBe(false);

    // Let the pending getSession() settle so the state update stays inside act().
    await act(async () => {
      resolve({ data: { session: null } });
    });
    expect(result.current.loginVisible).toBe(true);
  });

  it('hides the gate for an existing session', async () => {
    authApi.getSession.mockResolvedValue({ data: { session: { user: USER } } });
    const { result } = await mountAuth();

    expect(result.current.user).toEqual(USER);
    expect(result.current.loginVisible).toBe(false);
  });

  it('closes the gate when onAuthStateChange reports a sign-in', async () => {
    const { result } = await mountAuth();

    act(() => emitAuthChange('SIGNED_IN', { user: USER }));

    expect(result.current.user).toEqual(USER);
    expect(result.current.loginVisible).toBe(false);
  });

  it('reopens the gate when the session goes away (sign-out)', async () => {
    authApi.getSession.mockResolvedValue({ data: { session: { user: USER } } });
    const { result } = await mountAuth();

    act(() => emitAuthChange('SIGNED_OUT', null));

    expect(result.current.user).toBeNull();
    expect(result.current.loginVisible).toBe(true);
  });

  it('unsubscribes from auth changes on unmount', async () => {
    const unsubscribe = vi.fn();
    authApi.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } });
    const { unmount } = await mountAuth();

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('stays open with no gate when Supabase is not configured', () => {
    configured = false;
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.authEnabled).toBe(false);
    expect(result.current.ready).toBe(true);
    expect(result.current.loginVisible).toBe(false);
    expect(authApi.getSession).not.toHaveBeenCalled();
  });
});

describe('AuthProvider — signInWithEmail', () => {
  it('returns ok on success', async () => {
    authApi.signInWithPassword.mockResolvedValue({ error: null });
    const { result } = await mountAuth();

    await expect(
      result.current.signInWithEmail('runner@maway.app', 'secret123'),
    ).resolves.toEqual({ ok: true });
    expect(authApi.signInWithPassword).toHaveBeenCalledWith({
      email: 'runner@maway.app',
      password: 'secret123',
    });
  });

  it.each([
    ['Invalid login credentials', 'badCreds'],
    ['Email not confirmed', 'unconfirmed'],
    ['signup_cap_reached', 'cap'],
    ['Password should be at least 6 characters', 'weakPassword'],
    ['Unable to validate email address: invalid format', 'badEmail'],
    ['Something unexpected', 'generic'],
  ])('maps %j to code %j', async (message, code) => {
    authApi.signInWithPassword.mockResolvedValue({ error: { message } });
    const { result } = await mountAuth();

    await expect(result.current.signInWithEmail('a@b.co', 'x')).resolves.toEqual({
      ok: false,
      code,
    });
  });

  it('maps a 429 without a matching message to rateLimited', async () => {
    authApi.signInWithPassword.mockResolvedValue({
      error: { message: 'Too many requests', status: 429 },
    });
    const { result } = await mountAuth();

    await expect(result.current.signInWithEmail('a@b.co', 'x')).resolves.toEqual({
      ok: false,
      code: 'rateLimited',
    });
  });
});

// Regression: Supabase's throttle messages mention "email", so a naive
// left-to-right match told a throttled user their address was invalid — they'd
// keep retyping a perfectly good email instead of waiting it out.
describe('AuthProvider — throttling beats the generic email/password matches', () => {
  const THROTTLE_MESSAGES = [
    'Email rate limit exceeded',
    'over_email_send_rate_limit',
    'For security purposes, you can only request this after 51 seconds',
    'Request rate limit reached',
  ];

  it.each(THROTTLE_MESSAGES)('sign-up: %j maps to rateLimited', async (message) => {
    authApi.signUp.mockResolvedValue({ error: { message, status: 429 } });
    const { result } = await mountAuth();

    await expect(result.current.signUpWithEmail('a@b.co', 'secret123')).resolves.toEqual({
      ok: false,
      code: 'rateLimited',
    });
  });

  it.each(THROTTLE_MESSAGES)('sign-in: %j maps to rateLimited', async (message) => {
    authApi.signInWithPassword.mockResolvedValue({ error: { message, status: 429 } });
    const { result } = await mountAuth();

    await expect(result.current.signInWithEmail('a@b.co', 'secret123')).resolves.toEqual({
      ok: false,
      code: 'rateLimited',
    });
  });

  it('still maps a genuinely invalid address to badEmail', async () => {
    authApi.signUp.mockResolvedValue({
      error: { message: 'Unable to validate email address: invalid format' },
    });
    const { result } = await mountAuth();

    await expect(result.current.signUpWithEmail('nope', 'secret123')).resolves.toEqual({
      ok: false,
      code: 'badEmail',
    });
  });

  it('still maps a weak password to weakPassword', async () => {
    authApi.signUp.mockResolvedValue({
      error: { message: 'Password should be at least 6 characters' },
    });
    const { result } = await mountAuth();

    await expect(result.current.signUpWithEmail('a@b.co', '123')).resolves.toEqual({
      ok: false,
      code: 'weakPassword',
    });
  });
});

describe('AuthProvider — signUpWithEmail', () => {
  it('reports needsConfirm when sign-up returns no session', async () => {
    authApi.signUp.mockResolvedValue({ data: { session: null }, error: null });
    const { result } = await mountAuth();

    await expect(result.current.signUpWithEmail('a@b.co', 'secret123')).resolves.toEqual({
      ok: true,
      needsConfirm: true,
    });
  });

  it('reports no confirmation needed when a session comes back', async () => {
    authApi.signUp.mockResolvedValue({ data: { session: { user: USER } }, error: null });
    const { result } = await mountAuth();

    await expect(result.current.signUpWithEmail('a@b.co', 'secret123')).resolves.toEqual({
      ok: true,
      needsConfirm: false,
    });
  });

  it('maps an already-registered email to taken', async () => {
    authApi.signUp.mockResolvedValue({ error: { message: 'User already registered' } });
    const { result } = await mountAuth();

    await expect(result.current.signUpWithEmail('a@b.co', 'secret123')).resolves.toEqual({
      ok: false,
      code: 'taken',
    });
  });

  it('maps the signup cap trigger to cap', async () => {
    authApi.signUp.mockResolvedValue({
      error: { message: 'Database error saving new user: signup_cap_reached' },
    });
    const { result } = await mountAuth();

    await expect(result.current.signUpWithEmail('a@b.co', 'secret123')).resolves.toEqual({
      ok: false,
      code: 'cap',
    });
  });

  it('never throws when Supabase is not configured', async () => {
    configured = false;
    const { result } = renderHook(() => useAuth(), { wrapper });

    await expect(result.current.signUpWithEmail('a@b.co', 'secret123')).resolves.toEqual({
      ok: false,
      code: 'generic',
    });
    await expect(result.current.signInWithEmail('a@b.co', 'secret123')).resolves.toEqual({
      ok: false,
      code: 'generic',
    });
  });
});

describe('AuthProvider — Google', () => {
  it('sends the OAuth round-trip back to the current origin', async () => {
    const { result } = await mountAuth();

    result.current.signInWithGoogle();

    expect(authApi.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  });
});

describe('useAuth', () => {
  it('throws outside of an AuthProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Bare() {
      useAuth();
      return null;
    }
    expect(() => render(<Bare />)).toThrow(/must be used within an AuthProvider/);
    spy.mockRestore();
  });
});
