import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { PermissionGate } from "@/components/features/shell/permission-gate";
import { EmptyState } from "@/components/ui/empty-state";
import { PERMISSIONS } from "@/server/auth/permissions";

export const metadata: Metadata = { title: "Reports — Hotel Rawana" };

export default function ReportsPage() {
  return (
    <PermissionGate permission={PERMISSIONS.FINANCE_EXPENSES_READ}>
      <EmptyState
        icon={BarChart3}
        title="Reports module coming soon"
        description="Daily summaries, occupancy, and P&L reports are built in a later phase."
      />
    </PermissionGate>
  );
}
