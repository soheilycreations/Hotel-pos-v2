-- Audit log (the old system's single biggest gap — AUDIT_REPORT.md finding
-- #1: admins could rewrite settled financial records with zero trace of
-- who/what/when) and hotel_settings (single-row config).

create table public.audit_log (
  id             uuid primary key default gen_random_uuid(),
  actor_id       uuid references public.staff_profiles (id),
  action         varchar(60) not null,   -- e.g. 'CORRECT_SETTLED_RECORD', 'VOID_ORDER', 'ADJUST_STOCK'
  entity_table   varchar(60) not null,
  entity_id      uuid not null,
  previous_value jsonb,
  new_value      jsonb,
  reason         text,
  metadata       jsonb,
  created_at     timestamptz not null default now()
);
create index idx_audit_log_entity on public.audit_log (entity_table, entity_id, created_at desc);
create index idx_audit_log_actor  on public.audit_log (actor_id, created_at desc);

alter table public.audit_log enable row level security;
create policy "audit_log read" on public.audit_log for select to authenticated using (public.has_permission('audit.read'));
-- Deliberately no insert/update/delete policy for any role — the only
-- writer is log_audit_event() below, called from inside the rpc_* functions
-- that perform corrections/voids/refunds/stock adjustments (see RPC
-- migration), so even an admin cannot delete or backdate their own trail.

create or replace function public.log_audit_event(
  p_action varchar,
  p_entity_table varchar,
  p_entity_id uuid,
  p_previous jsonb,
  p_new jsonb,
  p_reason text default null,
  p_metadata jsonb default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.audit_log (actor_id, action, entity_table, entity_id, previous_value, new_value, reason, metadata)
  values (auth.uid(), p_action, p_entity_table, p_entity_id, p_previous, p_new, p_reason, p_metadata)
  returning id into v_id;
  return v_id;
end;
$$;

create table public.hotel_settings (
  id                  int primary key default 1 check (id = 1),
  hotel_name          varchar(120) not null default 'Hotel Rawana',
  timezone            varchar(60) not null default 'Asia/Colombo',
  currency            varchar(8) not null default 'LKR',
  service_charge_rate numeric(5,2) not null default 10 check (service_charge_rate >= 0 and service_charge_rate <= 100),
  updated_at          timestamptz not null default now()
);
insert into public.hotel_settings (id) values (1);

create trigger trg_hotel_settings_updated_at
  before update on public.hotel_settings for each row execute function public.tg_set_updated_at();

alter table public.hotel_settings enable row level security;
create policy "hotel_settings read" on public.hotel_settings for select to authenticated using (true);
create policy "hotel_settings write" on public.hotel_settings for update to authenticated
  using (public.has_permission('roles.manage')) with check (public.has_permission('roles.manage'));
