-- Idempotent DEV/DEMO data only. Never required for the app to function —
-- the data the app actually needs to run (permission matrix, order status
-- transitions) lives in a real numbered migration
-- (20260901000900_seed_permissions_matrix.sql), not here. This file is safe
-- to run repeatedly (`on conflict do nothing`) against a fresh local
-- database via `supabase db reset`.

insert into public.room_types (id, name, base_price, max_occupancy) values
  ('11111111-1111-1111-1111-111111111111', 'Standard', 6000, 2),
  ('22222222-2222-2222-2222-222222222222', 'Deluxe',   9000, 3)
on conflict (id) do nothing;

insert into public.room_rate_plans (id, room_type_id, kind, label, price) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'per_night', 'Standard / Night', 6000),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'per_night', 'Deluxe / Night', 9000)
on conflict (id) do nothing;

insert into public.rooms (id, type_id, room_number, status) values
  ('55555555-5555-5555-5555-555555555551', '11111111-1111-1111-1111-111111111111', '101', 'vacant'),
  ('55555555-5555-5555-5555-555555555552', '11111111-1111-1111-1111-111111111111', '102', 'vacant'),
  ('55555555-5555-5555-5555-555555555553', '22222222-2222-2222-2222-222222222222', '201', 'vacant')
on conflict (id) do nothing;

insert into public.restaurant_tables (id, name, capacity, status) values
  ('66666666-6666-6666-6666-666666666661', 'T1', 4, 'vacant'),
  ('66666666-6666-6666-6666-666666666662', 'T2', 2, 'vacant')
on conflict (id) do nothing;

insert into public.menu_categories (id, name, sort_order) values
  ('77777777-7777-7777-7777-777777777771', 'Rice & Curry', 1),
  ('77777777-7777-7777-7777-777777777772', 'Beverages', 2)
on conflict (id) do nothing;

insert into public.menu_items (id, category_id, name, selling_price) values
  ('88888888-8888-8888-8888-888888888881', '77777777-7777-7777-7777-777777777771', 'Chicken Rice & Curry', 950),
  ('88888888-8888-8888-8888-888888888882', '77777777-7777-7777-7777-777777777772', 'King Coconut', 250)
on conflict (id) do nothing;

insert into public.expense_categories (id, name) values
  ('99999999-9999-9999-9999-999999999991', 'Utilities'),
  ('99999999-9999-9999-9999-999999999992', 'Supplies')
on conflict (id) do nothing;

insert into public.suppliers (id, name, contact_number) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Local Produce Supplier', '0771234567')
on conflict (id) do nothing;

insert into public.inventory_items (id, name, unit, unit_cost, quantity_in_stock, reorder_level) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Basmati Rice', 'grams', 0.5, 20000, 5000)
on conflict (id) do nothing;

-- NOTE: no staff_profiles/auth.users rows are seeded here — a staff account
-- requires a real auth.users row created via Supabase Auth (sign-up, or
-- src/lib/supabase/admin.ts's inviteStaffMember/createStaffAccountWithTempPassword),
-- which this SQL-only seed cannot do. Create your first admin manually
-- after `supabase start`:
--   1. Create a user via the Auth section of the Supabase dashboard (or
--      `supabase.auth.admin.createUser` locally), noting their UUID.
--   2. insert into public.staff_profiles (id, full_name, role_id)
--      values ('<that uuid>', 'Your Name', 'owner');
