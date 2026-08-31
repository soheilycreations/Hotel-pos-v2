-- POS core: tables, menu, orders, order items, and an explicit order
-- lifecycle state machine (the old system had 3 loosely-checked states with
-- no transition guard at all).

create type public.table_status   as enum ('vacant', 'occupied', 'reserved', 'billed');
create type public.channel_type   as enum ('dine_in', 'room_service', 'takeaway', 'delivery', 'banquet');
create type public.order_status   as enum (
  'draft', 'open', 'submitted', 'preparing', 'ready',
  'completed', 'settled', 'cancelled', 'voided', 'refunded'
);
create type public.delivery_status as enum ('pending', 'cooking', 'dispatched', 'delivered');

create table public.restaurant_tables (
  id         uuid primary key default gen_random_uuid(),
  name       varchar(40) not null,
  capacity   int not null check (capacity > 0),
  status     public.table_status not null default 'vacant',
  created_at timestamptz not null default now()
);

-- Table, not enum — menu categories change as the restaurant's offering
-- changes; the old system paid for converting this from an enum later.
create table public.menu_categories (
  id         uuid primary key default gen_random_uuid(),
  name       varchar(60) not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.menu_items (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references public.menu_categories (id) on delete restrict,
  name          varchar(120) not null,
  selling_price numeric(12,2) not null check (selling_price >= 0),
  other_cost    numeric(12,2) not null default 0 check (other_cost >= 0),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_menu_items_updated_at
  before update on public.menu_items for each row execute function public.tg_set_updated_at();

create table public.modifiers (
  id         uuid primary key default gen_random_uuid(),
  name       varchar(60) not null,
  price_delta numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.restaurant_orders (
  id                uuid primary key default gen_random_uuid(),
  channel_type      public.channel_type not null,
  order_status      public.order_status not null default 'draft',
  table_id          uuid references public.restaurant_tables (id) on delete restrict,
  booking_id        uuid references public.bookings (id) on delete restrict,
  delivery_address  text,
  delivery_status   public.delivery_status,
  event_name        varchar(120),
  subtotal          numeric(14,2) not null default 0 check (subtotal >= 0),
  service_charge    numeric(14,2) not null default 0 check (service_charge >= 0),
  service_charge_waived boolean not null default false,
  total_amount      numeric(14,2) not null default 0 check (total_amount >= 0),
  business_date     date not null,
  settled_at        timestamptz,
  settled_by        uuid references public.staff_profiles (id),
  version           int not null default 1,
  created_by        uuid references public.staff_profiles (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint chk_dine_in_table   check (channel_type <> 'dine_in'      or table_id is not null),
  constraint chk_room_service    check (channel_type <> 'room_service' or booking_id is not null),
  constraint chk_delivery_fields check (channel_type <> 'delivery'     or delivery_address is not null),
  constraint chk_banquet_event   check (channel_type <> 'banquet'      or event_name is not null)
);
create trigger trg_restaurant_orders_updated_at
  before update on public.restaurant_orders for each row execute function public.tg_set_updated_at();
create index idx_orders_business_date on public.restaurant_orders (business_date);
create index idx_orders_status on public.restaurant_orders (order_status);
create index idx_orders_reporting on public.restaurant_orders (business_date, order_status, channel_type);
create index idx_orders_created_by on public.restaurant_orders (created_by);

alter table public.payments
  add constraint fk_payments_order foreign key (order_id) references public.restaurant_orders (id) on delete restrict;

create table public.order_items (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.restaurant_orders (id) on delete cascade,
  menu_item_id       uuid references public.menu_items (id) on delete restrict,
  is_custom          boolean not null default false,
  custom_description varchar(200),
  quantity           int not null check (quantity > 0),
  unit_price         numeric(12,2) not null check (unit_price >= 0),
  line_total         numeric(14,2) generated always as (quantity * unit_price) stored,
  service_chargeable boolean not null default true,
  kot_printed_at     timestamptz,
  created_at         timestamptz not null default now(),
  constraint chk_order_item_shape check (
    (is_custom = true  and menu_item_id is null     and custom_description is not null) or
    (is_custom = false and menu_item_id is not null and custom_description is null)
  )
);
create index idx_order_items_order on public.order_items (order_id);
create index idx_order_items_pending_kot on public.order_items (order_id) where kot_printed_at is null;

create table public.order_item_modifiers (
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  modifier_id   uuid not null references public.modifiers (id) on delete restrict,
  primary key (order_item_id, modifier_id)
);

-- Explicit state machine: transitions not listed here are rejected outright
-- instead of silently allowed (the old system had no such guard). The
-- transition set is DATA (this table), so adding a new legal transition
-- later is a seed insert, not a schema migration or code change.
create table public.order_status_transitions (
  from_status public.order_status not null,
  to_status   public.order_status not null,
  primary key (from_status, to_status)
);

create or replace function public.tg_validate_order_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.order_status is distinct from old.order_status then
    if not exists (
      select 1 from public.order_status_transitions
      where from_status = old.order_status and to_status = new.order_status
    ) then
      raise exception 'Invalid order status transition: % -> %', old.order_status, new.order_status
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_validate_order_status_transition
  before update of order_status on public.restaurant_orders
  for each row execute function public.tg_validate_order_status_transition();

-- RLS

alter table public.restaurant_tables enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.modifiers enable row level security;
alter table public.restaurant_orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_modifiers enable row level security;
alter table public.order_status_transitions enable row level security;

create policy "restaurant_tables read" on public.restaurant_tables for select to authenticated using (public.has_permission('pos.orders.read'));
create policy "restaurant_tables write" on public.restaurant_tables for all to authenticated
  using (public.has_permission('pos.orders.write')) with check (public.has_permission('pos.orders.write'));

create policy "menu_categories read" on public.menu_categories for select to authenticated using (public.has_permission('pos.orders.read'));
create policy "menu_categories write" on public.menu_categories for all to authenticated
  using (public.has_permission('roles.manage')) with check (public.has_permission('roles.manage'));

create policy "menu_items read" on public.menu_items for select to authenticated using (public.has_permission('pos.orders.read'));
create policy "menu_items write" on public.menu_items for all to authenticated
  using (public.has_permission('roles.manage')) with check (public.has_permission('roles.manage'));

create policy "modifiers read" on public.modifiers for select to authenticated using (public.has_permission('pos.orders.read'));
create policy "modifiers write" on public.modifiers for all to authenticated
  using (public.has_permission('roles.manage')) with check (public.has_permission('roles.manage'));

create policy "restaurant_orders read" on public.restaurant_orders for select to authenticated using (public.has_permission('pos.orders.read'));
-- Direct insert/update covers draft/open order editing (adding items,
-- changing table). Settlement, void, and refund transitions MUST go through
-- rpc_settle_pos_order / rpc_void_pos_order / rpc_refund_order (see RPC
-- migration) — those are the only paths that re-lock+re-sum the order,
-- deduct inventory, post payments, and audit-log atomically.
create policy "restaurant_orders write" on public.restaurant_orders for all to authenticated
  using (public.has_permission('pos.orders.write')) with check (public.has_permission('pos.orders.write'));

create policy "order_items read" on public.order_items for select to authenticated using (public.has_permission('pos.orders.read'));
create policy "order_items write" on public.order_items for all to authenticated
  using (public.has_permission('pos.orders.write')) with check (public.has_permission('pos.orders.write'));

create policy "order_item_modifiers read" on public.order_item_modifiers for select to authenticated using (public.has_permission('pos.orders.read'));
create policy "order_item_modifiers write" on public.order_item_modifiers for all to authenticated
  using (public.has_permission('pos.orders.write')) with check (public.has_permission('pos.orders.write'));

create policy "order_status_transitions read" on public.order_status_transitions for select to authenticated using (true);
create policy "order_status_transitions write" on public.order_status_transitions for all to authenticated
  using (public.has_permission('roles.manage')) with check (public.has_permission('roles.manage'));
