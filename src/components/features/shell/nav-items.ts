import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, BedDouble, UtensilsCrossed, Boxes, Wallet, BarChart3, Settings } from "lucide-react";
import { PERMISSIONS, type Permission } from "@/server/auth/permissions";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Undefined means visible to every signed-in staff member. This list is
   * a UI convenience only — hiding an item here does NOT enforce anything;
   * the RPC/RLS layer is the actual security boundary regardless of what
   * the nav shows. */
  permission?: Permission;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "PMS", href: "/pms", icon: BedDouble, permission: PERMISSIONS.BOOKINGS_READ },
  { label: "POS", href: "/pos", icon: UtensilsCrossed, permission: PERMISSIONS.POS_ORDERS_READ },
  { label: "Inventory", href: "/inventory", icon: Boxes, permission: PERMISSIONS.INVENTORY_READ },
  { label: "Finance", href: "/finance", icon: Wallet, permission: PERMISSIONS.FINANCE_EXPENSES_READ },
  { label: "Reports", href: "/reports", icon: BarChart3, permission: PERMISSIONS.FINANCE_EXPENSES_READ },
  { label: "Settings", href: "/settings", icon: Settings, permission: PERMISSIONS.STAFF_MANAGE },
];
