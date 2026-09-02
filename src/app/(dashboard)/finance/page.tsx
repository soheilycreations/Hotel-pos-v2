import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { PermissionGate } from "@/components/features/shell/permission-gate";
import { EmptyState } from "@/components/ui/empty-state";
import { PERMISSIONS } from "@/server/auth/permissions";

export const metadata: Metadata = { title: "Finance — Hotel Rawana" };

export default function FinancePage() {
  return (
    <PermissionGate permission={PERMISSIONS.FINANCE_EXPENSES_READ}>
      <EmptyState
        icon={Wallet}
        title="Finance module coming soon"
        description="Expenses, the cash book, and credit accounts are built in a later phase."
      />
    </PermissionGate>
  );
}
