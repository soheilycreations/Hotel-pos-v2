-- Menu writes were gated on roles.manage (the same permission needed to
-- manage system roles), so only Owner/Admin could touch the menu. Managers
-- who run the restaurant day-to-day need to add items and change prices
-- without full role-management access — give menu writes their own
-- permission and re-point the existing RLS policies at it.

insert into public.permissions (id, category, description) values
  ('pos.menu.manage', 'pos', 'Add/edit menu items, categories, and prices')
on conflict (id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.role_id, 'pos.menu.manage'
from (values ('owner'), ('admin'), ('manager')) as r(role_id)
on conflict do nothing;

drop policy if exists "menu_categories write" on public.menu_categories;
create policy "menu_categories write" on public.menu_categories for all to authenticated
  using (public.has_permission('pos.menu.manage')) with check (public.has_permission('pos.menu.manage'));

drop policy if exists "menu_items write" on public.menu_items;
create policy "menu_items write" on public.menu_items for all to authenticated
  using (public.has_permission('pos.menu.manage')) with check (public.has_permission('pos.menu.manage'));
