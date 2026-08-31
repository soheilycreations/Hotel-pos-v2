-- Required application data, not optional dev fixtures — the app cannot
-- authorize anything or transition an order's status without these rows,
-- so they live in a real numbered migration (replayed on every environment
-- including production), not in supabase/seed.sql (dev-only, idempotent
-- demo data — see that file).
--
-- Permission ids here MUST stay in sync with
-- src/server/auth/permissions.ts PERMISSIONS.

insert into public.permissions (id, category, description) values
  ('bookings.read',           'pms',     'View guests, rooms, and bookings'),
  ('bookings.write',          'pms',     'Create/edit bookings, rooms, guests'),
  ('pms.checkin',             'pms',     'Check a guest in'),
  ('pms.checkout',            'pms',     'Check a guest out'),
  ('pos.orders.read',         'pos',     'View restaurant orders'),
  ('pos.orders.write',        'pos',     'Create/edit restaurant orders and items'),
  ('pos.settle',              'pos',     'Settle a restaurant order (payment + stock deduction)'),
  ('pos.void',                'pos',     'Void a pre-settlement restaurant order'),
  ('inventory.read',          'inventory', 'View inventory items and stock movements'),
  ('inventory.adjust',        'inventory', 'Record purchases, recipes, and stock adjustments'),
  ('finance.expenses.read',   'finance', 'View expenses, cash book, credit accounts'),
  ('finance.expenses.write',  'finance', 'Record expenses and cash movements'),
  ('finance.credit.write',    'finance', 'Manage credit accounts and post credit-ledger entries'),
  ('settled_records.correct', 'finance', 'Correct or refund an already-settled booking/order'),
  ('audit.read',              'admin',   'View the audit log'),
  ('staff.manage',            'admin',   'Create/deactivate staff accounts'),
  ('roles.manage',            'admin',   'Manage roles, permissions, and system configuration tables')
on conflict (id) do nothing;

insert into public.roles (id, label, description) values
  ('owner',            'Owner',            'Full access to everything'),
  ('admin',            'Admin',            'Full access to everything'),
  ('manager',          'Manager',          'Full operational access except staff/role management'),
  ('reception',        'Reception',        'Bookings, check-in/out'),
  ('cashier',          'Cashier',          'POS orders, settlement, credit payments'),
  ('restaurant_staff', 'Restaurant Staff', 'Kitchen/service order handling'),
  ('inventory_staff',  'Inventory Staff',  'Purchases, stock, recipes'),
  ('accountant',       'Accountant',       'Finance records and audit trail')
on conflict (id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'owner', id from public.permissions
union all
select 'admin', id from public.permissions
union all
select 'manager', id from public.permissions
  where id not in ('staff.manage', 'roles.manage')
union all
select 'reception', unnest(array['bookings.read', 'bookings.write', 'pms.checkin', 'pms.checkout', 'finance.expenses.read'])
union all
select 'cashier', unnest(array['pos.orders.read', 'pos.orders.write', 'pos.settle', 'finance.expenses.read', 'finance.credit.write'])
union all
select 'restaurant_staff', unnest(array['pos.orders.read', 'pos.orders.write'])
union all
select 'inventory_staff', unnest(array['inventory.read', 'inventory.adjust'])
union all
select 'accountant', unnest(array['finance.expenses.read', 'finance.expenses.write', 'audit.read', 'settled_records.correct'])
on conflict do nothing;

-- Order lifecycle: only these transitions are legal (enforced by
-- tg_validate_order_status_transition in the pos_core migration). Adding a
-- new legal transition later is a data insert here, not a schema change.
insert into public.order_status_transitions (from_status, to_status) values
  ('draft', 'open'),
  ('draft', 'cancelled'),
  ('open', 'submitted'),
  ('open', 'cancelled'),
  ('submitted', 'preparing'),
  ('submitted', 'cancelled'),
  ('preparing', 'ready'),
  ('preparing', 'cancelled'),
  ('ready', 'completed'),
  ('ready', 'cancelled'),
  ('completed', 'settled'),
  ('completed', 'voided'),
  ('settled', 'refunded')
on conflict do nothing;
