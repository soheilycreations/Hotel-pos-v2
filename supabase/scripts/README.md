# One-off scripts

This directory is for one-off/manual SQL scripts (e.g. a historical
stock-take import, a bulk data correction) — **not migrations**. Nothing
here runs automatically; a human runs it deliberately, once, against a
specific database.

Rules, learned from the old system's `stock-import-2026-08-05.sql` and
`clear-inventory.sql` (present with no safeguard beyond an inline comment):

1. Every script must start with a comment stating whether it's safe to
   re-run or must run exactly once, and what happens if it's run twice.
2. Any destructive script (deletes/truncates data) must say so in its
   filename and its first comment line, in capitals, and the person running
   it must take a database backup/snapshot first.
3. Never reference one of these scripts from application code or from
   `supabase/migrations/` — if the app needs the effect to happen
   automatically, it belongs in a real migration or an `rpc_*` function
   instead.
4. Delete a script from this directory once it's been run against every
   environment that needed it and is no longer useful as a reference.

Currently empty — no one-off scripts exist yet for this project.
