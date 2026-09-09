import type { Metadata } from "next";
import { PermissionGate } from "@/components/features/shell/permission-gate";
import { PERMISSIONS } from "@/server/auth/permissions";
import { getMenuCategoriesAdmin, getAllMenuItems } from "@/server/data-access/menu";
import { MenuManagement } from "./menu-management";

export const metadata: Metadata = { title: "Menu items — Hotel Rawana" };

export default function MenuManagementPage() {
  return (
    <PermissionGate permission={PERMISSIONS.POS_MENU_MANAGE}>
      <MenuManagementPageContent />
    </PermissionGate>
  );
}

async function MenuManagementPageContent() {
  const [categories, items] = await Promise.all([getMenuCategoriesAdmin(), getAllMenuItems()]);
  return <MenuManagement categories={categories} items={items} />;
}
