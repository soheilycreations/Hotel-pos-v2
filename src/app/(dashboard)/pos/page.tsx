import type { Metadata } from "next";
import { UtensilsCrossed } from "lucide-react";
import { PermissionGate } from "@/components/features/shell/permission-gate";
import { EmptyState } from "@/components/ui/empty-state";
import { PERMISSIONS } from "@/server/auth/permissions";

export const metadata: Metadata = { title: "POS — Hotel Rawana" };

export default function PosPage() {
  return (
    <PermissionGate permission={PERMISSIONS.POS_ORDERS_READ}>
      <EmptyState
        icon={UtensilsCrossed}
        title="POS module coming soon"
        description="Order taking, KOT printing, and settlement are built in a later phase."
      />
    </PermissionGate>
  );
}
