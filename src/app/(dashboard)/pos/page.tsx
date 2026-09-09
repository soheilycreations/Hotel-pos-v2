import type { Metadata } from "next";
import { PermissionGate } from "@/components/features/shell/permission-gate";
import { PERMISSIONS } from "@/server/auth/permissions";
import { getActiveOrders, getRestaurantTables, getMenuCategories, getMenuItems } from "@/server/data-access/pos";
import { PosTerminal } from "./pos-terminal";

export const metadata: Metadata = { title: "POS — Hotel Rawana" };

export default function PosPage() {
  return (
    <PermissionGate permission={PERMISSIONS.POS_ORDERS_READ}>
      <PosPageContent />
    </PermissionGate>
  );
}

async function PosPageContent() {
  const [tables, orders, menuCategories, menuItems] = await Promise.all([
    getRestaurantTables(),
    getActiveOrders(),
    getMenuCategories(),
    getMenuItems(),
  ]);

  return <PosTerminal tables={tables} orders={orders} menuCategories={menuCategories} menuItems={menuItems} />;
}
