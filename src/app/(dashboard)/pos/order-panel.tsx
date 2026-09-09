"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2, UtensilsCrossed } from "lucide-react";
import { removeOrderItem, advanceOrderStatus } from "@/server/actions/pos.actions";
import type { OrderDetail } from "@/server/data-access/pos";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { SettleDialog } from "@/components/features/pos/settle-dialog";
import { VoidDialog } from "@/components/features/pos/void-dialog";

const NEXT_STEP_LABEL: Record<string, string> = {
  open: "Send to kitchen",
  submitted: "Start preparing",
  preparing: "Mark ready",
  ready: "Mark completed",
};

const ORDER_STATUS_VARIANT: Record<string, "secondary" | "warning" | "success"> = {
  open: "secondary",
  submitted: "warning",
  preparing: "warning",
  ready: "warning",
  completed: "success",
  settled: "success",
};

export function OrderPanel({
  order,
  isLoading,
  onRefresh,
  onCleared,
}: {
  order: OrderDetail | null;
  isLoading: boolean;
  /** Re-fetch this order's detail (after an item add/remove/advance). */
  onRefresh: () => void;
  /** Clear the selection entirely (after void — the table is free again). */
  onCleared: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [settleOpen, setSettleOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);

  if (isLoading) {
    return (
      <Card className="xl:sticky xl:top-6">
        <CardContent className="space-y-3 pt-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  if (!order) {
    return (
      <Card className="xl:sticky xl:top-6">
        <CardContent className="pt-6">
          <EmptyState
            icon={UtensilsCrossed}
            title="No order selected"
            description="Tap a table to open an order, then add items from the menu."
          />
        </CardContent>
      </Card>
    );
  }

  const isOpen = order.order_status === "open";
  const canAdvance = order.order_status in NEXT_STEP_LABEL;
  const canVoid = !["settled", "voided", "cancelled"].includes(order.order_status);
  const isSettled = order.order_status === "completed" || order.order_status === "settled";
  const liveSubtotal = order.items.reduce((sum, item) => sum + Number(item.line_total), 0);

  function onRemoveItem(orderItemId: string) {
    startTransition(async () => {
      const result = await removeOrderItem({ orderItemId });
      if (!result.ok) toast.error(result.error);
      else onRefresh();
    });
  }

  function onAdvance() {
    if (!order) return;
    startTransition(async () => {
      const result = await advanceOrderStatus({ orderId: order.id, expectedVersion: order.version });
      if (!result.ok) toast.error(result.error);
      else onRefresh();
    });
  }

  return (
    <Card className="xl:sticky xl:top-6">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>{order.table?.name ?? order.channel_type}</CardTitle>
          <Badge variant={ORDER_STATUS_VARIANT[order.order_status] ?? "secondary"} className="mt-1 capitalize">
            {order.order_status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {order.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items yet — tap the menu to add some.</p>
        ) : (
          <div className="space-y-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-2 text-sm">
                <div>
                  <p className="font-medium leading-snug">{item.is_custom ? item.custom_description : item.menu_item?.name}</p>
                  <p className="num text-xs text-muted-foreground">
                    {item.quantity} × {Number(item.unit_price).toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="num font-medium">{Number(item.line_total).toFixed(2)}</span>
                  {isOpen && (
                    <Button variant="ghost" size="icon" className="size-6" onClick={() => onRemoveItem(item.id)}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-1 border-t border-border pt-3 text-sm">
          {isSettled ? (
            <>
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="num">{Number(order.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Service charge</span>
                <span className="num">{Number(order.service_charge).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span className="num">LKR {Number(order.total_amount).toFixed(2)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between text-base font-semibold">
              <span>Running total</span>
              <span className="num">LKR {liveSubtotal.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 pt-1">
          {canAdvance && (
            <Button onClick={onAdvance} isLoading={isPending}>
              {NEXT_STEP_LABEL[order.order_status]}
            </Button>
          )}
          {order.order_status === "completed" && <Button onClick={() => setSettleOpen(true)}>Settle</Button>}
          {canVoid && (
            <Button variant="outline" onClick={() => setVoidOpen(true)}>
              Void order
            </Button>
          )}
        </div>
      </CardContent>

      <SettleDialog
        orderId={order.id}
        expectedVersion={order.version}
        subtotal={liveSubtotal}
        open={settleOpen}
        onOpenChange={setSettleOpen}
        onSettled={onRefresh}
      />
      <VoidDialog
        orderId={order.id}
        expectedVersion={order.version}
        open={voidOpen}
        onOpenChange={setVoidOpen}
        onVoided={onCleared}
      />
    </Card>
  );
}
