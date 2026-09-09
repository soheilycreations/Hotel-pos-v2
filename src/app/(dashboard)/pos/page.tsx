import type { Metadata } from "next";
import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";
import { PermissionGate } from "@/components/features/shell/permission-gate";
import { PERMISSIONS } from "@/server/auth/permissions";
import { getActiveOrders, getRestaurantTables } from "@/server/data-access/pos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { NewOrderDialog } from "./new-order-dialog";

export const metadata: Metadata = { title: "POS — Hotel Rawana" };

const TABLE_STATUS_VARIANT = {
  vacant: "success",
  occupied: "warning",
  reserved: "secondary",
  billed: "destructive",
} as const;

const ORDER_STATUS_VARIANT: Record<string, "secondary" | "warning" | "success" | "destructive"> = {
  open: "secondary",
  submitted: "warning",
  preparing: "warning",
  ready: "warning",
  completed: "success",
};

export default function PosPage() {
  return (
    <PermissionGate permission={PERMISSIONS.POS_ORDERS_READ}>
      <PosDashboard />
    </PermissionGate>
  );
}

async function PosDashboard() {
  const [tables, orders] = await Promise.all([getRestaurantTables(), getActiveOrders()]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Point of Sale</h1>
          <p className="text-sm text-muted-foreground">Tables and active orders</p>
        </div>
        <NewOrderDialog tables={tables} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tables</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {tables.map((table) => (
              <div key={table.id} className="rounded-md border border-border p-3 text-center">
                <p className="text-sm font-medium">{table.name}</p>
                <Badge variant={TABLE_STATUS_VARIANT[table.status as keyof typeof TABLE_STATUS_VARIANT]} className="mt-1 capitalize">
                  {table.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active orders</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <EmptyState icon={UtensilsCrossed} title="No active orders" description="Start a new order to see it here." />
          ) : (
            <div className="divide-y divide-border">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/pos/orders/${order.id}`}
                  className="flex items-center justify-between py-3 text-sm transition-colors hover:bg-accent/50 -mx-2 px-2 rounded-md"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{order.table?.name ?? order.channel_type}</span>
                    <Badge variant={ORDER_STATUS_VARIANT[order.order_status] ?? "secondary"} className="capitalize">
                      {order.order_status}
                    </Badge>
                  </div>
                  <span className="num font-medium">LKR {Number(order.total_amount).toFixed(2)}</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
