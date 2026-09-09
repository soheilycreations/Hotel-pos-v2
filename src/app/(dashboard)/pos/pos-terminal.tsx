"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { createOrder, addOrderItem, getOrderDetailAction } from "@/server/actions/pos.actions";
import type { RestaurantTable, OrderSummary, MenuCategory, MenuItem, OrderDetail } from "@/server/data-access/pos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MenuGrid } from "./menu-grid";
import { OrderPanel } from "./order-panel";

const TABLE_STYLES: Record<string, string> = {
  vacant: "border-success/30 bg-success/5 hover:border-success/50 hover:bg-success/10",
  occupied: "border-warning/30 bg-warning/5 hover:border-warning/50 hover:bg-warning/10",
  reserved: "border-primary/30 bg-primary/5 hover:border-primary/50 hover:bg-primary/10",
  billed: "border-destructive/30 bg-destructive/5 hover:border-destructive/50 hover:bg-destructive/10",
};

const TABLE_STATUS_DOT: Record<string, string> = {
  vacant: "bg-success",
  occupied: "bg-warning",
  reserved: "bg-primary",
  billed: "bg-destructive",
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
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Tables</CardTitle>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {(["vacant", "occupied", "billed"] as const).map((status) => (
                <span key={status} className="flex items-center gap-1.5 capitalize">
                  <span className={cn("size-1.5 rounded-full", TABLE_STATUS_DOT[status])} />
                  {status}
                </span>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
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
                      "group relative flex flex-col items-start gap-2 rounded-xl border p-3 text-left shadow-sm transition-all duration-150",
                      "hover:-translate-y-0.5 hover:shadow-md disabled:pointer-events-none disabled:opacity-60",
                      TABLE_STYLES[table.status],
                      isSelected && "ring-2 ring-ring ring-offset-2 ring-offset-background"
                    )}
                  >
                    <span className={cn("absolute right-2.5 top-2.5 size-2 rounded-full", TABLE_STATUS_DOT[table.status])} />
                    <span className="text-sm font-semibold leading-none">{table.name}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="size-3" />
                      {table.capacity}
                    </span>
                    {order && (
                      <span className="num text-xs font-semibold text-foreground/80">
                        LKR {order.live_total.toFixed(2)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Add items</CardTitle>
            <div className="flex items-center gap-2">
              <label htmlFor="add-qty" className="text-xs text-muted-foreground">
                Qty
              </label>
              <Input
                id="add-qty"
                type="number"
                min={1}
                value={addQty}
                onChange={(e) => setAddQty(Math.max(1, Number(e.target.value)))}
                className="w-16"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!canAddItems && (
              <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                {selectedOrderId ? "This order is no longer open for changes." : "Select a table first to add items."}
              </p>
            )}
            <MenuGrid
              categories={menuCategories}
              items={menuItems}
              disabled={!canAddItems || isPending}
              onSelectItem={onSelectMenuItem}
            />
          </CardContent>
        </Card>
      </div>

      <OrderPanel order={orderDetail} isLoading={isLoadingOrder} onRefresh={onRefresh} onCleared={onCleared} />
    </div>
  );
}
