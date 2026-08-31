-- Realtime: tables whose changes the UI needs to reflect live (room grid,
-- order board, folio updates) without a manual refresh. Mirrors the old
-- system's coverage for the equivalent tables in this schema.

alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.bookings;
alter publication supabase_realtime add table public.booking_charges;
alter publication supabase_realtime add table public.room_rate_plans;
alter publication supabase_realtime add table public.hotel_settings;
alter publication supabase_realtime add table public.restaurant_tables;
alter publication supabase_realtime add table public.restaurant_orders;
alter publication supabase_realtime add table public.order_items;
alter publication supabase_realtime add table public.menu_categories;
alter publication supabase_realtime add table public.expense_categories;
alter publication supabase_realtime add table public.cash_movements;
alter publication supabase_realtime add table public.credit_accounts;
alter publication supabase_realtime add table public.credit_ledger;
alter publication supabase_realtime add table public.inventory_items;
alter publication supabase_realtime add table public.stock_movements;
alter publication supabase_realtime add table public.audit_log;
