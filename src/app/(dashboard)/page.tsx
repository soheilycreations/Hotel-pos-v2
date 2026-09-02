import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentStaffProfile } from "@/server/auth/session";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata: Metadata = { title: "Dashboard — Hotel Rawana" };

export default async function DashboardPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {profile.fullName}</h1>
        <p className="text-sm text-muted-foreground capitalize">Signed in as {profile.roleId}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Application foundation</CardTitle>
          <CardDescription>
            Authentication, authorization, and the shell are live. PMS, POS, Inventory, and Finance modules are
            built in a later phase.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          You have {profile.permissions.length} permission{profile.permissions.length === 1 ? "" : "s"} assigned to
          your role.
        </CardContent>
      </Card>
    </div>
  );
}
