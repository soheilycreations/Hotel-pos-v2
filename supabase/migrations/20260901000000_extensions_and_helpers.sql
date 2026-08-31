-- Extensions and generic helpers shared across every domain migration.
-- Every migration in this project must be replayable from an empty database
-- in file order with no manual dashboard steps in between (see
-- supabase/scripts/README.md for the one exception: destructive one-off
-- scripts, which are never part of this migration chain).

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "pg_trgm";    -- fuzzy/substring search on guest name & contact number

-- Generic updated_at maintenance, attached per-table where needed.
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
