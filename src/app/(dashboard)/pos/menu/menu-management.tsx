"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, Plus, Pencil, ChefHat, Beer, EyeOff, Eye } from "lucide-react";
import { toggleMenuItemActive } from "@/server/actions/menu.actions";
import type { MenuCategory, MenuItemAdmin } from "@/server/data-access/menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { MenuCategoryDialog } from "@/components/features/pos/menu-category-dialog";
import { MenuItemDialog } from "@/components/features/pos/menu-item-dialog";

export function MenuManagement({ categories, items }: { categories: MenuCategory[]; items: MenuItemAdmin[] }) {
  const [query, setQuery] = useState("");
  const [categoryDialog, setCategoryDialog] = useState<{ open: boolean; category?: MenuCategory }>({ open: false });
  const [itemDialog, setItemDialog] = useState<{ open: boolean; item?: MenuItemAdmin }>({ open: false });
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const visibleItems = query.trim()
    ? items.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()))
    : items;

  function onToggleActive(item: MenuItemAdmin) {
    startTransition(async () => {
      const result = await toggleMenuItemActive({ id: item.id, isActive: !item.is_active });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(item.is_active ? "Item hidden from POS" : "Item is back on the POS");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Menu items</h1>
          <p className="text-sm text-muted-foreground">Add dishes and drinks, change prices, and manage categories.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Categories</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setCategoryDialog({ open: true })}>
            <Plus /> Add category
          </Button>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No categories yet — add one to start building the menu.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setCategoryDialog({ open: true, category })}
                  className="group flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary/40"
                >
                  {category.station === "bar" ? (
                    <Beer className="size-3.5 text-primary/70" />
                  ) : (
                    <ChefHat className="size-3.5 text-muted-foreground" />
                  )}
                  {category.name}
                  <Pencil className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Items</CardTitle>
          <Button size="sm" onClick={() => setItemDialog({ open: true })} disabled={categories.length === 0}>
            <Plus /> Add item
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search items…" className="pl-9" />
          </div>

          {visibleItems.length === 0 ? (
            <EmptyState icon={Search} title="No items found" description="Try a different search, or add a new item." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleItems.map((item) => {
                  const category = categoryById.get(item.category_id);
                  return (
                    <TableRow key={item.id} className={!item.is_active ? "opacity-60" : undefined}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          {category?.station === "bar" ? (
                            <Beer className="size-3.5" />
                          ) : (
                            <ChefHat className="size-3.5" />
                          )}
                          {category?.name ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="num">LKR {item.selling_price.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={item.is_active ? "success" : "secondary"}>
                          {item.is_active ? "Active" : "Hidden"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => setItemDialog({ open: true, item })}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            disabled={isPending}
                            onClick={() => onToggleActive(item)}
                          >
                            {item.is_active ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Keyed by target + open state so each open starts from a clean
          form (React's recommended way to reset state on prop change),
          instead of syncing it back in an effect. */}
      <MenuCategoryDialog
        key={`${categoryDialog.open}-${categoryDialog.category?.id ?? "new"}`}
        category={categoryDialog.category}
        open={categoryDialog.open}
        onOpenChange={(open) => setCategoryDialog((s) => ({ ...s, open }))}
      />
      <MenuItemDialog
        key={`${itemDialog.open}-${itemDialog.item?.id ?? "new"}`}
        item={itemDialog.item}
        categories={categories}
        open={itemDialog.open}
        onOpenChange={(open) => setItemDialog((s) => ({ ...s, open }))}
      />
    </div>
  );
}
