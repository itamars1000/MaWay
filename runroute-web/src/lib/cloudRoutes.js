// Supabase persistence for saved routes (per-user, protected by RLS). Each row
// is { id, user_id, data: <route item>, created_at }. All functions no-op when
// Supabase isn't configured, and callers should treat failures as non-fatal —
// localStorage stays the local source of truth, the cloud is a sync mirror.
import { supabase } from './supabase.js';

const TABLE = 'saved_routes';

/** Fetch the signed-in user's routes (newest first). RLS limits to own rows. */
export async function fetchCloudRoutes() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, data, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  // The route item is stored in `data`; keep the row id authoritative.
  return (data ?? []).map((row) => ({ ...row.data, id: row.id }));
}

/** Insert or update one route for the user (keyed by user_id + id). */
export async function upsertCloudRoute(userId, item) {
  if (!supabase || !userId) return;
  const { error } = await supabase.from(TABLE).upsert(
    {
      id: item.id,
      user_id: userId,
      data: item,
      created_at: new Date(item.createdAt || Date.now()).toISOString(),
    },
    { onConflict: 'user_id,id' },
  );
  if (error) throw error;
}

/** Delete one route by id (RLS ensures it's the user's own). */
export async function deleteCloudRoute(id) {
  if (!supabase) return;
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

/** Delete all of the user's routes. */
export async function clearCloudRoutes(userId) {
  if (!supabase || !userId) return;
  const { error } = await supabase.from(TABLE).delete().eq('user_id', userId);
  if (error) throw error;
}
