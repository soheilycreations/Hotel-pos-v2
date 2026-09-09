import type { Metadata } from "next";
import { ConfirmClient } from "./confirm-client";

export const metadata: Metadata = { title: "Verifying — Hotel Rawana" };

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const { token_hash, type, next } = await searchParams;

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted p-4">
      <div className="w-full max-w-sm">
        <ConfirmClient tokenHash={token_hash ?? null} type={type ?? null} next={next ?? "/set-password"} />
      </div>
    </div>
  );
}
