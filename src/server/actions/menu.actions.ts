"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/server/auth/guard";
import { PERMISSIONS } from "@/server/auth/permissions";
import {
  createMenuCategorySchema,
  updateMenuCategorySchema,
  createMenuItemSchema,
  updateMenuItemSchema,
  toggleMenuItemActiveSchema,
  type CreateMenuCategoryInput,
  type UpdateMenuCategoryInput,
  type CreateMenuItemInput,
  type UpdateMenuItemInput,
  type ToggleMenuItemActiveInput,
} from "@/server/validation/menu.schema";
import type { ActionResult } from "./pos.actions";

function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

function refreshMenuPages() {
  revalidatePath("/pos/menu");
  revalidatePath("/pos");
}

export async function createMenuCategory(input: CreateMenuCategoryInput): Promise<ActionResult> {
  const parsed = createMenuCategorySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");

  await requirePermission(PERMISSIONS.POS_MENU_MANAGE);
  const supabase = await createClient();

  const { error } = await supabase.from("menu_categories").insert({
    name: parsed.data.name,
    station: parsed.data.station,
    sort_order: parsed.data.sortOrder,
  });
  if (error) return fail(error.message);

  refreshMenuPages();
  return { ok: true, data: undefined };
}

export async function updateMenuCategory(input: UpdateMenuCategoryInput): Promise<ActionResult> {
  const parsed = updateMenuCategorySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");

  await requirePermission(PERMISSIONS.POS_MENU_MANAGE);
  const supabase = await createClient();

  const { error } = await supabase
    .from("menu_categories")
    .update({ name: parsed.data.name, station: parsed.data.station, sort_order: parsed.data.sortOrder })
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  refreshMenuPages();
  return { ok: true, data: undefined };
}

export async function createMenuItem(input: CreateMenuItemInput): Promise<ActionResult> {
  const parsed = createMenuItemSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");

  await requirePermission(PERMISSIONS.POS_MENU_MANAGE);
  const supabase = await createClient();

  const { error } = await supabase.from("menu_items").insert({
    category_id: parsed.data.categoryId,
    name: parsed.data.name,
    selling_price: parsed.data.sellingPrice,
    other_cost: parsed.data.otherCost,
  });
  if (error) return fail(error.message);

  refreshMenuPages();
  return { ok: true, data: undefined };
}

export async function updateMenuItem(input: UpdateMenuItemInput): Promise<ActionResult> {
  const parsed = updateMenuItemSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");

  await requirePermission(PERMISSIONS.POS_MENU_MANAGE);
  const supabase = await createClient();

  const { error } = await supabase
    .from("menu_items")
    .update({
      category_id: parsed.data.categoryId,
      name: parsed.data.name,
      selling_price: parsed.data.sellingPrice,
      other_cost: parsed.data.otherCost,
    })
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  refreshMenuPages();
  return { ok: true, data: undefined };
}

export async function toggleMenuItemActive(input: ToggleMenuItemActiveInput): Promise<ActionResult> {
  const parsed = toggleMenuItemActiveSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");

  await requirePermission(PERMISSIONS.POS_MENU_MANAGE);
  const supabase = await createClient();

  const { error } = await supabase
    .from("menu_items")
    .update({ is_active: parsed.data.isActive })
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  refreshMenuPages();
  return { ok: true, data: undefined };
}
