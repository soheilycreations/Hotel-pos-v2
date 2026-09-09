"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createOrder } from "@/server/actions/pos.actions";
import type { RestaurantTable } from "@/server/data-access/pos";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function NewOrderDialog({ tables }: { tables: RestaurantTable[] }) {
  const [open, setOpen] = useState(false);
  const [tableId, setTableId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const vacantTables = tables.filter((t) => t.status === "vacant");

  function onConfirm() {
    if (!tableId) return;
    startTransition(async () => {
      const result = await createOrder({ tableId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      setTableId(null);
      router.push(`/pos/orders/${result.data.orderId}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <Plus /> New order
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a new dine-in order</DialogTitle>
        </DialogHeader>
        {vacantTables.length === 0 ? (
          <p className="text-sm text-muted-foreground">No vacant tables right now.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {vacantTables.map((table) => (
              <button
                key={table.id}
                type="button"
                onClick={() => setTableId(table.id)}
                className={cn(
                  "rounded-md border px-3 py-3 text-sm font-medium transition-colors",
                  tableId === table.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input hover:bg-accent"
                )}
              >
                {table.name}
                <span className="block text-xs font-normal text-muted-foreground">Seats {table.capacity}</span>
              </button>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={!tableId} isLoading={isPending}>
            Start order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
