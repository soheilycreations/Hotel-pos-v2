"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createMenuCategory, updateMenuCategory } from "@/server/actions/menu.actions";
import type { MenuCategory } from "@/server/data-access/menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const STATIONS = [
  { value: "kitchen", label: "Kitchen (KOT)" },
  { value: "bar", label: "Bar (BOT)" },
] as const;

export function MenuCategoryDialog({
  category,
  open,
  onOpenChange,
}: {
  /** Omit to create a new category; pass one to edit it. */
  category?: MenuCategory;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [station, setStation] = useState<"kitchen" | "bar">(category?.station ?? "kitchen");
  const [sortOrder, setSortOrder] = useState(category?.sort_order ?? 0);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit() {
    startTransition(async () => {
      const result = category
        ? await updateMenuCategory({ id: category.id, name, station, sortOrder })
        : await createMenuCategory({ name, station, sortOrder });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(category ? "Category updated" : "Category added");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? "Edit category" : "Add category"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="category-name">Name</Label>
            <Input id="category-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Prints to</Label>
            <div className="grid grid-cols-2 gap-2">
              {STATIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStation(s.value)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    station === s.value ? "border-primary bg-primary/10 text-primary" : "border-input hover:bg-accent"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category-sort">Sort order</Label>
            <Input
              id="category-sort"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!name.trim()} isLoading={isPending}>
            {category ? "Save changes" : "Add category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
