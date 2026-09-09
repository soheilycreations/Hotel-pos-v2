"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createMenuItem, updateMenuItem } from "@/server/actions/menu.actions";
import type { MenuCategory, MenuItemAdmin } from "@/server/data-access/menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function MenuItemDialog({
  item,
  categories,
  open,
  onOpenChange,
}: {
  /** Omit to create a new item; pass one to edit it. */
  item?: MenuItemAdmin;
  categories: MenuCategory[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [categoryId, setCategoryId] = useState(item?.category_id ?? categories[0]?.id ?? "");
  const [sellingPrice, setSellingPrice] = useState(item?.selling_price ?? 0);
  const [otherCost, setOtherCost] = useState(item?.other_cost ?? 0);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit() {
    startTransition(async () => {
      const result = item
        ? await updateMenuItem({ id: item.id, name, categoryId, sellingPrice, otherCost })
        : await createMenuItem({ name, categoryId, sellingPrice, otherCost });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(item ? "Item updated" : "Item added");
      onOpenChange(false);
      router.refresh();
    });
  }

  const canSubmit = name.trim().length > 0 && !!categoryId && sellingPrice >= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "Edit item" : "Add item"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="item-name">Name</Label>
            <Input id="item-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="item-category">Category</Label>
            <select
              id="item-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={cn(
                "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              )}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.station === "bar" ? "Bar" : "Kitchen"}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="item-price">Selling price (LKR)</Label>
              <Input
                id="item-price"
                type="number"
                min={0}
                step="0.01"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-cost">Other cost (LKR)</Label>
              <Input
                id="item-cost"
                type="number"
                min={0}
                step="0.01"
                value={otherCost}
                onChange={(e) => setOtherCost(Number(e.target.value))}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!canSubmit} isLoading={isPending}>
            {item ? "Save changes" : "Add item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
