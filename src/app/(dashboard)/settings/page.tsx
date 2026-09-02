import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { PermissionGate } from "@/components/features/shell/permission-gate";
import { EmptyState } from "@/components/ui/empty-state";
import { PERMISSIONS } from "@/server/auth/permissions";

export const metadata: Metadata = { title: "Settings — Hotel Rawana" };

export default function SettingsPage() {
  return (
    <PermissionGate permission={PERMISSIONS.STAFF_MANAGE}>
      <EmptyState
        icon={Settings}
        title="Settings module coming soon"
        description="Staff accounts, roles, and hotel configuration are built in a later phase."
      />
    </PermissionGate>
  );
}
