import { z } from "zod";

export const createMenuCategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  station: z.enum(["kitchen", "bar"]),
  sortOrder: z.coerce.number().int().default(0),
});
export type CreateMenuCategoryInput = z.infer<typeof createMenuCategorySchema>;

export const updateMenuCategorySchema = createMenuCategorySchema.extend({
  id: z.uuid(),
});
export type UpdateMenuCategoryInput = z.infer<typeof updateMenuCategorySchema>;

export const createMenuItemSchema = z.object({
  categoryId: z.uuid("Pick a category"),
  name: z.string().trim().min(1, "Name is required").max(120),
  sellingPrice: z.coerce.number().min(0, "Price can't be negative"),
  otherCost: z.coerce.number().min(0, "Cost can't be negative").default(0),
});
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;

export const updateMenuItemSchema = createMenuItemSchema.extend({
  id: z.uuid(),
});
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;

export const toggleMenuItemActiveSchema = z.object({
  id: z.uuid(),
  isActive: z.boolean(),
});
export type ToggleMenuItemActiveInput = z.infer<typeof toggleMenuItemActiveSchema>;
