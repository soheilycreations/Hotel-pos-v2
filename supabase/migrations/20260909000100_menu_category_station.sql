-- Kitchen/bar ticket routing: each menu category prints to one station.
-- Additive, non-destructive — existing categories default to 'kitchen'.
create type public.kitchen_station as enum ('kitchen', 'bar');
-- Fixed, closed set (matches the physical printers a restaurant has), so an
-- enum is appropriate here — same reasoning as order_status/payment_method.

alter table public.menu_categories
  add column station public.kitchen_station not null default 'kitchen';

-- Best-effort default for anyone who already named a category "Beverages"
-- (e.g. the local dev seed) — harmless no-op if it doesn't exist yet.
update public.menu_categories set station = 'bar' where name ilike '%beverage%';
