import { z } from "zod";

export const createOrderSchema = z.object({
  tableId: z.uuid("Pick a table"),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const addOrderItemSchema = z.object({
  orderId: z.uuid(),
  menuItemId: z.uuid("Pick a menu item"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
});
export type AddOrderItemInput = z.infer<typeof addOrderItemSchema>;

export const removeOrderItemSchema = z.object({
  orderItemId: z.uuid(),
});
export type RemoveOrderItemInput = z.infer<typeof removeOrderItemSchema>;

export const orderStatusStepSchema = z.object({
  orderId: z.uuid(),
  expectedVersion: z.number().int().min(1),
});
export type OrderStatusStepInput = z.infer<typeof orderStatusStepSchema>;

export const settleOrderSchema = z.object({
  orderId: z.uuid(),
  expectedVersion: z.number().int().min(1),
  paymentMethod: z.enum(["cash", "card", "bank_transfer", "complimentary", "credit"]),
});
export type SettleOrderInput = z.infer<typeof settleOrderSchema>;

export const voidOrderSchema = z.object({
  orderId: z.uuid(),
  expectedVersion: z.number().int().min(1),
  reason: z.string().min(3, "A reason is required"),
});
export type VoidOrderInput = z.infer<typeof voidOrderSchema>;

export const markKotPrintedSchema = z.object({
  orderId: z.uuid(),
  orderItemIds: z.array(z.uuid()).min(1),
});
export type MarkKotPrintedInput = z.infer<typeof markKotPrintedSchema>;
