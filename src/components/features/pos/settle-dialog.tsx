"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { settleOrder } from "@/server/actions/pos.actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "complimentary", label: "Complimentary" },
] as const;

export function SettleDialog({
  orderId,
  expectedVersion,
  subtotal,
  open,
  onOpenChange,
  onSettled,
}: {
  orderId: string;
  expectedVersion: number;
  subtotal: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful settlement, in addition to the router
   * refresh — callers whose order data comes from a separate fetch (the
   * single-screen terminal) use this to re-fetch it explicitly. */
  onSettled?: () => void;
}) {
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]["value"] | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onConfirm() {
    if (!method) return;
    startTransition(async () => {
      const result = await settleOrder({ orderId, expectedVersion, paymentMethod: method });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Order settled");
      onOpenChange(false);
      router.refresh();
      onSettled?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settle order — subtotal LKR {subtotal.toFixed(2)}</DialogTitle>
          <DialogDescription>Service charge is added automatically based on the hotel&apos;s current rate.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_METHODS.map((pm) => (
            <button
              key={pm.value}
              type="button"
              onClick={() => setMethod(pm.value)}
              className={cn(
                "rounded-md border px-3 py-3 text-sm font-medium transition-colors",
                method === pm.value ? "border-primary bg-primary/10 text-primary" : "border-input hover:bg-accent"
              )}
            >
              {pm.label}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={!method} isLoading={isPending}>
            Confirm settlement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
