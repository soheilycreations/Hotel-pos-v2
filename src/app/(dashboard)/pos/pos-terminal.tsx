"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createOrder, addOrderItem, getOrderDetailAction } from "@/server/actions/pos.actions";
import type { RestaurantTable, OrderSummary, MenuCategory, MenuItem, OrderDetail } from "@/server/data-access/pos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MenuGrid } from "./menu-grid";
import { OrderPanel } from "./order-panel";

const TABLE_STYLES: Record<string, string> = {
  vacant: "border-success/40 bg-success/10 hover:bg-success/20",
  occupied: "border-warning/40 bg-warning/10 hover:bg-warning/20",
  reserved: "border-primary/40 bg-primary/10 hover:bg-primary/20",
  billed: "border-destructive/40 bg-destructive/10 hover:bg-destructive/20",
};

export function PosTerminal({
  tables,
  orders,
  menuCategories,
  menuItems,
}: {
  tables: RestaurantTable[];
  orders: OrderSummary[];
  menuCategories: MenuCategory[];
  menuItems: MenuItem[];
}) {
  const router = useRouter();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);
  const [addQty, setAddQty] = useState(1);
  const [isPending, startTransition] = useTransition();

  const loadOrderDetail = useCallback(async (orderId: string) => {
    setIsLoadingOrder(true);
    const detail = await getOrderDetailAction(orderId);
    setOrderDetail(detail);
    setIsLoadingOrder(false);
  }, []);

  useEffect(() => {
    // Fetching data in response to a changed id is one of the canonical
    // effect use cases (react.dev/learn/synchronizing-with-effects#fetching-data)
    // — loadOrderDetail's own setState calls are what the linter is
    // (over-)cautious about here, not a real issue.
    if (selectedOrderId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadOrderDetail(selectedOrderId);
    } else {
      setOrderDetail(null);
    }
  }, [selectedOrderId, loadOrderDetail]);

  function onTableClick(table: RestaurantTable) {
    if (table.status === "vacant") {
      startTransition(async () => {
        const result = await createOrder({ tableId: table.id });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        router.refresh();
        setSelectedOrderId(result.data.orderId);
      });
      return;
    }

    const order = orders.find((o) => o.table_id === table.id);
    if (order) setSelectedOrderId(order.id);
  }

  function onSelectMenuItem(menuItemId: string) {
    if (!selectedOrderId) return;
    startTransition(async () => {
      const result = await addOrderItem({ orderId: selectedOrderId, menuItemId, quantity: addQty });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
      loadOrderDetail(selectedOrderId);
    });
  }

  function onRefresh() {
    router.refresh();
    if (selectedOrderId) loadOrderDetail(selectedOrderId);
  }

  function onCleared() {
    router.refresh();
    setSelectedOrderId(null);
  }

  const canAddItems = !!orderDetail && orderDetail.order_status === "open";

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Point of Sale</h1>
          <p className="text-sm text-muted-foreground">Tap a vacant table to open an order, or an occupied one to keep adding items.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {tables.map((table) => {
                const order = orders.find((o) => o.table_id === table.id);
                const isSelected = order?.id === selectedOrderId;
                return (
                  <button
                    key={table.id}
                    type="button"
                    onClick={() => onTableClick(table)}
                    disabled={isPending}
                    className={cn(
                      "flex min-w-20 flex-col items-center rounded-md border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60",
                      TABLE_STYLES[table.status],
                      isSelected && "ring-2 ring-ring"
                    )}
                  >
                    {table.name}
                    {order && (
                      <span className="num text-xs font-normal opacity-80">LKR {order.live_total.toFixed(2)}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 pt-6">
            {!canAddItems && (
              <p className="text-sm text-muted-foreground">
                {selectedOrderId ? "This order is no longer open for changes." : "Select a table first to add items."}
              </p>
            )}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <MenuGrid
                  categories={menuCategories}
                  items={menuItems}
                  disabled={!canAddItems || isPending}
                  onSelectItem={onSelectMenuItem}
                />
              </div>
              <div className="w-20 shrink-0">
                <label htmlFor="add-qty" className="mb-1 block text-xs text-muted-foreground">
                  Qty
                </label>
                <Input
                  id="add-qty"
                  type="number"
                  min={1}
                  value={addQty}
                  onChange={(e) => setAddQty(Math.max(1, Number(e.target.value)))}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <OrderPanel order={orderDetail} isLoading={isLoadingOrder} onRefresh={onRefresh} onCleared={onCleared} />
    </div>
  );
}
