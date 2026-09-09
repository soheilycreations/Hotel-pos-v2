"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/server/auth/guard";
import { PERMISSIONS } from "@/server/auth/permissions";
import { colomboToday } from "@/lib/date-helpers";
import { getOrderById, type OrderDetail } from "@/server/data-access/pos";
import {
  createOrderSchema,
  addOrderItemSchema,
  removeOrderItemSchema,
  orderStatusStepSchema,
  settleOrderSchema,
  voidOrderSchema,
  markKotPrintedSchema,
  type CreateOrderInput,
  type AddOrderItemInput,
  type RemoveOrderItemInput,
  type OrderStatusStepInput,
  type SettleOrderInput,
  type VoidOrderInput,
  type MarkKotPrintedInput,
} from "@/server/validation/pos.schema";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

/**
 * The legal single-step transitions this action set walks an order through.
 * Kept in one place so the UI's "next step" logic and the actual update
 * calls can't drift apart — each step here maps to exactly one row in
 * order_status_transitions.
 */
const NEXT_STATUS: Record<string, string | undefined> = {
  open: "submitted",
  submitted: "preparing",
  preparing: "ready",
  ready: "completed",
};

/** Fetches one order's full detail on demand, for the single-screen POS
 * terminal to load into its side panel without a page navigation. */
export async function getOrderDetailAction(orderId: string): Promise<OrderDetail | null> {
  await requirePermission(PERMISSIONS.POS_ORDERS_READ);
  return getOrderById(orderId);
}

export async function createOrder(input: CreateOrderInput): Promise<ActionResult<{ orderId: string }>> {
  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");

  const profile = await requirePermission(PERMISSIONS.POS_ORDERS_WRITE);
  const supabase = await createClient();

  const { data: table, error: tableError } = await supabase
    .from("restaurant_tables")
    .select("status")
    .eq("id", parsed.data.tableId)
    .maybeSingle();
  if (tableError || !table) return fail("Table not found");
  if (table.status !== "vacant") return fail("That table is not vacant");

  const { data: order, error } = await supabase
    .from("restaurant_orders")
    .insert({
      channel_type: "dine_in",
      table_id: parsed.data.tableId,
      order_status: "open",
      business_date: colomboToday(),
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !order) return fail(error?.message ?? "Failed to create order");

  await supabase.from("restaurant_tables").update({ status: "occupied" }).eq("id", parsed.data.tableId);

  revalidatePath("/pos");
  return { ok: true, data: { orderId: order.id as string } };
}

export async function addOrderItem(input: AddOrderItemInput): Promise<ActionResult> {
  const parsed = addOrderItemSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");

  await requirePermission(PERMISSIONS.POS_ORDERS_WRITE);
  const supabase = await createClient();

  const { data: order, error: orderError } = await supabase
    .from("restaurant_orders")
    .select("order_status")
    .eq("id", parsed.data.orderId)
    .maybeSingle();
  if (orderError || !order) return fail("Order not found");
  if (order.order_status !== "open") return fail("Items can only be added while the order is open");

  const { data: menuItem, error: menuItemError } = await supabase
    .from("menu_items")
    .select("selling_price")
    .eq("id", parsed.data.menuItemId)
    .maybeSingle();
  if (menuItemError || !menuItem) return fail("Menu item not found");

  const { error } = await supabase.from("order_items").insert({
    order_id: parsed.data.orderId,
    menu_item_id: parsed.data.menuItemId,
    quantity: parsed.data.quantity,
    unit_price: menuItem.selling_price,
  });
  if (error) return fail(error.message);

  revalidatePath("/pos");
  return { ok: true, data: undefined };
}

export async function removeOrderItem(input: RemoveOrderItemInput): Promise<ActionResult> {
  const parsed = removeOrderItemSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");

  await requirePermission(PERMISSIONS.POS_ORDERS_WRITE);
  const supabase = await createClient();

  const { data: item, error: itemError } = await supabase
    .from("order_items")
    .select("order_id, restaurant_orders!inner(order_status)")
    .eq("id", parsed.data.orderItemId)
    .maybeSingle();
  if (itemError || !item) return fail("Order item not found");
  const orderStatus = (item as unknown as { restaurant_orders: { order_status: string } }).restaurant_orders
    .order_status;
  if (orderStatus !== "open") return fail("Items can only be removed while the order is open");

  const { error } = await supabase.from("order_items").delete().eq("id", parsed.data.orderItemId);
  if (error) return fail(error.message);

  revalidatePath("/pos");
  return { ok: true, data: undefined };
}

/**
 * Advances an order exactly one step along the kitchen workflow
 * (open→submitted→preparing→ready→completed). Direct table update, not an
 * RPC — unlike settle/void, this has no financial or inventory side
 * effect, so a plain optimistic-locked UPDATE is enough; the
 * tg_validate_order_status_transition trigger still rejects anything not
 * in order_status_transitions regardless.
 */
export async function advanceOrderStatus(input: OrderStatusStepInput): Promise<ActionResult> {
  const parsed = orderStatusStepSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");

  await requirePermission(PERMISSIONS.POS_ORDERS_WRITE);
  const supabase = await createClient();

  const { data: order, error: orderError } = await supabase
    .from("restaurant_orders")
    .select("order_status, version")
    .eq("id", parsed.data.orderId)
    .maybeSingle();
  if (orderError || !order) return fail("Order not found");
  if (order.version !== parsed.data.expectedVersion) {
    return fail("This order was updated by someone else — refresh and try again");
  }

  const next = NEXT_STATUS[order.order_status];
  if (!next) return fail(`Order in status "${order.order_status}" cannot be advanced`);

  const { error } = await supabase
    .from("restaurant_orders")
    .update({ order_status: next, version: order.version + 1 })
    .eq("id", parsed.data.orderId)
    .eq("version", parsed.data.expectedVersion);
  if (error) return fail(error.message);

  revalidatePath("/pos");
  return { ok: true, data: undefined };
}

export async function settleOrder(input: SettleOrderInput): Promise<ActionResult> {
  const parsed = settleOrderSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");

  await requirePermission(PERMISSIONS.POS_SETTLE);
  const supabase = await createClient();

  const { error } = await supabase.rpc("rpc_settle_pos_order", {
    p_order_id: parsed.data.orderId,
    p_expected_version: parsed.data.expectedVersion,
    p_payment_method: parsed.data.paymentMethod,
    p_business_date: colomboToday(),
  });
  if (error) return fail(error.message);

  revalidatePath("/pos");
  return { ok: true, data: undefined };
}

/** Marks the given order_items as sent to the kitchen/bar (kot_printed_at).
 * Called after the printer has actually been handed the ticket bytes — see
 * src/hooks/useThermalPrint.ts — never before, so a failed print doesn't
 * silently mark items as fired. */
export async function markKotPrinted(input: MarkKotPrintedInput): Promise<ActionResult> {
  const parsed = markKotPrintedSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");

  await requirePermission(PERMISSIONS.POS_ORDERS_WRITE);
  const supabase = await createClient();

  const { error } = await supabase
    .from("order_items")
    .update({ kot_printed_at: new Date().toISOString() })
    .eq("order_id", parsed.data.orderId)
    .in("id", parsed.data.orderItemIds)
    .is("kot_printed_at", null);
  if (error) return fail(error.message);

  revalidatePath("/pos");
  return { ok: true, data: undefined };
}

export async function voidOrder(input: VoidOrderInput): Promise<ActionResult> {
  const parsed = voidOrderSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");

  await requirePermission(PERMISSIONS.POS_VOID);
  const supabase = await createClient();

  const { error } = await supabase.rpc("rpc_void_pos_order", {
    p_order_id: parsed.data.orderId,
    p_reason: parsed.data.reason,
    p_expected_version: parsed.data.expectedVersion,
  });
  if (error) return fail(error.message);

  revalidatePath("/pos");
  return { ok: true, data: undefined };
}
