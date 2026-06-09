// Shared Supabase client. Reads the public project URL + publishable/anon key
// from env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). These are safe to ship
// in the browser bundle — access is protected by Row Level Security on the
// tables, not by hiding the key.
//
// If the env vars are missing (not configured yet), `supabase` is null and the
// app degrades gracefully to guest-only (no sign-in button shown).
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true, // completes the OAuth redirect on return
        },
      })
    : null;

export const isSupabaseConfigured = Boolean(supabase);
