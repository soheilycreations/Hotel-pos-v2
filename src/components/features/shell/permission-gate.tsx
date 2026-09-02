import { requirePermission } from "@/server/auth/guard";
import { AuthorizationError, type Permission } from "@/server/auth/permissions";
import { ErrorState } from "@/components/ui/error-state";

/**
 * Server-side authorization boundary for a page. Navigation (src/components
 * /features/shell/nav-items.ts) hides links a staff member can't use, but
 * that is a convenience only — this is what actually stops a direct
 * navigation to a URL the signed-in user lacks permission for. RLS is the
 * final backstop underneath this for any data the page then queries.
 */
export async function PermissionGate({
  permission,
  children,
}: {
  permission: Permission;
  children: React.ReactNode;
}) {
  try {
    await requirePermission(permission);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return (
        <ErrorState
          title="You don't have access to this page"
          description="If you believe this is a mistake, contact an administrator to review your role's permissions."
        />
      );
    }
    throw error;
  }

  return children;
}
