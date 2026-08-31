-- PMS core: guests, rooms/rates, bookings, folio charges, payments.
-- Table shapes are carried over from the old system's schema.sql where they
-- were sound; deltas are called out inline.

create type public.room_status    as enum ('vacant', 'occupied', 'dirty', 'maintenance');
create type public.booking_status as enum ('pending', 'checked_in', 'checked_out', 'cancelled', 'no_show');
create type public.stay_type      as enum ('overnight', 'short_stay');
create type public.rate_plan_kind as enum ('per_night', 'block');
create type public.payment_method as enum ('cash', 'card', 'bank_transfer', 'complimentary', 'credit');

create table public.guests (
  id             uuid primary key default gen_random_uuid(),
  full_name      varchar(120) not null,
  id_number      varchar(40),
  contact_number varchar(20),
  email          varchar(120),
  address        text,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger trg_guests_updated_at
  before update on public.guests for each row execute function public.tg_set_updated_at();
-- Fuzzy name/contact search (old system had no index for this at all).
create index idx_guests_full_name_trgm on public.guests using gin (full_name gin_trgm_ops);
create index idx_guests_contact_number on public.guests (contact_number);

create table public.room_types (
  id            uuid primary key default gen_random_uuid(),
  name          varchar(60) not null,
  base_price    numeric(12,2) not null default 0 check (base_price >= 0),
  max_occupancy int not null check (max_occupancy > 0),
  created_at    timestamptz not null default now()
);

create table public.room_rate_plans (
  id           uuid primary key default gen_random_uuid(),
  room_type_id uuid not null references public.room_types (id) on delete cascade,
  kind         public.rate_plan_kind not null,
  label        varchar(60) not null,
  price        numeric(12,2) not null check (price >= 0),
  block_hours  int,
  created_at   timestamptz not null default now(),
  constraint chk_plan_duration check (
    (kind = 'per_night' and block_hours is null) or
    (kind = 'block' and block_hours is not null and block_hours > 0)
  )
);

create table public.rooms (
  id          uuid primary key default gen_random_uuid(),
  type_id     uuid not null references public.room_types (id) on delete restrict,
  room_number varchar(20) not null unique,
  status      public.room_status not null default 'vacant',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_rooms_updated_at
  before update on public.rooms for each row execute function public.tg_set_updated_at();
create index idx_rooms_status on public.rooms (status);

create table public.bookings (
  id                  uuid primary key default gen_random_uuid(),
  room_id             uuid references public.rooms (id) on delete restrict,
  rate_plan_id        uuid references public.room_rate_plans (id) on delete restrict,
  stay_type           public.stay_type not null,
  status              public.booking_status not null default 'pending',
  check_in_date       date not null,
  check_out_date      date not null,
  actual_check_in_at  timestamptz,
  actual_check_out_at timestamptz,
  duration_hours      int check (duration_hours is null or duration_hours > 0),
  guest_id_number     varchar(40),
  total_folio_amount  numeric(14,2) not null default 0 check (total_folio_amount >= 0),
  is_historical       boolean not null default false,
  cancelled_at        timestamptz,
  cancelled_by        uuid references public.staff_profiles (id),
  cancellation_reason text,
  version             int not null default 1,
  created_by          uuid references public.staff_profiles (id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint chk_booking_dates check (check_out_date > check_in_date)
);
create trigger trg_bookings_updated_at
  before update on public.bookings for each row execute function public.tg_set_updated_at();
create index idx_bookings_dates on public.bookings (check_in_date, check_out_date);
create index idx_bookings_created_by on public.bookings (created_by);

-- Many-to-many: a booking can have a primary guest plus companions (the old
-- system stored a single `guest_name varchar` directly on bookings).
create table public.booking_guests (
  booking_id uuid not null references public.bookings (id) on delete cascade,
  guest_id   uuid not null references public.guests (id) on delete restrict,
  is_primary boolean not null default false,
  primary key (booking_id, guest_id)
);
create unique index uq_booking_one_primary_guest on public.booking_guests (booking_id) where is_primary;

-- Append-only folio ledger. Corrections are reversal rows referencing the
-- original (`reverses_charge_id`), never a physical UPDATE/DELETE of a
-- posted charge — this is what makes the audit trail meaningful.
create table public.booking_charges (
  id                uuid primary key default gen_random_uuid(),
  booking_id        uuid not null references public.bookings (id) on delete cascade,
  description       varchar(200) not null,
  amount            numeric(12,2) not null check (amount > 0),
  reverses_charge_id uuid references public.booking_charges (id),
  voided_at         timestamptz,
  voided_by         uuid references public.staff_profiles (id),
  void_reason       text,
  business_date     date not null,
  created_by        uuid references public.staff_profiles (id),
  created_at        timestamptz not null default now()
);
create index idx_booking_charges_booking on public.booking_charges (booking_id);

-- Unifies what was a bare `payment_method` column on bookings/orders in the
-- old system into one table, supporting split/partial payments across both
-- PMS and POS from a single ledger.
create table public.payments (
  id                uuid primary key default gen_random_uuid(),
  booking_id        uuid references public.bookings (id) on delete restrict,
  order_id          uuid, -- FK added in pos_core migration once restaurant_orders exists
  credit_account_id uuid, -- FK added in finance_core migration once credit_accounts exists
  amount            numeric(14,2) not null check (amount > 0),
  method            public.payment_method not null,
  reference         varchar(100),
  business_date     date not null,
  received_by       uuid references public.staff_profiles (id),
  created_at        timestamptz not null default now(),
  constraint chk_payment_target check (booking_id is not null or order_id is not null)
);
create index idx_payments_booking on public.payments (booking_id);
create index idx_payments_order on public.payments (order_id);

-- RLS

alter table public.guests enable row level security;
alter table public.room_types enable row level security;
alter table public.room_rate_plans enable row level security;
alter table public.rooms enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_guests enable row level security;
alter table public.booking_charges enable row level security;
alter table public.payments enable row level security;

create policy "guests read" on public.guests for select to authenticated using (public.has_permission('bookings.read'));
create policy "guests write" on public.guests for all to authenticated
  using (public.has_permission('bookings.write')) with check (public.has_permission('bookings.write'));

create policy "room_types read" on public.room_types for select to authenticated using (public.has_permission('bookings.read'));
create policy "room_types write" on public.room_types for all to authenticated
  using (public.has_permission('roles.manage')) with check (public.has_permission('roles.manage'));

create policy "room_rate_plans read" on public.room_rate_plans for select to authenticated using (public.has_permission('bookings.read'));
create policy "room_rate_plans write" on public.room_rate_plans for all to authenticated
  using (public.has_permission('roles.manage')) with check (public.has_permission('roles.manage'));

create policy "rooms read" on public.rooms for select to authenticated using (public.has_permission('bookings.read'));
create policy "rooms write" on public.rooms for all to authenticated
  using (public.has_permission('bookings.write')) with check (public.has_permission('bookings.write'));

create policy "bookings read" on public.bookings for select to authenticated using (public.has_permission('bookings.read'));
-- Direct writes are for non-transactional fields only (e.g. creating a
-- pending booking); check-in/out, stay extension, and any change to a
-- checked_out booking MUST go through the rpc_* functions (see the RPC
-- migration), which enforce the version CAS and audit logging. This policy
-- does not (and cannot) enforce "which fields changed" — that discipline is
-- enforced by the RPC functions being the only paths the app calls for
-- those transitions, and by rpc_correct_settled_record being the only path
-- for touching an already checked_out booking.
create policy "bookings write" on public.bookings for all to authenticated
  using (public.has_permission('bookings.write')) with check (public.has_permission('bookings.write'));

create policy "booking_guests read" on public.booking_guests for select to authenticated using (public.has_permission('bookings.read'));
create policy "booking_guests write" on public.booking_guests for all to authenticated
  using (public.has_permission('bookings.write')) with check (public.has_permission('bookings.write'));

create policy "booking_charges read" on public.booking_charges for select to authenticated using (public.has_permission('bookings.read'));
-- Inserts allowed directly (a charge is append-only and safe); updates are
-- restricted since a "correction" must be a reversal row via
-- rpc_correct_settled_record, not an edit of a posted charge.
create policy "booking_charges insert" on public.booking_charges for insert to authenticated
  with check (public.has_permission('bookings.write'));
create policy "booking_charges update settled_records.correct only" on public.booking_charges for update to authenticated
  using (public.has_permission('settled_records.correct')) with check (public.has_permission('settled_records.correct'));

create policy "payments read" on public.payments for select to authenticated using (public.has_permission('finance.expenses.read'));
create policy "payments insert" on public.payments for insert to authenticated
  with check (public.has_permission('bookings.write') or public.has_permission('pos.settle'));
