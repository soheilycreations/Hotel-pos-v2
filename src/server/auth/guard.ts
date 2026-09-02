import "server-only";
import { getCurrentStaffProfile, type StaffProfile } from "./session";
import { AuthenticationError, AuthorizationError, type Permission } from "./permissions";

/**
 * First line of every privileged Server Action or Server Component that
 * needs a specific permission. Throws rather than returning a boolean so a
 * forgotten check fails loudly instead of silently falling through (mirrors
 * the old system's assertRole()/assertAdmin() pattern, but keyed on granular
 * permissions loaded from the database instead of a hardcoded role-name
 * allowlist). Kept separate from permissions.ts (which is import-safe from
 * client components) because this file is server-only.
 */
export async function requirePermission(permission: Permission): Promise<StaffProfile> {
  const profile = await getCurrentStaffProfile();
  if (!profile) {
    throw new AuthenticationError();
  }
  if (!profile.permissions.includes(permission)) {
    throw new AuthorizationError(`Missing permission: ${permission}`);
  }
  return profile;
}
