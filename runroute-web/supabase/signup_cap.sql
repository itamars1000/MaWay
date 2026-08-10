-- MaWay — hard cap on new sign-ups (soft-launch testing phase).
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
--
-- Blocks NEW registrations once auth.users reaches MAX_USERS. Existing users
-- can always sign back in — a sign-in doesn't insert a new auth.users row, so
-- the trigger (BEFORE INSERT only) never fires for them.
--
-- To raise/remove the cap later: edit the constant below and re-run this
-- file (create or replace), or just `drop trigger signup_cap_trigger on auth.users;`.

create or replace function public.enforce_signup_cap()
returns trigger as $$
declare
  max_users constant int := 20;
  current_count int;
begin
  select count(*) into current_count from auth.users;
  if current_count >= max_users then
    raise exception 'signup_cap_reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, auth;

drop trigger if exists signup_cap_trigger on auth.users;
create trigger signup_cap_trigger
  before insert on auth.users
  for each row execute function public.enforce_signup_cap();
