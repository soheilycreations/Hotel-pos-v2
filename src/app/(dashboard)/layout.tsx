import { redirect } from "next/navigation";
import { getCurrentStaffProfile } from "@/server/auth/session";
import { Sidebar } from "@/components/features/shell/sidebar";
import { Topbar } from "@/components/features/shell/topbar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentStaffProfile();

  // Belt-and-braces: the proxy (src/proxy.ts) already redirects unauthenticated
  // requests, but this layout is the one place that actually knows about
  // permissions, so it re-checks rather than trusting the edge redirect alone.
  if (!profile) {
    redirect("/login");
  }

  return (
    <div className="flex h-svh overflow-hidden">
      <Sidebar permissions={profile.permissions} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar permissions={profile.permissions} fullName={profile.fullName} roleLabel={profile.roleId} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
