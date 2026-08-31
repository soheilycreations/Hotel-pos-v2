-- Transactional RPCs. Every multi-step financial/inventory operation that
-- was a sequential app-level write in the old system (and could partially
-- fail — see AUDIT_REPORT.md finding #2, the stay-extension bug) becomes a
-- single Postgres function here: it either commits as one unit or rolls
-- back entirely, even if the calling serverless function crashes mid-request.
--
-- Every function: SECURITY DEFINER + set search_path = public, checks its
-- own permission via has_permission() rather than relying solely on RLS,
-- uses `select ... for update` + a `version` compare-and-swap for optimistic
-- locking, and audit-logs financial corrections/voids/refunds/adjustments.

-- ---------------------------------------------------------------------
-- PMS: stay extension / shortening / check-in / check-out
-- ---------------------------------------------------------------------

create or replace function public.rpc_extend_stay(
  p_booking_id uuid,
  p_new_checkout date,
  p_charge_description varchar,
  p_charge_amount numeric,
  p_expected_version int,
  p_business_date date default current_date
) returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_old_checkout date;
begin
  if not public.has_permission('bookings.write') then
    raise exception 'Missing permission: bookings.write' using errcode = '42501';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking % not found', p_booking_id using errcode = 'P0002';
  end if;
  if v_booking.version <> p_expected_version then
    raise exception 'CONCURRENT_MODIFICATION: booking has been changed by someone else' using errcode = 'P0001';
  end if;
  if p_new_checkout <= v_booking.check_out_date then
    raise exception 'New checkout date must be after the current checkout date' using errcode = '23514';
  end if;

  v_old_checkout := v_booking.check_out_date;

  update public.bookings
    set check_out_date = p_new_checkout, version = version + 1
    where id = p_booking_id
    returning * into v_booking;

  insert into public.booking_charges (booking_id, description, amount, business_date, created_by)
  values (p_booking_id, p_charge_description, p_charge_amount, p_business_date, auth.uid());

  perform public.log_audit_event(
    'EXTEND_STAY', 'bookings', p_booking_id,
    jsonb_build_object('check_out_date', v_old_checkout),
    jsonb_build_object('check_out_date', p_new_checkout, 'charge_amount', p_charge_amount)
  );

  return v_booking;
end;
$$;

create or replace function public.rpc_shorten_stay(
  p_booking_id uuid,
  p_new_checkout date,
  p_reversal_description varchar,
  p_reversal_amount numeric,
  p_expected_version int,
  p_business_date date default current_date
) returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_old_checkout date;
begin
  if not public.has_permission('bookings.write') then
    raise exception 'Missing permission: bookings.write' using errcode = '42501';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking % not found', p_booking_id using errcode = 'P0002';
  end if;
  if v_booking.version <> p_expected_version then
    raise exception 'CONCURRENT_MODIFICATION: booking has been changed by someone else' using errcode = 'P0001';
  end if;
  if p_new_checkout >= v_booking.check_out_date or p_new_checkout <= v_booking.check_in_date then
    raise exception 'New checkout date must be between check-in and the current checkout date' using errcode = '23514';
  end if;

  v_old_checkout := v_booking.check_out_date;

  update public.bookings
    set check_out_date = p_new_checkout, version = version + 1
    where id = p_booking_id
    returning * into v_booking;

  if p_reversal_amount > 0 then
    insert into public.booking_charges (booking_id, description, amount, business_date, created_by)
    values (p_booking_id, p_reversal_description, p_reversal_amount, p_business_date, auth.uid());
  end if;

  perform public.log_audit_event(
    'SHORTEN_STAY', 'bookings', p_booking_id,
    jsonb_build_object('check_out_date', v_old_checkout),
    jsonb_build_object('check_out_date', p_new_checkout, 'reversal_amount', p_reversal_amount)
  );

  return v_booking;
end;
$$;

create or replace function public.rpc_check_in(
  p_booking_id uuid,
  p_expected_version int
) returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  if not public.has_permission('pms.checkin') then
    raise exception 'Missing permission: pms.checkin' using errcode = '42501';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking % not found', p_booking_id using errcode = 'P0002';
  end if;
  if v_booking.version <> p_expected_version then
    raise exception 'CONCURRENT_MODIFICATION: booking has been changed by someone else' using errcode = 'P0001';
  end if;
  if v_booking.status <> 'pending' then
    raise exception 'Only a pending booking can be checked in (current status: %)', v_booking.status using errcode = '23514';
  end if;

  update public.bookings
    set status = 'checked_in', actual_check_in_at = now(), version = version + 1
    where id = p_booking_id
    returning * into v_booking;

  if v_booking.room_id is not null then
    update public.rooms set status = 'occupied' where id = v_booking.room_id;
  end if;

  return v_booking;
end;
$$;

create or replace function public.rpc_check_out(
  p_booking_id uuid,
  p_expected_version int,
  p_payment_method public.payment_method,
  p_amount numeric,
  p_credit_account_id uuid default null,
  p_business_date date default current_date
) returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  if not public.has_permission('pms.checkout') then
    raise exception 'Missing permission: pms.checkout' using errcode = '42501';
  end if;
  if p_payment_method = 'credit' and p_credit_account_id is null then
    raise exception 'A credit account is required when paying by credit' using errcode = '23514';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking % not found', p_booking_id using errcode = 'P0002';
  end if;
  if v_booking.version <> p_expected_version then
    raise exception 'CONCURRENT_MODIFICATION: booking has been changed by someone else' using errcode = 'P0001';
  end if;
  if v_booking.status <> 'checked_in' then
    raise exception 'Only a checked-in booking can be checked out (current status: %)', v_booking.status using errcode = '23514';
  end if;

  update public.bookings
    set status = 'checked_out', actual_check_out_at = now(), version = version + 1
    where id = p_booking_id
    returning * into v_booking;

  if v_booking.room_id is not null then
    update public.rooms set status = 'dirty' where id = v_booking.room_id;
  end if;

  if p_amount > 0 then
    insert into public.payments (booking_id, credit_account_id, amount, method, business_date, received_by)
    values (p_booking_id, p_credit_account_id, p_amount, p_payment_method, p_business_date, auth.uid());

    if p_payment_method = 'credit' then
      insert into public.credit_ledger (credit_account_id, transaction_type, amount, reference_type, reference_id, business_date, created_by)
      values (p_credit_account_id, 'CHARGE', p_amount, 'booking', p_booking_id, p_business_date, auth.uid());
    end if;
  end if;

  return v_booking;
end;
$$;

-- ---------------------------------------------------------------------
-- POS: settlement (fixes the old system's order-total race condition by
-- locking the order row BEFORE re-summing line items), void, refund.
-- ---------------------------------------------------------------------

create or replace function public.rpc_settle_pos_order(
  p_order_id uuid,
  p_expected_version int,
  p_payment_method public.payment_method,
  p_credit_account_id uuid default null,
  p_business_date date default current_date
) returns public.restaurant_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.restaurant_orders;
  v_subtotal numeric(14,2);
  v_chargeable_subtotal numeric(14,2);
  v_service_charge numeric(14,2);
  v_total numeric(14,2);
  v_sc_rate numeric(5,2);
  v_ingredient record;
begin
  if not public.has_permission('pos.settle') then
    raise exception 'Missing permission: pos.settle' using errcode = '42501';
  end if;
  if p_payment_method = 'credit' and p_credit_account_id is null then
    raise exception 'A credit account is required when paying by credit' using errcode = '23514';
  end if;

  -- Lock the order row FIRST, then re-sum line items. The old system's
  -- tg_recalc_order_total re-summed on every item write without holding
  -- this lock, so two concurrent edits to the same order could commit a
  -- stale total. Locking here and re-summing after the lock closes that gap.
  select * into v_order from public.restaurant_orders where id = p_order_id for update;
  if not found then
    raise exception 'Order % not found', p_order_id using errcode = 'P0002';
  end if;
  if v_order.version <> p_expected_version then
    raise exception 'CONCURRENT_MODIFICATION: order has been changed by someone else' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.order_status_transitions
    where from_status = v_order.order_status and to_status = 'settled'
  ) then
    raise exception 'Order in status % cannot be settled', v_order.order_status using errcode = '23514';
  end if;

  select coalesce(sum(line_total) filter (where service_chargeable), 0),
         coalesce(sum(line_total), 0)
    into v_chargeable_subtotal, v_subtotal
    from public.order_items where order_id = p_order_id;

  select service_charge_rate into v_sc_rate from public.hotel_settings where id = 1;
  v_service_charge := case when v_order.service_charge_waived then 0
                            else round(v_chargeable_subtotal * v_sc_rate / 100, 2) end;
  v_total := v_subtotal + v_service_charge;

  -- Deduct recipe ingredients for every menu-item line on this order. One
  -- rpc_adjust_stock call per ingredient, inside this same transaction, so
  -- a failed deduction (e.g. would go negative) rolls back the whole
  -- settlement instead of completing a sale with no matching stock movement.
  for v_ingredient in
    select ri.inventory_item_id, sum(ri.quantity_needed * oi.quantity) as total_needed
    from public.order_items oi
    join public.recipe_ingredients ri on ri.menu_item_id = oi.menu_item_id
    where oi.order_id = p_order_id and oi.menu_item_id is not null
    group by ri.inventory_item_id
  loop
    perform public._apply_stock_movement(
      v_ingredient.inventory_item_id, -v_ingredient.total_needed, 'RECIPE_DEDUCTION',
      'order', p_order_id, null
    );
  end loop;

  update public.restaurant_orders
    set order_status = 'settled', subtotal = v_subtotal, service_charge = v_service_charge,
        total_amount = v_total, settled_at = now(), settled_by = auth.uid(), version = version + 1
    where id = p_order_id
    returning * into v_order;

  if v_order.channel_type = 'room_service' and v_order.booking_id is not null then
    insert into public.booking_charges (booking_id, description, amount, business_date, created_by)
    values (v_order.booking_id, 'Room service order', v_total, p_business_date, auth.uid());
  else
    insert into public.payments (order_id, credit_account_id, amount, method, business_date, received_by)
    values (p_order_id, p_credit_account_id, v_total, p_payment_method, p_business_date, auth.uid());

    if p_payment_method = 'credit' then
      insert into public.credit_ledger (credit_account_id, transaction_type, amount, reference_type, reference_id, business_date, created_by)
      values (p_credit_account_id, 'CHARGE', v_total, 'order', p_order_id, p_business_date, auth.uid());
    end if;
  end if;

  if v_order.table_id is not null then
    update public.restaurant_tables set status = 'vacant' where id = v_order.table_id;
  end if;

  return v_order;
end;
$$;

-- Voids a pre-settlement order (draft through completed). Stock is never
-- deducted before settlement (see rpc_settle_pos_order) so voiding one
-- needs no inventory reversal. A SETTLED order has already had stock
-- deducted and payment posted — it must go through rpc_refund_order
-- instead, which is why 'settled' is rejected here.
create or replace function public.rpc_void_pos_order(
  p_order_id uuid,
  p_reason text,
  p_expected_version int
) returns public.restaurant_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.restaurant_orders;
  v_old_status public.order_status;
  v_target_status public.order_status;
begin
  if not public.has_permission('pos.void') then
    raise exception 'Missing permission: pos.void' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required to void an order' using errcode = '23514';
  end if;

  select * into v_order from public.restaurant_orders where id = p_order_id for update;
  if not found then
    raise exception 'Order % not found', p_order_id using errcode = 'P0002';
  end if;
  if v_order.version <> p_expected_version then
    raise exception 'CONCURRENT_MODIFICATION: order has been changed by someone else' using errcode = 'P0001';
  end if;
  if v_order.order_status = 'settled' then
    raise exception 'A settled order must be refunded via rpc_refund_order, not voided' using errcode = '23514';
  end if;

  -- 'completed' orders are marked voided (they were briefly considered done
  -- before this correction); anything earlier in the flow is cancelled.
  -- Both are legal targets in order_status_transitions (see the seed
  -- migration) — this picks whichever applies to the order's current state.
  v_target_status := case when v_order.order_status = 'completed' then 'voided'::public.order_status
                           else 'cancelled'::public.order_status end;

  if not exists (
    select 1 from public.order_status_transitions
    where from_status = v_order.order_status and to_status = v_target_status
  ) then
    raise exception 'Order in status % cannot be voided', v_order.order_status using errcode = '23514';
  end if;

  v_old_status := v_order.order_status;

  update public.restaurant_orders
    set order_status = v_target_status, version = version + 1
    where id = p_order_id
    returning * into v_order;

  if v_order.table_id is not null then
    update public.restaurant_tables set status = 'vacant' where id = v_order.table_id;
  end if;

  perform public.log_audit_event(
    'VOID_ORDER', 'restaurant_orders', p_order_id,
    jsonb_build_object('order_status', v_old_status),
    jsonb_build_object('order_status', v_target_status),
    p_reason
  );

  return v_order;
end;
$$;

-- Refunds do not go back through `payments` (money IN from a guest, amount
-- always > 0 by constraint) — a refund is either a credit_ledger REVERSAL
-- (reduces what the guest owes) or cash physically handed back, recorded as
-- a cash_movements 'out' entry. Both are properly-signed, purpose-built
-- ledgers rather than a negative-amount hack on the payments table.
create or replace function public.rpc_refund_order(
  p_order_id uuid,
  p_amount numeric,
  p_reason text,
  p_expected_version int,
  p_business_date date default current_date
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.restaurant_orders;
  v_last_payment public.payments;
  v_audit_id uuid;
begin
  if not public.has_permission('settled_records.correct') then
    raise exception 'Missing permission: settled_records.correct' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required to refund an order' using errcode = '23514';
  end if;

  select * into v_order from public.restaurant_orders where id = p_order_id for update;
  if not found then
    raise exception 'Order % not found', p_order_id using errcode = 'P0002';
  end if;
  if v_order.version <> p_expected_version then
    raise exception 'CONCURRENT_MODIFICATION: order has been changed by someone else' using errcode = 'P0001';
  end if;
  if v_order.order_status <> 'settled' then
    raise exception 'Only a settled order can be refunded (current status: %)', v_order.order_status using errcode = '23514';
  end if;

  select * into v_last_payment from public.payments where order_id = p_order_id order by created_at desc limit 1;

  if v_last_payment.method = 'credit' and v_last_payment.credit_account_id is not null then
    insert into public.credit_ledger (credit_account_id, transaction_type, amount, reference_type, reference_id, business_date, created_by)
    values (v_last_payment.credit_account_id, 'REVERSAL', p_amount, 'order', p_order_id, p_business_date, auth.uid());
  else
    insert into public.cash_movements (direction, amount, description, business_date, created_by)
    values ('out', p_amount, 'Refund: order ' || p_order_id || ' — ' || p_reason, p_business_date, auth.uid());
  end if;

  update public.restaurant_orders set order_status = 'refunded', version = version + 1 where id = p_order_id;

  v_audit_id := public.log_audit_event(
    'REFUND_ORDER', 'restaurant_orders', p_order_id,
    jsonb_build_object('order_status', 'settled'),
    jsonb_build_object('order_status', 'refunded', 'refund_amount', p_amount),
    p_reason
  );

  return v_audit_id;
end;
$$;

create or replace function public.rpc_refund_booking(
  p_booking_id uuid,
  p_amount numeric,
  p_reason text,
  p_expected_version int,
  p_business_date date default current_date
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_last_payment public.payments;
  v_audit_id uuid;
begin
  if not public.has_permission('settled_records.correct') then
    raise exception 'Missing permission: settled_records.correct' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required to refund a booking' using errcode = '23514';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking % not found', p_booking_id using errcode = 'P0002';
  end if;
  if v_booking.version <> p_expected_version then
    raise exception 'CONCURRENT_MODIFICATION: booking has been changed by someone else' using errcode = 'P0001';
  end if;
  if v_booking.status <> 'checked_out' then
    raise exception 'Only a checked-out booking can be refunded (current status: %)', v_booking.status using errcode = '23514';
  end if;

  select * into v_last_payment from public.payments where booking_id = p_booking_id order by created_at desc limit 1;

  if v_last_payment.method = 'credit' and v_last_payment.credit_account_id is not null then
    insert into public.credit_ledger (credit_account_id, transaction_type, amount, reference_type, reference_id, business_date, created_by)
    values (v_last_payment.credit_account_id, 'REVERSAL', p_amount, 'booking', p_booking_id, p_business_date, auth.uid());
  else
    insert into public.cash_movements (direction, amount, description, business_date, created_by)
    values ('out', p_amount, 'Refund: booking ' || p_booking_id || ' — ' || p_reason, p_business_date, auth.uid());
  end if;

  v_audit_id := public.log_audit_event(
    'REFUND_BOOKING', 'bookings', p_booking_id,
    jsonb_build_object('status', v_booking.status),
    jsonb_build_object('refund_amount', p_amount),
    p_reason
  );

  return v_audit_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Inventory: the ONLY sanctioned mutator of inventory_items.quantity_in_stock
-- ---------------------------------------------------------------------

-- Internal mechanism, no permission check of its own — callers are other
-- SECURITY DEFINER rpc_* functions that have already authorized the
-- higher-level action (e.g. rpc_settle_pos_order checks 'pos.settle', not
-- 'inventory.adjust', before deducting recipe stock as a side effect of
-- settling a sale). EXECUTE is revoked from `authenticated`/`anon` at the
-- end of this file specifically so this cannot be called directly as an
-- RPC, bypassing that reasoning — only public.rpc_adjust_stock (below) is
-- meant to be called directly by a client, and it does check
-- 'inventory.adjust' itself before delegating here.
create or replace function public._apply_stock_movement(
  p_inventory_item_id uuid,
  p_quantity_delta numeric,
  p_movement_type public.stock_movement_type,
  p_reference_type varchar default null,
  p_reference_id uuid default null,
  p_reason text default null
) returns public.stock_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.inventory_items;
  v_resulting numeric(14,3);
  v_movement public.stock_movements;
begin
  select * into v_item from public.inventory_items where id = p_inventory_item_id for update;
  if not found then
    raise exception 'Inventory item % not found', p_inventory_item_id using errcode = 'P0002';
  end if;

  v_resulting := v_item.quantity_in_stock + p_quantity_delta;
  if v_resulting < 0 then
    raise exception 'INSUFFICIENT_STOCK: adjusting % by % would leave % (current stock: %)',
      v_item.name, p_quantity_delta, v_resulting, v_item.quantity_in_stock using errcode = '23514';
  end if;

  update public.inventory_items
    set quantity_in_stock = v_resulting, version = version + 1
    where id = p_inventory_item_id;

  insert into public.stock_movements (
    inventory_item_id, movement_type, quantity, previous_quantity, resulting_quantity,
    reference_type, reference_id, reason, created_by
  ) values (
    p_inventory_item_id, p_movement_type, p_quantity_delta, v_item.quantity_in_stock, v_resulting,
    p_reference_type, p_reference_id, p_reason, auth.uid()
  ) returning * into v_movement;

  return v_movement;
end;
$$;

-- Public-facing entry point for a direct/manual stock adjustment (e.g. a
-- stocktake correction or waste write-off) — requires 'inventory.adjust'.
create or replace function public.rpc_adjust_stock(
  p_inventory_item_id uuid,
  p_quantity_delta numeric,
  p_movement_type public.stock_movement_type,
  p_reference_type varchar default null,
  p_reference_id uuid default null,
  p_reason text default null
) returns public.stock_movements
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('inventory.adjust') then
    raise exception 'Missing permission: inventory.adjust' using errcode = '42501';
  end if;

  return public._apply_stock_movement(
    p_inventory_item_id, p_quantity_delta, p_movement_type, p_reference_type, p_reference_id, p_reason
  );
end;
$$;

revoke execute on function public._apply_stock_movement(uuid, numeric, public.stock_movement_type, varchar, uuid, text)
  from public, anon, authenticated;

create or replace function public.rpc_create_purchase(
  p_supplier_id uuid,
  p_invoice_number varchar,
  p_purchase_date date,
  p_items jsonb  -- [{ "inventory_item_id": "...", "quantity": 10, "unit_cost": 250.00 }, ...]
) returns public.purchases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase public.purchases;
  v_item jsonb;
begin
  if not public.has_permission('inventory.adjust') then
    raise exception 'Missing permission: inventory.adjust' using errcode = '42501';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'A purchase must have at least one line item' using errcode = '23514';
  end if;

  insert into public.purchases (supplier_id, invoice_number, purchase_date, created_by)
  values (p_supplier_id, p_invoice_number, p_purchase_date, auth.uid())
  returning * into v_purchase;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.purchase_items (purchase_id, inventory_item_id, quantity, unit_cost)
    values (
      v_purchase.id,
      (v_item->>'inventory_item_id')::uuid,
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_cost')::numeric
    );

    perform public._apply_stock_movement(
      (v_item->>'inventory_item_id')::uuid,
      (v_item->>'quantity')::numeric,
      'PURCHASE', 'purchase', v_purchase.id, null
    );
  end loop;

  return v_purchase;
end;
$$;

-- ---------------------------------------------------------------------
-- The ONLY path for editing an already-settled/checked-out financial record.
-- Generic by design: works across any of the tables below via dynamic
-- column assignment, but only ever touches the exact columns in p_patch,
-- and always audit-logs before/after. Restricted to tables that carry a
-- `version` column (bookings, restaurant_orders) so the same optimistic-
-- locking guarantee applies here as everywhere else — booking_charges and
-- expenses are append-only ledgers by design (see their own voided_at/
-- void_reason columns and RLS policies in pms_core/finance_core) and are
-- deliberately NOT corrected in place through this function.
-- ---------------------------------------------------------------------

create or replace function public.rpc_correct_settled_record(
  p_entity_table varchar,
  p_entity_id uuid,
  p_patch jsonb,
  p_reason text,
  p_expected_version int
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed_tables text[] := array['bookings', 'restaurant_orders'];
  v_previous jsonb;
  v_new jsonb;
  v_set_clause text := '';
  v_key text;
  v_value jsonb;
begin
  if not public.has_permission('settled_records.correct') then
    raise exception 'Missing permission: settled_records.correct' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required to correct a settled record' using errcode = '23514';
  end if;
  if not (p_entity_table = any(v_allowed_tables)) then
    raise exception 'Corrections are not supported for table %', p_entity_table using errcode = '42501';
  end if;

  execute format('select to_jsonb(t) from public.%I t where id = $1 for update', p_entity_table)
    into v_previous using p_entity_id;
  if v_previous is null then
    raise exception '% % not found', p_entity_table, p_entity_id using errcode = 'P0002';
  end if;
  if (v_previous->>'version')::int <> p_expected_version then
    raise exception 'CONCURRENT_MODIFICATION: record has been changed by someone else' using errcode = 'P0001';
  end if;

  for v_key, v_value in select * from jsonb_each(p_patch)
  loop
    if v_key in ('id', 'version', 'created_at', 'created_by') then
      raise exception 'Field % cannot be corrected via this function', v_key using errcode = '42501';
    end if;
    v_set_clause := v_set_clause || format('%I = %L, ', v_key, v_value #>> '{}');
  end loop;
  v_set_clause := v_set_clause || 'version = version + 1';

  execute format('update public.%I as t set %s where t.id = $1 returning to_jsonb(t)', p_entity_table, v_set_clause)
    into v_new using p_entity_id;

  perform public.log_audit_event(
    'CORRECT_SETTLED_RECORD', p_entity_table, p_entity_id, v_previous, v_new, p_reason
  );

  return v_new;
end;
$$;
