import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { KitchenStation, MenuCategory } from "./pos";

export type { KitchenStation, MenuCategory };

export type MenuItemAdmin = {
  id: string;
  category_id: string;
  name: string;
  selling_price: number;
  other_cost: number;
  is_active: boolean;
};

/** Every category, including ones with no items yet — for the management
 * screen's category picker and listing (unlike getMenuCategories in
 * pos.ts, which is the same query but named for the POS terminal caller). */
export async function getMenuCategoriesAdmin(): Promise<MenuCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("menu_categories")
    .select("id, name, sort_order, station")
    .order("sort_order");

  if (error) {
    throw new Error(`Failed to load menu categories: ${error.message}`);
  }
  return data ?? [];
}

/** Every item, active or not — the POS terminal's getMenuItems only shows
 * active items, but the management screen needs to list and re-enable
 * deactivated ones too. */
export async function getAllMenuItems(): Promise<MenuItemAdmin[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, category_id, name, selling_price, other_cost, is_active")
    .order("name");

  if (error) {
    throw new Error(`Failed to load menu items: ${error.message}`);
  }
  return data ?? [];
}
