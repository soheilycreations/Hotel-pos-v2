import type { Metadata } from "next";
import { PermissionGate } from "@/components/features/shell/permission-gate";
import { PERMISSIONS } from "@/server/auth/permissions";
import { getOrderById, getMenuCategories, getMenuItems } from "@/server/data-access/pos";
import { EmptyState } from "@/components/ui/empty-state";
import { OrderBuilder } from "./order-builder";

export const metadata: Metadata = { title: "Order — Hotel Rawana" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <PermissionGate permission={PERMISSIONS.POS_ORDERS_READ}>
      <OrderPageContent orderId={id} />
    </PermissionGate>
  );
}

async function OrderPageContent({ orderId }: { orderId: string }) {
  const [order, menuCategories, menuItems] = await Promise.all([
    getOrderById(orderId),
    getMenuCategories(),
    getMenuItems(),
  ]);

  if (!order) {
    return <EmptyState title="Order not found" description="It may have been removed." />;
  }

  return <OrderBuilder order={order} menuItems={menuItems} menuCategories={menuCategories} />;
}
