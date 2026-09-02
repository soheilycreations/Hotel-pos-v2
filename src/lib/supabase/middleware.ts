import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes reachable without an existing session. /set-password also needs to
// be here even though it requires a session — the temporary one /auth/confirm
// establishes via verifyOtp — because that session may not exist yet when
// this middleware runs on the *first* request in the flow; the page itself
// (src/app/(auth)/set-password/page.tsx) enforces the real requirement.
const PUBLIC_ROUTES = ["/login", "/reset-password", "/set-password"];
// Of those, only these should bounce an already-authenticated user away —
// /set-password must stay reachable even with a session, since completing
// an invite/recovery IS having a (temporary) session.
const REDIRECT_IF_AUTHENTICATED_ROUTES = ["/login", "/reset-password"];

/**
 * Global auth gate: redirects unauthenticated requests to /login and signed-in
 * users away from /login (and /reset-password). Uses `getUser()` (validates
 * the token against Supabase, not just the cookie) rather than `getSession()`
 * — a spoofable cookie alone must never be trusted for a redirect decision.
 *
 * Permission-based authorization (as opposed to plain authentication) is
 * intentionally NOT done here — it's enforced server-side per page/action
 * (src/components/features/shell/permission-gate.tsx,
 * src/server/auth/permissions.ts) and ultimately by RLS, so there is a real
 * boundary even if this edge check were ever bypassed.
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

  const pathname = request.nextUrl.pathname;
  const isPublicRoute = pathname.startsWith("/auth/") || PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  const isRedirectIfAuthenticatedRoute = REDIRECT_IF_AUTHENTICATED_ROUTES.some((route) => pathname.startsWith(route));

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isRedirectIfAuthenticatedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}
