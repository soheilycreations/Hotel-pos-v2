import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: "Set password — Hotel Rawana" };

export default async function SetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // This page only makes sense with the temporary session established by
  // /auth/confirm (invite or recovery link) — without one, there's nothing
  // to set a password for.
  if (!user) {
    redirect("/login?error=invalid_or_expired_link");
  }

  return <SetPasswordForm />;
}
