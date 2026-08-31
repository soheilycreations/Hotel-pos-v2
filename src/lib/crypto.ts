import { randomBytes } from "crypto";

/**
 * Cryptographically secure random string generator for anything
 * security-sensitive (temporary passwords, one-off tokens). Never use
 * Math.random() for this — it's not a CSPRNG and its output is predictable
 * (this replaces the old system's generateTempPassword(), which used
 * Math.random()).
 *
 * Prefer Supabase Auth's own invite/reset-password flow
 * (supabase.auth.admin.inviteUserByEmail / resetPasswordForEmail — see
 * src/lib/supabase/admin.ts) over generating a password at all: the user
 * sets their own credential via a signed, time-limited link, and the app
 * never has to generate, transmit, or store one. Only fall back to
 * `generateSecureTempPassword` when email delivery genuinely isn't
 * available for a given deployment.
 */
export function generateSecureTempPassword(length = 16): string {
  // Ambiguous characters (0/O, 1/l/I) excluded for readability when a
  // password must be read aloud or typed from a printout.
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

/** Cryptographically secure URL-safe token, e.g. for one-off invite/reset links this app issues itself. */
export function generateSecureToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}
