# Phase 3 Completion Report — Application Foundation

Scope was strictly Phase 3 per instruction: authentication, authorization, protected shell, reusable UI foundation. **No PMS/POS business modules were built** — see section 9.

## 1. Files created/modified

**New dependencies**: `@radix-ui/react-{dialog,dropdown-menu,label,slot,avatar,separator}`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `sonner`, `react-hook-form`, `@hookform/resolvers`.

**UI primitives** (`src/components/ui/`): `button`, `input`, `label`, `card`, `dialog`, `confirm-dialog`, `dropdown-menu`, `avatar`, `separator`, `table`, `badge`, `skeleton`, `empty-state`, `error-state`, `toaster`, `form` (react-hook-form + Radix Slot integration). `src/lib/utils.ts` (`cn` helper). `src/app/globals.css` extended with a full design-token set (light/dark).

**Validation**: `src/server/validation/auth.schema.ts` — `loginSchema`, `requestPasswordResetSchema`, `setPasswordSchema` (Zod).

**Auth**: `src/server/actions/auth.actions.ts` (`login`, `logout`, `requestPasswordReset`, `setPassword`); `src/app/(auth)/{layout,login,reset-password,set-password}/*`; `src/app/auth/confirm/route.ts` (invite/recovery link handler).

**Authorization**: `src/server/auth/permissions.ts` (split — now pure constants/types, safe to import from client code) and new `src/server/auth/guard.ts` (`requirePermission`, server-only). `src/components/features/shell/permission-gate.tsx`.

**Shell**: `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/page.tsx` (home), `src/components/features/shell/{sidebar,topbar,mobile-nav,user-menu,nav-items}.tsx`. Six permission-gated placeholder module pages: `pms`, `pos`, `inventory`, `finance`, `reports`, `settings`.

**Modified**: `src/lib/supabase/middleware.ts` (public-route list extended), `src/app/layout.tsx` (Toaster + branding), `.env.example` (added `NEXT_PUBLIC_SITE_URL`).

**Removed**: `src/app/page.tsx` — the unmodified create-next-app starter page. It was silently shadowing the new dashboard home page at `/` (both resolved to the same route); the build's route table confirmed `/` was being served as **static** content (the starter splash page) until this was found and removed — after removal it correctly shows as **dynamic** (cookie-dependent).

## 2. Features implemented

Login, invite acceptance, password reset request + completion, protected shell (sidebar/topbar/mobile nav/user menu/logout), permission-aware navigation, six placeholder module routes, and the full UI primitive set (forms, dialogs, confirmation dialogs, tables, toasts, skeletons, empty/error states) ready for later phases to build on.

## 3. Authentication flow

- **Login**: `signInWithPassword`, then an explicit `staff_profiles.is_active` check (mirrors the old system's defense-in-depth — a valid password alone isn't enough).
- **Invite/Reset**: both use Supabase's `token_hash` + `type` link pattern. `/auth/confirm` calls `supabase.auth.verifyOtp({ type, token_hash })`, establishing a temporary session, then redirects to `/set-password`. `setPassword` calls `supabase.auth.updateUser({ password })` on that session — no custom password system anywhere, no generated/stored temporary password.
- **Expired/invalid links**: `/auth/confirm` redirects to `/login?error=invalid_or_expired_link` on any `verifyOtp` failure; `/set-password` independently re-checks for a session and redirects the same way if visited without one.
- **Session persistence**: handled entirely by `@supabase/ssr`'s cookie-based session (unchanged from Phase 1).

## 4. Authorization/permission implementation

- `requirePermission()` (`src/server/auth/guard.ts`) is the single server-side check, used by `PermissionGate` in every placeholder module page — a direct URL visit without the permission is rejected server-side (verified in section 6), not just hidden from the sidebar.
- Navigation (`nav-items.ts`) filters by permission for UI convenience only, exactly as instructed — it is explicitly documented in code as not a security boundary.
- RLS remains the final backstop underneath all of this, unchanged from Phase 1/2.

## 5. Supabase integration

No changes to the database, RLS, or RPCs — Phase 3 only consumes what Phase 1/2 already verified. `src/lib/supabase/{client,server,middleware,admin}.ts` are unchanged from Phase 1.

## 6. Tests performed (in this session)

Everything requiring live Supabase access could not be run here (this session's network egress blocks Supabase's domains, and it has no real credentials — the real project's `.env.local` lives only on your machine). What **was** verified in this session:

- `npx tsc --noEmit` — clean.
- `npm run lint` — clean.
- `npm run build` — clean, and its route table was used to catch the `src/app/page.tsx` conflict (see section 1) — a concrete example of the build surfacing a real routing bug, not just a formality.
- Manual code-path review of the permission-gate/guard split against the "server-only leaking into a client bundle" build error it was written to fix.

**Not yet run** (needs your local environment — see section 9): real login, invite acceptance, password reset, session persistence across a reload, unauthenticated redirect, permission-based navigation with more than one role, and unauthorized server-side access (visiting e.g. `/settings` as a non-admin role).

## 7. Build/lint/typecheck results

All three pass cleanly as of the final commit (`1271faf`). Full local build output:
```
Route (app)
┌ ƒ /
├ ○ /_not-found
├ ƒ /auth/confirm
├ ƒ /finance
├ ƒ /inventory
├ ƒ /login
├ ƒ /pms
├ ƒ /pos
├ ƒ /reports
├ ○ /reset-password
├ ƒ /set-password
└ ƒ /settings
```

## 8. Known issues

- **Email template format is unverified.** `/auth/confirm` expects links shaped `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}&next=/set-password`. If your Supabase project's email templates still use the classic `{{ .ConfirmationURL }}` link, the redirect will not carry `token_hash`/`type` and `/auth/confirm` will reject it as invalid. **Check Authentication → Email Templates** before testing invite/reset — this is the most likely first failure you'll hit.
- Reports/Settings placeholder pages are gated on `finance.expenses.read` and `staff.manage` respectively as reasonable stand-ins — no dedicated `reports.read` permission exists yet; revisit when those modules are actually built.
- No automated tests were added (Phase 9 per the original roadmap).

## 9. Manual configuration still required

1. **Supabase Auth → URL Configuration**: set **Site URL** to `http://localhost:3000` (or your real domain later) and add `http://localhost:3000/auth/confirm` to **Redirect URLs**. (Flagged already in the Phase 2 report — now it actually matters, since `/auth/confirm` exists.)
2. **Email Templates**: confirm/update the Invite and Reset Password templates to link to `/auth/confirm` with `token_hash`/`type` as described above.
3. **`.env.local`**: add `NEXT_PUBLIC_SITE_URL=http://localhost:3000` alongside your existing real credentials.
4. `npm install` after pulling this update (new dependencies — see section 1).

## 10. Phase 4 status

**Phase 4 was NOT started.** No PMS/POS business logic, no data-access functions beyond what Phase 1 already had (`getCurrentStaffProfile`), no Server Actions beyond auth. Stopping here per instruction — waiting for you to run the local tests in section 6 and for explicit approval before Phase 4 begins.
