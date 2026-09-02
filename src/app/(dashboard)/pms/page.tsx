import type { Metadata } from "next";
import { BedDouble } from "lucide-react";
import { PermissionGate } from "@/components/features/shell/permission-gate";
import { EmptyState } from "@/components/ui/empty-state";
import { PERMISSIONS } from "@/server/auth/permissions";

export const metadata: Metadata = { title: "PMS — Hotel Rawana" };

export default function PmsPage() {
  return (
    <PermissionGate permission={PERMISSIONS.BOOKINGS_READ}>
      <EmptyState
        icon={BedDouble}
        title="PMS module coming soon"
        description="Room management, bookings, and the front-desk calendar are built in a later phase."
      />
    </PermissionGate>
  );
}
