"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { MenuCategory, MenuItem } from "@/server/data-access/pos";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MenuGrid({
  categories,
  items,
  disabled,
  onSelectItem,
}: {
  categories: MenuCategory[];
  items: MenuItem[];
  disabled: boolean;
  onSelectItem: (menuItemId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(categories[0]?.id ?? null);

  const categoryNameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const isSearching = query.trim().length > 0;

  const visibleItems = isSearching
    ? items.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()))
    : items.filter((item) => item.category_id === categoryId);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Menu</p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the whole menu…"
          className="pl-9"
        />
      </div>
      {!isSearching && (
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Button
              key={category.id}
              type="button"
              size="sm"
              variant={categoryId === category.id ? "default" : "outline"}
              onClick={() => setCategoryId(category.id)}
            >
              {category.name}
            </Button>
          ))}
        </div>
      )}
      {visibleItems.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No items found.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {visibleItems.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectItem(item.id)}
              className={cn(
                "rounded-lg border border-border p-3 text-left text-sm transition-colors hover:bg-accent",
                "disabled:pointer-events-none disabled:opacity-60"
              )}
            >
              <p className="font-medium leading-snug">{item.name}</p>
              <p className="num mt-0.5 text-xs text-muted-foreground">
                LKR {Number(item.selling_price).toFixed(2)}
                {isSearching ? <span className="ml-1.5">· {categoryNameById.get(item.category_id)}</span> : null}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
