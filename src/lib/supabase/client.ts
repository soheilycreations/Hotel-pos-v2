"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * NOTE: not yet typed against a generated `Database` schema — there is no
 * live Supabase project in this environment to run
 * `supabase gen types typescript` against. Once a project exists (Phase 2),
 * generate `src/lib/types/database.types.ts` and pass it as
 * `createBrowserClient<Database>(...)` here.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
