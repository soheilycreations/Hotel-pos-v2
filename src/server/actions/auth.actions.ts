"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  loginSchema,
  requestPasswordResetSchema,
  setPasswordSchema,
  type LoginInput,
  type RequestPasswordResetInput,
  type SetPasswordInput,
} from "@/server/validation/auth.schema";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Signs in with Supabase Auth, then rejects deactivated staff — mirrors the
 * old system's defense-in-depth check (a valid password alone isn't enough;
 * the staff_profiles row must also be is_active).
 */
export async function login(input: LoginInput): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    return { ok: false, error: "Invalid email or password" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("staff_profiles")
    .select("is_active")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile || !profile.is_active) {
    await supabase.auth.signOut();
    return { ok: false, error: "This account is not active. Contact an administrator." };
  }

  redirect("/");
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Always returns ok (even for an unregistered email) so the form can't be
 * used to enumerate which emails have accounts. */
export async function requestPasswordReset(input: RequestPasswordResetInput): Promise<ActionResult> {
  const parsed = requestPasswordResetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/confirm?type=recovery&next=/set-password`,
  });

  return { ok: true };
}

/**
 * Sets the password for the currently-authenticated session. Only reachable
 * with a valid session, which by this point in the flow was established by
 * /auth/confirm exchanging the invite/recovery link's token for a session —
 * this function never generates or sees a temporary password itself.
 */
export async function setPassword(input: SetPasswordInput): Promise<ActionResult> {
  const parsed = setPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Your link has expired. Request a new one and try again." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { ok: false, error: error.message };
  }

  redirect("/");
}
