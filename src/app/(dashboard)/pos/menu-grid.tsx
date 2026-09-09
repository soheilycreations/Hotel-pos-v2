"use client";

import { useMemo, useState } from "react";
import { Search, ChefHat, Beer } from "lucide-react";
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
  const categoryStationById = useMemo(() => new Map(categories.map((c) => [c.id, c.station])), [categories]);
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
              {category.station === "bar" ? <Beer /> : <ChefHat />}
              {category.name}
            </Button>
          ))}
        </div>
      )}
      {visibleItems.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No items found.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {visibleItems.map((item) => {
            const station = categoryStationById.get(item.category_id) ?? "kitchen";
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelectItem(item.id)}
                className={cn(
                  "group relative rounded-lg border border-border bg-card p-3 text-left text-sm shadow-sm transition-all duration-150",
                  "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
                  "disabled:pointer-events-none disabled:opacity-60"
                )}
              >
                {station === "bar" ? (
                  <Beer className="absolute right-2.5 top-2.5 size-3.5 text-primary/60" />
                ) : (
                  <ChefHat className="absolute right-2.5 top-2.5 size-3.5 text-muted-foreground/50" />
                )}
                <p className="pr-5 font-medium leading-snug">{item.name}</p>
                <p className="num mt-1 text-xs font-semibold text-muted-foreground">
                  LKR {Number(item.selling_price).toFixed(2)}
                  {isSearching ? (
                    <span className="ml-1.5 font-normal">· {categoryNameById.get(item.category_id)}</span>
                  ) : null}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
