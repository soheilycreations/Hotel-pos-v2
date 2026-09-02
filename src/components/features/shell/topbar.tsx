"use client";

import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";
import { NAV_ITEMS } from "./nav-items";

export function Topbar({
  permissions,
  fullName,
  roleLabel,
}: {
  permissions: string[];
  fullName: string;
  roleLabel: string;
}) {
  const pathname = usePathname();
  const current = NAV_ITEMS.find((item) => (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)));

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 md:px-6">
      <div className="flex items-center gap-3">
        <MobileNav permissions={permissions} />
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{current?.label ?? "Dashboard"}</span>
        </nav>
      </div>
      <div className="flex items-center gap-2">
        {/* Notifications placeholder — no backing data source yet. */}
        <Button variant="ghost" size="icon" aria-label="Notifications" disabled>
          <Bell />
        </Button>
        <UserMenu fullName={fullName} roleLabel={roleLabel} />
      </div>
    </header>
  );
}
