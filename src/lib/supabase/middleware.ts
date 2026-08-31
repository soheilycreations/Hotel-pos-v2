import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Global auth gate: redirects unauthenticated requests to /login and signed-in
 * users away from /login. Uses `getUser()` (validates the token against
 * Supabase, not just the cookie) rather than `getSession()` — a spoofable
 * cookie alone must never be trusted for a redirect decision.
 *
 * This is route-existence agnostic (Phase 1 has no dashboard routes yet);
 * Phase 2 should add route-group-level permission checks here in addition to
 * this authentication check, so a user lacking a permission is redirected
 * before a privileged page ever renders, rather than relying solely on the
 * page's Server Actions to reject (the old system's approach, backstopped by
 * RLS but not failing closed at the edge).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith("/login");

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}
