-- Roles and permissions modeled as DATA, not enum types. The old system's
-- `staff_role` enum (and its `expense_category`/`menu_category` enums
-- elsewhere) required an enum->table conversion migration later, which
-- caused real fragility (see AUDIT_REPORT.md and migrations 005/006/009 in
-- the old repo: `ALTER TYPE ... ADD VALUE` followed by a later migration
-- dropping the type entirely, order-dependent and unsafe to replay from
-- empty). Any concept that plausibly grows or changes without a code
-- deploy — roles, permissions, expense/menu categories — is a table from
-- day one here. Fixed, closed sets that will not need runtime editing
-- (order_status, stock_movement_type, credit_transaction_type,
-- payment_method) remain enums, defined in their own domain migrations.

create table public.roles (
  id          text primary key,
  label       varchar(60) not null,
  description text,
  is_system   boolean not null default true,   -- seeded roles; not deletable from the UI
  created_at  timestamptz not null default now()
);

create table public.permissions (
  id          text primary key,   -- dot-namespaced, e.g. 'bookings.write' — see src/server/auth/permissions.ts PERMISSIONS
  category    varchar(40) not null,
  description text
);

create table public.role_permissions (
  role_id       text not null references public.roles (id) on delete cascade,
  permission_id text not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.staff_profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  full_name    varchar(120) not null,
  role_id      text not null references public.roles (id),
  is_active    boolean not null default true,
  version      int not null default 1,   -- optimistic locking (see rpc functions migration)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_staff_profiles_updated_at
  before update on public.staff_profiles
  for each row execute function public.tg_set_updated_at();

create index idx_staff_profiles_role on public.staff_profiles (role_id);

-- SECURITY DEFINER so it can read staff_profiles/role_permissions from
-- inside an RLS policy without recursing into that policy. Every
-- SECURITY DEFINER function in this project sets search_path = public —
-- no exceptions (the old system's tg_apply_booking_charge was the one
-- outlier that omitted it).
create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_profiles sp
    join public.role_permissions rp on rp.role_id = sp.role_id
    where sp.id = auth.uid()
      and sp.is_active = true
      and rp.permission_id = p_permission
  );
$$;

create or replace function public.get_my_role_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role_id from public.staff_profiles where id = auth.uid() and is_active = true;
$$;

-- RLS

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.staff_profiles enable row level security;

-- Catalog/mapping tables carry no sensitive data (just ids/labels) and every
-- signed-in user needs to read them to resolve their own permission set
-- (src/server/auth/session.ts queries role_permissions directly under the
-- normal, non-admin client) — so read access is open to any authenticated
-- user, write access is gated behind 'roles.manage'.
create policy "roles readable by authenticated" on public.roles
  for select to authenticated using (true);
create policy "roles managed by roles.manage" on public.roles
  for all to authenticated
  using (public.has_permission('roles.manage'))
  with check (public.has_permission('roles.manage'));

create policy "permissions readable by authenticated" on public.permissions
  for select to authenticated using (true);
create policy "permissions managed by roles.manage" on public.permissions
  for all to authenticated
  using (public.has_permission('roles.manage'))
  with check (public.has_permission('roles.manage'));

create policy "role_permissions readable by authenticated" on public.role_permissions
  for select to authenticated using (true);
create policy "role_permissions managed by roles.manage" on public.role_permissions
  for all to authenticated
  using (public.has_permission('roles.manage'))
  with check (public.has_permission('roles.manage'));

-- staff_profiles: self can read their own row; staff.manage can read/write
-- all. No self-service update policy at all (not even for one's own row) —
-- this deliberately closes the "self-escalate role_id/is_active" hole
-- without needing column-level RLS tricks; profile edits always go through
-- a staff.manage-gated action even for "edit my own display name".
create policy "staff read own profile" on public.staff_profiles
  for select to authenticated
  using (id = auth.uid() or public.has_permission('staff.manage'));

create policy "staff_profiles managed by staff.manage" on public.staff_profiles
  for all to authenticated
  using (public.has_permission('staff.manage'))
  with check (public.has_permission('staff.manage'));
