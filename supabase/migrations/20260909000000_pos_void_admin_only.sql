-- Tightens order voiding to admin/owner only. The original seed granted
-- pos.void to 'manager' too (matching the old system's looser policy); the
-- hotel explicitly asked for void to require admin, since it reverses a
-- kitchen/bar ticket and can hide mistakes if left too widely available.
delete from public.role_permissions
where permission_id = 'pos.void' and role_id = 'manager';
