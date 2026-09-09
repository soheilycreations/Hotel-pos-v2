// One-off LOCAL DEV utility — sets an existing auth user's password directly
// via the Supabase Admin API, bypassing email entirely (useful when the
// project's free-tier email rate limit blocks invite/reset testing).
//
// This is NOT part of the running app — it must never be reachable over
// HTTP; run it only from your own machine, only against your own project.
//
// Usage:
//   node --env-file=.env.local scripts/dev-set-password.mjs <email> <newPassword>

import { createClient } from "@supabase/supabase-js";

const [, , email, newPassword] = process.argv;

if (!email || !newPassword) {
  console.error("Usage: node --env-file=.env.local scripts/dev-set-password.mjs <email> <newPassword>");
  process.exit(1);
}
if (newPassword.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let user;
let page = 1;
while (!user) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) {
    console.error("Failed to list users:", error.message);
    process.exit(1);
  }
  user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (user || data.users.length < 200) break;
  page += 1;
}

if (!user) {
  console.error(`No auth user found with email ${email}`);
  process.exit(1);
}

const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, { password: newPassword });
if (updateError) {
  console.error("Failed to update password:", updateError.message);
  process.exit(1);
}

console.log(`Password updated for ${email}. You can log in with it now.`);
