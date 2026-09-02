/**
 * Pure constants/types/errors — deliberately has NO "server-only" import and
 * does not touch cookies, the database, or any secret. This is what nav
 * components (client-side) import to know permission ids for UI filtering;
 * the actual enforcement (requirePermission) lives in ./guard.ts, which IS
 * server-only and must never be imported from a client component.
 *
 * Dot-namespaced permission ids. This list must stay in sync with the rows
 * seeded into the `permissions` table by
 * supabase/migrations/..._seed_permissions_matrix.sql — adding a permission
 * here without seeding the matching row (and vice versa) means
 * `requirePermission` will never grant it to anyone.
 */
export const PERMISSIONS = {
  BOOKINGS_READ: "bookings.read",
  BOOKINGS_WRITE: "bookings.write",
  PMS_CHECKIN: "pms.checkin",
  PMS_CHECKOUT: "pms.checkout",
  POS_ORDERS_READ: "pos.orders.read",
  POS_ORDERS_WRITE: "pos.orders.write",
  POS_SETTLE: "pos.settle",
  POS_VOID: "pos.void",
  INVENTORY_READ: "inventory.read",
  INVENTORY_ADJUST: "inventory.adjust",
  FINANCE_EXPENSES_READ: "finance.expenses.read",
  FINANCE_EXPENSES_WRITE: "finance.expenses.write",
  FINANCE_CREDIT_WRITE: "finance.credit.write",
  SETTLED_RECORDS_CORRECT: "settled_records.correct",
  AUDIT_READ: "audit.read",
  STAFF_MANAGE: "staff.manage",
  ROLES_MANAGE: "roles.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export class AuthenticationError extends Error {
  constructor(message = "Not authenticated") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}
