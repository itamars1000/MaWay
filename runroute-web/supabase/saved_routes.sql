-- MaWay — saved routes table + Row Level Security.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Each row holds one saved route for one user; the route object lives in `data`.

create table if not exists public.saved_routes (
  id         text        not null,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  data       jsonb       not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Fast "my routes, newest first" lookups.
create index if not exists saved_routes_user_created_idx
  on public.saved_routes (user_id, created_at desc);

-- Lock it down: a user may only ever touch their own rows.
alter table public.saved_routes enable row level security;

drop policy if exists "saved_routes_select_own" on public.saved_routes;
create policy "saved_routes_select_own" on public.saved_routes
  for select using (auth.uid() = user_id);

drop policy if exists "saved_routes_insert_own" on public.saved_routes;
create policy "saved_routes_insert_own" on public.saved_routes
  for insert with check (auth.uid() = user_id);

drop policy if exists "saved_routes_update_own" on public.saved_routes;
create policy "saved_routes_update_own" on public.saved_routes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "saved_routes_delete_own" on public.saved_routes;
create policy "saved_routes_delete_own" on public.saved_routes
  for delete using (auth.uid() = user_id);
