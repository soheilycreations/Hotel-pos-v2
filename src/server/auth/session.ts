import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type StaffProfile = {
  id: string;
  fullName: string;
  roleId: string;
  isActive: boolean;
  permissions: string[];
};

/**
 * Loads the signed-in staff member's profile plus their role's full
 * permission set, once per request (React `cache` dedupes concurrent calls
 * within the same render pass). Returns null when unauthenticated or the
 * staff account has been deactivated — callers that require a session
 * should go through `requirePermission` (src/server/auth/permissions.ts)
 * instead of checking this for null themselves.
 */
export const getCurrentStaffProfile = cache(async (): Promise<StaffProfile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("staff_profiles")
    .select("id, full_name, role_id, is_active")
    .eq("id", user.id)
    .eq("is_active", true)
    .single();

  if (profileError || !profile) return null;

  const { data: rolePerms, error: permsError } = await supabase
    .from("role_permissions")
    .select("permission_id")
    .eq("role_id", profile.role_id);

  if (permsError) {
    throw new Error(
      `Failed to load permissions for role "${profile.role_id}": ${permsError.message}`
    );
  }

  return {
    id: profile.id,
    fullName: profile.full_name,
    roleId: profile.role_id,
    isActive: profile.is_active,
    permissions: (rolePerms ?? []).map((row) => row.permission_id),
  };
});
