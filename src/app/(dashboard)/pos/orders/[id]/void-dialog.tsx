"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { voidOrder } from "@/server/actions/pos.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export function VoidDialog({
  orderId,
  expectedVersion,
  open,
  onOpenChange,
}: {
  orderId: string;
  expectedVersion: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onConfirm() {
    startTransition(async () => {
      const result = await voidOrder({ orderId, expectedVersion, reason });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Order voided");
      onOpenChange(false);
      router.push("/pos");
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void this order</DialogTitle>
          <DialogDescription>This cannot be undone. A reason is required and is recorded in the audit log.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="void-reason">Reason</Label>
          <Input id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Guest changed their mind" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={reason.trim().length < 3} isLoading={isPending}>
            Void order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
