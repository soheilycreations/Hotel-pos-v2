-- Finance core: expense categories (table, not enum — see the roles
-- migration's rationale, same reasoning applies), expenses, cash book,
-- credit accounts, and one append-only credit ledger replacing the old
-- system's three separate credit tables (credit_accounts, credit_repayments,
-- credit_adjustments) with charges implicit elsewhere.

create type public.expense_division as enum ('restaurant', 'room');
create type public.cash_direction   as enum ('in', 'out');
create type public.credit_transaction_type as enum ('CHARGE', 'REPAYMENT', 'ADJUSTMENT', 'REVERSAL');

create table public.expense_categories (
  id         uuid primary key default gen_random_uuid(),
  name       varchar(80) not null,
  created_at timestamptz not null default now()
);

create table public.expenses (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references public.expense_categories (id) on delete restrict,
  division      public.expense_division not null,
  description   varchar(200),
  amount        numeric(14,2) not null check (amount > 0),
  business_date date not null,
  created_by    uuid references public.staff_profiles (id),
  created_at    timestamptz not null default now()
);
create index idx_expenses_business_date on public.expenses (business_date);

create table public.cash_movements (
  id            uuid primary key default gen_random_uuid(),
  direction     public.cash_direction not null,
  amount        numeric(14,2) not null check (amount > 0),
  description   varchar(200),
  business_date date not null,
  created_by    uuid references public.staff_profiles (id),
  created_at    timestamptz not null default now()
);
create index idx_cash_movements_business_date on public.cash_movements (business_date);

create table public.credit_accounts (
  id             uuid primary key default gen_random_uuid(),
  guest_id       uuid references public.guests (id) on delete restrict,
  account_name   varchar(120) not null,
  credit_limit   numeric(14,2) check (credit_limit is null or credit_limit >= 0),
  version        int not null default 1,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

-- One append-only ledger replaces the old repo's credit_accounts (implicit
-- charge tracking) + credit_repayments + credit_adjustments as three
-- separately-reconciled tables.
create table public.credit_ledger (
  id                uuid primary key default gen_random_uuid(),
  credit_account_id uuid not null references public.credit_accounts (id) on delete restrict,
  transaction_type  public.credit_transaction_type not null,
  amount            numeric(14,2) not null check (amount > 0),  -- direction implied by transaction_type
  reference_type    varchar(40),   -- 'booking' | 'order' | 'manual'
  reference_id      uuid,
  business_date     date not null default current_date,
  description       text,
  created_by        uuid references public.staff_profiles (id),
  created_at        timestamptz not null default now()
);
create index idx_credit_ledger_account on public.credit_ledger (credit_account_id, created_at desc);

create view public.credit_account_balances as
select
  credit_account_id,
  sum(
    case transaction_type
      when 'CHARGE'     then amount
      when 'ADJUSTMENT' then amount
      when 'REPAYMENT'  then -amount
      when 'REVERSAL'   then -amount
    end
  ) as balance
from public.credit_ledger
group by credit_account_id;

-- Now that credit_accounts exists, wire up the deferred FK from pms_core.
alter table public.payments
  add constraint fk_payments_credit_account foreign key (credit_account_id) references public.credit_accounts (id) on delete restrict;

-- RLS

alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.cash_movements enable row level security;
alter table public.credit_accounts enable row level security;
alter table public.credit_ledger enable row level security;

create policy "expense_categories read" on public.expense_categories for select to authenticated using (public.has_permission('finance.expenses.read'));
create policy "expense_categories write" on public.expense_categories for all to authenticated
  using (public.has_permission('roles.manage')) with check (public.has_permission('roles.manage'));

create policy "expenses read" on public.expenses for select to authenticated using (public.has_permission('finance.expenses.read'));
create policy "expenses insert" on public.expenses for insert to authenticated with check (public.has_permission('finance.expenses.write'));
-- No update/delete policy: a posted expense is corrected via
-- rpc_correct_settled_record, never edited in place — mirrors the
-- booking_charges append-only pattern.

create policy "cash_movements read" on public.cash_movements for select to authenticated using (public.has_permission('finance.expenses.read'));
create policy "cash_movements write" on public.cash_movements for all to authenticated
  using (public.has_permission('finance.expenses.write')) with check (public.has_permission('finance.expenses.write'));

create policy "credit_accounts read" on public.credit_accounts for select to authenticated using (public.has_permission('finance.expenses.read'));
create policy "credit_accounts write" on public.credit_accounts for all to authenticated
  using (public.has_permission('finance.credit.write')) with check (public.has_permission('finance.credit.write'));

create policy "credit_ledger read" on public.credit_ledger for select to authenticated using (public.has_permission('finance.expenses.read'));
create policy "credit_ledger insert" on public.credit_ledger for insert to authenticated with check (public.has_permission('finance.credit.write'));
-- No update/delete: corrections are REVERSAL rows, never edits.
