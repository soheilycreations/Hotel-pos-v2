import type { Metadata } from "next";
import { Boxes } from "lucide-react";
import { PermissionGate } from "@/components/features/shell/permission-gate";
import { EmptyState } from "@/components/ui/empty-state";
import { PERMISSIONS } from "@/server/auth/permissions";

export const metadata: Metadata = { title: "Inventory — Hotel Rawana" };

export default function InventoryPage() {
  return (
    <PermissionGate permission={PERMISSIONS.INVENTORY_READ}>
      <EmptyState
        icon={Boxes}
        title="Inventory module coming soon"
        description="Stock levels, purchases, and recipes are built in a later phase."
      />
    </PermissionGate>
  );
}
