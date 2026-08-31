import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { generateSecureTempPassword } from "@/lib/crypto";

/**
 * Service-role client — bypasses RLS and can call the Supabase Admin API.
 * NEVER import this outside a "use server" action file, and never send this
 * key to the browser. Requires SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC_
 * prefix) — see .env.example.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it in your environment variables (Project Settings → API → service_role key in Supabase) to manage staff accounts."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Preferred way to onboard a new staff member: Supabase Auth emails them a
 * signed, time-limited invite link and they set their own password. The app
 * never generates, transmits, or stores a credential at all.
 *
 * Requires SMTP/email to be configured on the Supabase project (Auth >
 * Email Templates / SMTP Settings) — without it, the invite email will not
 * be delivered and `inviteTempPassword` (below) is the fallback.
 */
export async function inviteStaffMember(email: string) {
  const admin = createAdminClient();
  return admin.auth.admin.inviteUserByEmail(email);
}

/**
 * Fallback ONLY for deployments where outbound email isn't configured yet:
 * creates the auth user with a securely random temporary password (Node
 * crypto, not Math.random — see src/lib/crypto.ts) that an admin relays to
 * the staff member out-of-band, who should change it on first login. Prefer
 * `inviteStaffMember` whenever email delivery is available.
 */
export async function createStaffAccountWithTempPassword(email: string) {
  const admin = createAdminClient();
  const tempPassword = generateSecureTempPassword();
  const result = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });
  return { ...result, tempPassword };
}

/**
 * Sends a password-reset email via Supabase Auth's own flow — prefer this
 * over any manually generated replacement password.
 */
export async function sendStaffPasswordReset(email: string) {
  const admin = createAdminClient();
  return admin.auth.resetPasswordForEmail(email);
}
