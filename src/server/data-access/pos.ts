import "server-only";
import { createClient } from "@/lib/supabase/server";

export type MenuCategory = { id: string; name: string; sort_order: number };
export type MenuItem = {
  id: string;
  category_id: string;
  name: string;
  selling_price: number;
  is_active: boolean;
};
export type RestaurantTable = { id: string; name: string; capacity: number; status: string };

export type OrderSummary = {
  id: string;
  channel_type: string;
  order_status: string;
  table_id: string | null;
  total_amount: number;
  version: number;
  created_at: string;
  table: { name: string } | null;
};

export type OrderItemRow = {
  id: string;
  menu_item_id: string | null;
  is_custom: boolean;
  custom_description: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  menu_item: { name: string } | null;
};

export type OrderDetail = OrderSummary & {
  subtotal: number;
  service_charge: number;
  service_charge_waived: boolean;
  business_date: string;
  items: OrderItemRow[];
};

const ACTIVE_ORDER_STATUSES = ["draft", "open", "submitted", "preparing", "ready", "completed"];

/** Active (not settled/voided/cancelled/refunded) orders, newest first. */
export async function getActiveOrders(): Promise<OrderSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurant_orders")
    .select("id, channel_type, order_status, table_id, total_amount, version, created_at, table:restaurant_tables(name)")
    .in("order_status", ACTIVE_ORDER_STATUSES)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load active orders: ${error.message}`);
  }
  return (data ?? []) as unknown as OrderSummary[];
}

export async function getRestaurantTables(): Promise<RestaurantTable[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("restaurant_tables").select("id, name, capacity, status").order("name");

  if (error) {
    throw new Error(`Failed to load tables: ${error.message}`);
  }
  return data ?? [];
}

export async function getMenuCategories(): Promise<MenuCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("menu_categories")
    .select("id, name, sort_order")
    .order("sort_order");

  if (error) {
    throw new Error(`Failed to load menu categories: ${error.message}`);
  }
  return data ?? [];
}

export async function getMenuItems(): Promise<MenuItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, category_id, name, selling_price, is_active")
    .eq("is_active", true)
    .order("name");

  if (error) {
    throw new Error(`Failed to load menu items: ${error.message}`);
  }
  return data ?? [];
}

export async function getOrderById(orderId: string): Promise<OrderDetail | null> {
  const supabase = await createClient();
  const { data: order, error: orderError } = await supabase
    .from("restaurant_orders")
    .select(
      "id, channel_type, order_status, table_id, subtotal, service_charge, service_charge_waived, total_amount, business_date, version, created_at, table:restaurant_tables(name)"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    throw new Error(`Failed to load order: ${orderError.message}`);
  }
  if (!order) return null;

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("id, menu_item_id, is_custom, custom_description, quantity, unit_price, line_total, menu_item:menu_items(name)")
    .eq("order_id", orderId)
    .order("created_at");

  if (itemsError) {
    throw new Error(`Failed to load order items: ${itemsError.message}`);
  }

  return { ...(order as unknown as OrderDetail), items: (items ?? []) as unknown as OrderItemRow[] };
}
