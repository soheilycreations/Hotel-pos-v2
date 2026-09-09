"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { addOrderItem, removeOrderItem, advanceOrderStatus } from "@/server/actions/pos.actions";
import type { OrderDetail, MenuItem, MenuCategory } from "@/server/data-access/pos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { SettleDialog } from "./settle-dialog";
import { VoidDialog } from "./void-dialog";

const NEXT_STEP_LABEL: Record<string, string> = {
  open: "Send to kitchen",
  submitted: "Start preparing",
  preparing: "Mark ready",
  ready: "Mark completed",
};

export function OrderBuilder({
  order,
  menuItems,
  menuCategories,
}: {
  order: OrderDetail;
  menuItems: MenuItem[];
  menuCategories: MenuCategory[];
}) {
  const router = useRouter();
  const [menuItemId, setMenuItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [settleOpen, setSettleOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);

  const isOpen = order.order_status === "open";
  const canAdvance = order.order_status in NEXT_STEP_LABEL;
  const canVoid = order.order_status !== "settled" && order.order_status !== "voided" && order.order_status !== "cancelled";
  // subtotal/service_charge/total_amount are only computed once, by
  // rpc_settle_pos_order at settlement time — before that they're still 0,
  // so show a live running sum of line items instead of the stored fields
  // while the order is being built.
  const isSettled = order.order_status === "completed" || order.order_status === "settled";
  const liveSubtotal = order.items.reduce((sum, item) => sum + Number(item.line_total), 0);

  function onAddItem() {
    if (!menuItemId) return;
    startTransition(async () => {
      const result = await addOrderItem({ orderId: order.id, menuItemId, quantity });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setMenuItemId("");
      setQuantity(1);
      router.refresh();
    });
  }

  function onRemoveItem(orderItemId: string) {
    startTransition(async () => {
      const result = await removeOrderItem({ orderItemId });
      if (!result.ok) toast.error(result.error);
      else router.refresh();
    });
  }

  function onAdvance() {
    startTransition(async () => {
      const result = await advanceOrderStatus({ orderId: order.id, expectedVersion: order.version });
      if (!result.ok) toast.error(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{order.table?.name ?? order.channel_type}</h1>
          <Badge variant="secondary" className="mt-1 capitalize">
            {order.order_status}
          </Badge>
        </div>
        <div className="flex gap-2">
          {canVoid && (
            <Button variant="outline" onClick={() => setVoidOpen(true)}>
              Void
            </Button>
          )}
          {canAdvance && (
            <Button onClick={onAdvance} isLoading={isPending}>
              {NEXT_STEP_LABEL[order.order_status]}
            </Button>
          )}
          {order.order_status === "completed" && <Button onClick={() => setSettleOpen(true)}>Settle</Button>}
        </div>
      </div>

      {isOpen && (
        <Card>
          <CardHeader>
            <CardTitle>Add item</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <select
                value={menuItemId}
                onChange={(e) => setMenuItemId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select a menu item…</option>
                {menuCategories.map((category) => (
                  <optgroup key={category.id} label={category.name}>
                    {menuItems
                      .filter((item) => item.category_id === category.id)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} — LKR {Number(item.selling_price).toFixed(2)}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              className="w-20"
            />
            <Button onClick={onAddItem} disabled={!menuItemId} isLoading={isPending}>
              Add
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          {order.items.length === 0 ? (
            <EmptyState title="No items yet" description="Add items from the menu above." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Unit price</TableHead>
                  <TableHead>Total</TableHead>
                  {isOpen && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.is_custom ? item.custom_description : item.menu_item?.name}</TableCell>
                    <TableCell className="num">{item.quantity}</TableCell>
                    <TableCell className="num">{Number(item.unit_price).toFixed(2)}</TableCell>
                    <TableCell className="num">{Number(item.line_total).toFixed(2)}</TableCell>
                    {isOpen && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => onRemoveItem(item.id)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="mt-4 flex justify-end">
            <div className="w-56 space-y-1 text-sm">
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
                  <div className="flex justify-between font-medium">
                    <span>Total</span>
                    <span className="num">LKR {Number(order.total_amount).toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between font-medium">
                  <span>Running total</span>
                  <span className="num">LKR {liveSubtotal.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <SettleDialog
        orderId={order.id}
        expectedVersion={order.version}
        subtotal={liveSubtotal}
        open={settleOpen}
        onOpenChange={setSettleOpen}
      />
      <VoidDialog orderId={order.id} expectedVersion={order.version} open={voidOpen} onOpenChange={setVoidOpen} />
    </div>
  );
}
