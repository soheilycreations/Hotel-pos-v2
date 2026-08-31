-- Inventory core: items, purchases (replaces the old system's one-off
-- stock-import-*.sql scripts with a real table), recipes, and a full
-- stock-movement ledger (the old system deducted stock via a trigger with
-- no ledger and no floor at zero — see AUDIT_REPORT.md finding #4/#3).

create type public.inventory_unit as enum ('grams', 'ml', 'units');
create type public.stock_movement_type as enum (
  'PURCHASE', 'SALE', 'RECIPE_DEDUCTION', 'WASTE', 'ADJUSTMENT', 'RETURN', 'REVERSAL'
);
-- Fixed, closed set of movement kinds unlikely to need runtime editing —
-- an enum is appropriate here, unlike menu/expense categories.

create table public.suppliers (
  id             uuid primary key default gen_random_uuid(),
  name           varchar(120) not null,
  contact_number varchar(20),
  notes          text,
  created_at     timestamptz not null default now()
);

create table public.inventory_items (
  id                uuid primary key default gen_random_uuid(),
  name              varchar(120) not null,
  unit              public.inventory_unit not null,
  unit_cost         numeric(12,4) not null default 0 check (unit_cost >= 0),
  quantity_in_stock numeric(14,3) not null default 0 check (quantity_in_stock >= 0),
  reorder_level     numeric(14,3) not null default 0 check (reorder_level >= 0),
  version           int not null default 1,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger trg_inventory_items_updated_at
  before update on public.inventory_items for each row execute function public.tg_set_updated_at();
create index idx_inventory_low_stock on public.inventory_items (id) where quantity_in_stock <= reorder_level;

create table public.purchases (
  id              uuid primary key default gen_random_uuid(),
  supplier_id     uuid references public.suppliers (id) on delete restrict,
  invoice_number  varchar(60),
  purchase_date   date not null,
  status          varchar(20) not null default 'completed',
  created_by      uuid references public.staff_profiles (id),
  created_at      timestamptz not null default now()
);

create table public.purchase_items (
  id                uuid primary key default gen_random_uuid(),
  purchase_id       uuid not null references public.purchases (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id) on delete restrict,
  quantity          numeric(14,3) not null check (quantity > 0),
  unit_cost         numeric(12,4) not null check (unit_cost >= 0),
  line_total        numeric(14,2) generated always as (quantity * unit_cost) stored
);
create index idx_purchase_items_purchase on public.purchase_items (purchase_id);

create table public.recipe_ingredients (
  menu_item_id      uuid not null references public.menu_items (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id) on delete restrict,
  quantity_needed   numeric(14,3) not null check (quantity_needed > 0),
  primary key (menu_item_id, inventory_item_id)
);

-- The ledger the old system never had: every change to quantity_in_stock is
-- recorded here with a before/after snapshot. quantity_in_stock itself
-- becomes a CACHED column, mutated only by rpc_adjust_stock (see the RPC
-- migration) — never by a direct app-level UPDATE.
create table public.stock_movements (
  id                 uuid primary key default gen_random_uuid(),
  inventory_item_id  uuid not null references public.inventory_items (id) on delete restrict,
  movement_type      public.stock_movement_type not null,
  quantity           numeric(14,3) not null,   -- signed: +in, -out
  previous_quantity  numeric(14,3) not null,
  resulting_quantity numeric(14,3) not null check (resulting_quantity >= 0),
  reference_type     varchar(40),              -- 'purchase' | 'order' | 'manual' | ...
  reference_id       uuid,
  reason             text,
  created_by         uuid references public.staff_profiles (id),
  created_at         timestamptz not null default now()
);
create index idx_stock_movements_item on public.stock_movements (inventory_item_id, created_at desc);
create index idx_stock_movements_ref on public.stock_movements (reference_type, reference_id);

-- RLS

alter table public.suppliers enable row level security;
alter table public.inventory_items enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.stock_movements enable row level security;

create policy "suppliers read" on public.suppliers for select to authenticated using (public.has_permission('inventory.read'));
create policy "suppliers write" on public.suppliers for all to authenticated
  using (public.has_permission('inventory.adjust')) with check (public.has_permission('inventory.adjust'));

create policy "inventory_items read" on public.inventory_items for select to authenticated using (public.has_permission('inventory.read'));
-- No direct update policy on quantity_in_stock's containing row is blocked
-- entirely here for non-privileged writers — inventory_items rows besides
-- stock (name, unit_cost, reorder_level) are edited via roles.manage;
-- quantity_in_stock changes always go through rpc_adjust_stock, which runs
-- as SECURITY DEFINER and is therefore unaffected by this policy.
create policy "inventory_items write" on public.inventory_items for all to authenticated
  using (public.has_permission('roles.manage')) with check (public.has_permission('roles.manage'));

create policy "purchases read" on public.purchases for select to authenticated using (public.has_permission('inventory.read'));
create policy "purchases write" on public.purchases for all to authenticated
  using (public.has_permission('inventory.adjust')) with check (public.has_permission('inventory.adjust'));

create policy "purchase_items read" on public.purchase_items for select to authenticated using (public.has_permission('inventory.read'));
create policy "purchase_items write" on public.purchase_items for all to authenticated
  using (public.has_permission('inventory.adjust')) with check (public.has_permission('inventory.adjust'));

create policy "recipe_ingredients read" on public.recipe_ingredients for select to authenticated using (public.has_permission('inventory.read'));
create policy "recipe_ingredients write" on public.recipe_ingredients for all to authenticated
  using (public.has_permission('inventory.adjust')) with check (public.has_permission('inventory.adjust'));

create policy "stock_movements read" on public.stock_movements for select to authenticated using (public.has_permission('inventory.read'));
-- No direct insert policy: the only writer is rpc_adjust_stock (SECURITY
-- DEFINER), so an app-level insert bypassing that function's floor-at-zero
-- check and cached-column update is not possible even with inventory.adjust.
