"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { verifyEmailOtp } from "@/server/actions/auth.actions";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Handles a Supabase Auth email link client-side. Two formats land here:
 *
 * 1. The default free-tier template ({{ .ConfirmationURL }}): Supabase's
 *    own /verify endpoint checks the token, then redirects the browser here
 *    with the session in the URL *fragment*
 *    (#access_token=...&refresh_token=...&type=recovery). A fragment never
 *    reaches the server — only client-side JS can read it — so this
 *    component reads window.location.hash and calls
 *    supabase.auth.setSession() directly with the browser client, which
 *    persists the session into cookies the server can then see.
 * 2. A customized template using {{ .TokenHash }} (some Supabase plans):
 *    arrives as ?token_hash=...&type=... in the query string instead, which
 *    IS visible server-side — handled by calling the verifyEmailOtp server
 *    action.
 *
 * Either path ends the same way: redirect to /set-password once a session
 * exists, or to /login with an error if the link is invalid/expired.
 */
export function ConfirmClient({
  tokenHash,
  type,
  next,
}: {
  tokenHash: string | null;
  type: string | null;
  next: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    async function run() {
      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const hashError = hashParams.get("error_description") ?? hashParams.get("error");

      if (hashError) {
        router.replace("/login?error=invalid_or_expired_link");
        return;
      }

      if (accessToken && refreshToken) {
        const supabase = createClient();
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) {
          router.replace("/login?error=invalid_or_expired_link");
          return;
        }
        router.replace(next);
        return;
      }

      if (tokenHash && type) {
        const result = await verifyEmailOtp(tokenHash, type as Parameters<typeof verifyEmailOtp>[1]);
        if (result.ok) {
          router.replace(next);
        } else {
          router.replace("/login?error=invalid_or_expired_link");
        }
        return;
      }

      setError("That link is missing required information.");
      router.replace("/login?error=invalid_or_expired_link");
    }

    run();
  }, [router, tokenHash, type, next]);

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{error ?? "Verifying your link…"}</p>
      </CardContent>
    </Card>
  );
}
